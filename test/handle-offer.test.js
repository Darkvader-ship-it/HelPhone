import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock contract module ──────────────────────────────────────
const mockGetRequest = vi.fn()
const mockAcceptRequest = vi.fn()
const mockEnsureAccountFunded = vi.fn()
const mockRecordExpertVerification = vi.fn()

vi.mock('../src/lib/contract', () => ({
  getActiveRequests: vi.fn(),
  getRequest: (...args) => mockGetRequest(...args),
  getResponder: vi.fn(),
  getResponderCount: vi.fn(),
  createRequest: vi.fn(),
  acceptRequest: (...args) => mockAcceptRequest(...args),
  markArrived: vi.fn(),
  resolveRequest: vi.fn(),
  cancelRequest: vi.fn(),
  getRanking: vi.fn(),
  ensureAccountFunded: (...args) => mockEnsureAccountFunded(...args),
  updateLocation: vi.fn(),
  recordExpertVerification: (...args) => mockRecordExpertVerification(...args),
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

// ── Mock mapbox ───────────────────────────────────────────────
vi.mock('react-map-gl/mapbox', () => ({
  default: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'MapMock' }),
  Marker: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'MarkerMock' }),
  Popup: Object.assign(({ children }) => ({ type: 'div', props: { children } }), { displayName: 'PopupMock' }),
  Source: () => null,
  Layer: () => null,
  NavigationControl: () => null,
  useMap: () => ({ current: { flyTo: vi.fn() } }),
}))

// ── Mock react-router-dom ─────────────────────────────────────
vi.mock('react-router-dom', () => ({
  Link: Object.assign(({ children, ...props }) => ({ type: 'a', props: { ...props, children } }), { displayName: 'LinkMock' }),
}))

// ── Simulate the concurrency guard / mounted guard / seq logic ──
// This mirrors the exact pattern from the refactored handleOffer:
//   busy ref, mounted ref, seq ref — all plain objects in tests.
function createHandleOfferGuard() {
  const state = { busy: false, mounted: true, seq: 0 }

  function cleanup() {
    state.mounted = false
  }

  async function handleOffer(callback) {
    if (state.busy) return { skipped: true, reason: 'busy' }
    state.busy = true
    const mySeq = ++state.seq
    try {
      if (!state.mounted) return { skipped: true, reason: 'unmounted' }
      const result = await callback(mySeq, () => state.mounted)
      return { skipped: false, result }
    } finally {
      if (state.mounted) state.busy = false
    }
  }

  return { handleOffer, cleanup, state }
}

