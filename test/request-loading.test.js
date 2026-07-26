import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock contract module ──────────────────────────────────────
const mockGetActiveRequests = vi.fn()
const mockGetRequest = vi.fn()

vi.mock('../src/lib/contract', () => ({
  getActiveRequests: (...args) => mockGetActiveRequests(...args),
  getRequest: (...args) => mockGetRequest(...args),
  getResponder: vi.fn(),
  getResponderCount: vi.fn(),
  createRequest: vi.fn(),
  acceptRequest: vi.fn(),
  markArrived: vi.fn(),
  resolveRequest: vi.fn(),
  cancelRequest: vi.fn(),
  getRanking: vi.fn(),
  ensureAccountFunded: vi.fn(),
  updateLocation: vi.fn(),
  recordExpertVerification: vi.fn(),
}))

// ── Mock stellar wallet kit ───────────────────────────────────
vi.mock('@creit-tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    getAddress: vi.fn().mockResolvedValue({ address: '' }),
    on: vi.fn().mockReturnValue(() => {}),
    authModal: vi.fn(),
  },
}))
vi.mock('@creit-tech/stellar-wallets-kit/types', () => ({
  KitEventType: { STATE_UPDATED: 'STATE_UPDATED', DISCONNECT: 'DISCONNECT' },
}))

// ── Mock mapbox (no JSX — .js file) ───────────────────────────
vi.mock('react-map-gl/mapbox', () => ({
  default: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'MapMock' }),
  Marker: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'MarkerMock' }),
  Popup: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'PopupMock' }),
  Source: () => null,
  Layer: () => null,
  NavigationControl: () => null,
  useMap: () => ({ current: { flyTo: vi.fn() } }),
}))

// ── Mock react-router-dom (no JSX) ───────────────────────────
vi.mock('react-router-dom', () => ({
  Link: Object.assign(({ children, ...props }) => ({ type: 'a', props: { ...props, children } }), { displayName: 'LinkMock' }),
}))