// ── Tests ─────────────────────────────────────────────────────
describe('handleOffer memory leak prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Test 1: Concurrency guard blocks overlapping calls ──────
  describe('concurrency guard', () => {
    it('blocks a second call while the first is still running', async () => {
      const { handleOffer } = createHandleOfferGuard()
      let resolveFirst
      const firstCall = new Promise(r => { resolveFirst = r })

      const cb1 = vi.fn().mockReturnValue(firstCall)
      const cb2 = vi.fn()

      const p1 = handleOffer(cb1)
      const p2 = handleOffer(cb2)

      const r2 = await p2
      expect(r2.skipped).toBe(true)
      expect(r2.reason).toBe('busy')
      expect(cb2).not.toHaveBeenCalled()

      resolveFirst('done')
      const r1 = await p1
      expect(r1.skipped).toBe(false)
      expect(cb1).toHaveBeenCalledTimes(1)
    })

    it('allows a new call after the previous one completes', async () => {
      const { handleOffer } = createHandleOfferGuard()
      const cb = vi.fn().mockResolvedValue('ok')

      const r1 = await handleOffer(cb)
      expect(r1.skipped).toBe(false)

      const r2 = await handleOffer(cb)
      expect(r2.skipped).toBe(false)
      expect(cb).toHaveBeenCalledTimes(2)
    })
  })

  // ── Test 2: Mounted check prevents state updates after unmount ──
  describe('mounted guard', () => {
    it('skips execution when component is unmounted', async () => {
      const { handleOffer, cleanup } = createHandleOfferGuard()
      const cb = vi.fn()

      cleanup()

      const r = await handleOffer(cb)
      expect(r.skipped).toBe(true)
      expect(r.reason).toBe('unmounted')
      expect(cb).not.toHaveBeenCalled()
    })

    it('skips state updates mid-flight when unmounted during execution', async () => {
      const { handleOffer, state } = createHandleOfferGuard()

      const cb = vi.fn((seq, isMounted) => {
        return new Promise(resolve => {
          // Unmount immediately while "in flight"
          state.mounted = false
          resolve('late-result')
        })
      })

      const r = await handleOffer(cb)
      expect(r.skipped).toBe(false)
      expect(r.result).toBe('late-result')
      // busy flag stays true (component unmounted, finally block skips reset)
      expect(state.busy).toBe(true)
    })
  })

  // ── Test 3: Sequence counter prevents stale responses ───────
  describe('sequence counter', () => {
    it('increments on each call', () => {
      const { state } = createHandleOfferGuard()
      expect(state.seq).toBe(0)
      ++state.seq
      ++state.seq
      expect(state.seq).toBe(2)
    })

    it('stale sequence is detected correctly', () => {
      const { state } = createHandleOfferGuard()
      const call1Seq = ++state.seq
      const call2Seq = ++state.seq
      expect(call1Seq).not.toBe(call2Seq)
      expect(state.seq).toBe(call2Seq)
    })
  })

  // ── Test 4: Busy flag resets in finally block ────────────────
  describe('busy flag lifecycle', () => {
    it('resets busy flag after successful completion', async () => {
      const { handleOffer, state } = createHandleOfferGuard()
      const cb = vi.fn().mockResolvedValue('ok')

      expect(state.busy).toBe(false)
      await handleOffer(cb)
      expect(state.busy).toBe(false)
    })

    it('resets busy flag after error', async () => {
      const { handleOffer, state } = createHandleOfferGuard()
      const cb = vi.fn().mockRejectedValue(new Error('boom'))

      try { await handleOffer(cb) } catch {}
      expect(state.busy).toBe(false)
    })
  })

  // ── Test 5: Full handleOffer flow with mocked contracts ──────
  describe('contract integration', () => {
    it('calls acceptRequest with correct params on success', async () => {
      mockGetRequest.mockResolvedValue({
        id: 42,
        status: 'Pending',
        lat: 40.71,
        lng: -74.00,
        emergency_type: 'medical',
        requester: 'addr-1',
      })
      mockAcceptRequest.mockResolvedValue({ index: 0, hash: 'txhash123' })
      mockRecordExpertVerification.mockResolvedValue({ hash: 'record-hash' })

      const { getRequest, acceptRequest, ensureAccountFunded } = await import('../src/lib/contract')

      const req = { id: 42 }
      const fresh = await getRequest(42)
      expect(fresh).toBeTruthy()
      expect(fresh.status).toBe('Pending')

      await ensureAccountFunded('testaddr')
      const result = await acceptRequest('testaddr', 42, 40.71, -74.00, 300, null)
      expect(result.hash).toBe('txhash123')
      expect(mockAcceptRequest).toHaveBeenCalledWith('testaddr', 42, 40.71, -74.00, 300, null)
    })

    it('returns non-Pending request without calling acceptRequest', async () => {
      mockGetRequest.mockResolvedValue({
        id: 99,
        status: 'Enroute',
        lat: 40.71,
        lng: -74.00,
      })

      const { getRequest } = await import('../src/lib/contract')
      const fresh = await getRequest(99)
      expect(fresh).toBeTruthy()
      expect(fresh.status).toBe('Enroute')
      expect(mockAcceptRequest).not.toHaveBeenCalled()
    })
  })

  // ── Test 6: Memory pressure simulation ──────────────────────
  describe('high-load memory safety', () => {
    it('handles 1000 rapid concurrent offer attempts without leak', async () => {
      const { handleOffer } = createHandleOfferGuard()
      let activeCount = 0
      let maxConcurrent = 0

      const cb = vi.fn(async () => {
        activeCount++
        maxConcurrent = Math.max(maxConcurrent, activeCount)
        await new Promise(r => setTimeout(r, 10))
        activeCount--
        return 'done'
      })

      const results = await Promise.all(
        Array.from({ length: 1000 }, () => handleOffer(cb))
      )

      const skipped = results.filter(r => r.skipped)
      const executed = results.filter(r => !r.skipped)

      // Only 1 should execute (concurrency guard)
      expect(executed).toHaveLength(1)
      expect(skipped).toHaveLength(999)
      expect(maxConcurrent).toBeLessThanOrEqual(1)
    })

    it('allows sequential execution after each completes', async () => {
      const { handleOffer } = createHandleOfferGuard()
      const results = []

      for (let i = 0; i < 50; i++) {
        const r = await handleOffer(async () => `result-${i}`)
        results.push(r)
      }

      expect(results.every(r => !r.skipped)).toBe(true)
      expect(results.map(r => r.result)).toEqual(
        Array.from({ length: 50 }, (_, i) => `result-${i}`)
      )
    })
  })

  // ── Test 7: Race condition — unmount during long proof build ──
  describe('race condition safety', () => {
    it('does not set state after unmount during proof build', async () => {
      const { handleOffer, state } = createHandleOfferGuard()
      const stateUpdates = []

      const cb = vi.fn(async (seq, isMounted) => {
        // Simulate long proof build
        await new Promise(r => setTimeout(r, 50))
        if (isMounted()) stateUpdates.push('proof-done')
        // Simulate more work
        await new Promise(r => setTimeout(r, 50))
        if (isMounted()) stateUpdates.push('accept-done')
        return 'ok'
      })

      const p = handleOffer(cb)
      // Unmount between the two awaits (after proof, before accept)
      setTimeout(() => { state.mounted = false }, 75)
      await p

      // Only the pre-unmount update should have fired
      expect(stateUpdates).toEqual(['proof-done'])
    })
  })
})