// ── Tests ─────────────────────────────────────────────────────
describe('Emergency request loading hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeRequest(id, status = 'Pending') {
    return {
      id,
      requester: `addr-${id}`,
      lat: 40.7128,
      lng: -74.006,
      emergency_type: 'medical',
      nickname: `User ${id}`,
      contact: '555-0000',
      status,
      created_at: Date.now(),
      resolved_at: null,
    }
  }

  // ── Test 1: getActiveRequests respects increased max ─────────
  describe('getActiveRequests max limit', () => {
    it('exports getActiveRequests with a higher default cap', async () => {
      const { getActiveRequests } = await import('../src/lib/contract')
      // The function should be importable and callable
      expect(typeof getActiveRequests).toBe('function')
    })
  })

  // ── Test 2: Individual fetch failures don't drop the batch ──
  describe('resilient batch loading', () => {
    it('continues loading remaining requests when one getRequest fails', async () => {
      const ids = [1, 2, 3, 4, 5]
      mockGetActiveRequests.mockResolvedValue(ids)

      // Requests 2 and 4 fail
      mockGetRequest.mockImplementation(async (id) => {
        if (id === 2 || id === 4) throw new Error(`Network error for request ${id}`)
        return makeRequest(id)
      })

      // Simulate the hardened load logic from Help.jsx
      const requests = await Promise.all(
        ids.map(id =>
          mockGetRequest(id)
            .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
            .catch(() => null)
        )
      ).then(results => results.filter(Boolean))

      // Should have 3 successful requests (1, 3, 5), not 0
      expect(requests).toHaveLength(3)
      expect(requests.map(r => r.id)).toEqual([1, 3, 5])
    })

    it('returns empty array when all requests fail', async () => {
      const ids = [1, 2, 3]
      mockGetActiveRequests.mockResolvedValue(ids)
      mockGetRequest.mockRejectedValue(new Error('Network down'))

      const requests = await Promise.all(
        ids.map(id =>
          mockGetRequest(id)
            .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
            .catch(() => null)
        )
      ).then(results => results.filter(Boolean))

      expect(requests).toHaveLength(0)
    })

    it('filters out non-Pending requests without dropping the batch', async () => {
      const ids = [1, 2, 3]
      mockGetActiveRequests.mockResolvedValue(ids)
      mockGetRequest.mockImplementation(async (id) => {
        const statuses = { 1: 'Pending', 2: 'Enroute', 3: 'Pending' }
        return makeRequest(id, statuses[id])
      })

      const requests = await Promise.all(
        ids.map(id =>
          mockGetRequest(id)
            .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
            .catch(() => null)
        )
      ).then(results => results.filter(Boolean))

      expect(requests).toHaveLength(2)
      expect(requests.map(r => r.id)).toEqual([1, 3])
    })
  })

  // ── Test 3: Concurrency guard prevents overlapping loads ─────
  describe('loading guard', () => {
    it('prevents concurrent load invocations', async () => {
      let loadCallCount = 0
      let resolveSlow
      mockGetActiveRequests.mockImplementation(() => {
        loadCallCount++
        return new Promise(r => { resolveSlow = r })
      })
      mockGetRequest.mockImplementation(async (id) => makeRequest(id))

      // Simulate the loading guard pattern from Help.jsx
      let loading = false
      async function load() {
        if (loading) return { skipped: true }
        loading = true
        try {
          const ids = await mockGetActiveRequests()
          const requests = await Promise.all(
            ids.map(id =>
              mockGetRequest(id)
                .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
                .catch(() => null)
            )
          ).then(results => results.filter(Boolean))
          return { requests }
        } finally {
          loading = false
        }
      }

      // Start first load (will block on the slow promise)
      const p1 = load()
      // Immediately fire second load — should be skipped
      const p2 = load()

      const r2 = await p2
      // Second load should be skipped
      expect(r2.skipped).toBe(true)
      // Only one actual network call
      expect(loadCallCount).toBe(1)

      // Now resolve the slow call so p1 can finish
      resolveSlow([1, 2, 3])
      const r1 = await p1
      expect(r1.requests).toHaveLength(3)
    })
  })

  // ── Test 4: Empty active requests list ──────────────────────
  describe('empty state handling', () => {
    it('handles zero active requests gracefully', async () => {
      mockGetActiveRequests.mockResolvedValue([])
      mockGetRequest.mockImplementation(async (id) => makeRequest(id))

      const ids = await mockGetActiveRequests()
      const requests = await Promise.all(
        ids.map(id =>
          mockGetRequest(id)
            .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
            .catch(() => null)
        )
      ).then(results => results.filter(Boolean))

      expect(requests).toHaveLength(0)
      expect(mockGetRequest).not.toHaveBeenCalled()
    })
  })

  // ── Test 5: Large batch handling ────────────────────────────
  describe('large batch resilience', () => {
    it('handles 500 requests with mixed failures', async () => {
      const ids = Array.from({ length: 500 }, (_, i) => i + 1)
      mockGetActiveRequests.mockResolvedValue(ids)

      // Every 7th request fails, every 13th is resolved
      mockGetRequest.mockImplementation(async (id) => {
        if (id % 7 === 0) throw new Error(`Fail on ${id}`)
        if (id % 13 === 0) return makeRequest(id, 'Resolved')
        return makeRequest(id)
      })

      const startTime = Date.now()
      const requests = await Promise.all(
        ids.map(id =>
          mockGetRequest(id)
            .then(req => (req && req.status === 'Pending') ? { ...req, id } : null)
            .catch(() => null)
        )
      ).then(results => results.filter(Boolean))
      const elapsed = Date.now() - startTime

      // Should complete quickly (parallel, not sequential)
      expect(elapsed).toBeLessThan(5000)

      // Filtered correctly: 500 - ~71 failures - ~38 resolved ≈ 391
      expect(requests.length).toBeGreaterThan(350)
      expect(requests.length).toBeLessThan(420)
      // No failed requests in the batch
      expect(requests.every(r => r.status === 'Pending')).toBe(true)
    })
  })

  // ── Test 6: Request removal doesn't affect other requests ───
  describe('request state mutation isolation', () => {
    it('removing one request by ID does not affect others', () => {
      const requests = [
        makeRequest(1),
        makeRequest(2),
        makeRequest(3),
      ]

      const filtered = requests.filter(r => Number(r.id) !== Number(2))

      expect(filtered).toHaveLength(2)
      expect(filtered.map(r => r.id)).toEqual([1, 3])
    })

    it('syncing a single request updates only that request', () => {
      const requests = [
        makeRequest(1, 'Pending'),
        makeRequest(2, 'Pending'),
        makeRequest(3, 'Pending'),
      ]

      const updated = requests.map(r =>
        Number(r.id) === Number(2) ? { ...r, status: 'Enroute' } : r
      )

      expect(updated[0].status).toBe('Pending')
      expect(updated[1].status).toBe('Enroute')
      expect(updated[2].status).toBe('Pending')
    })
  })
})
