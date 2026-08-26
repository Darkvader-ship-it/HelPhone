import express from 'express'
import cors from 'cors'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { rpc } from '@stellar/stellar-sdk'

import { normalizeBase64 } from './base64Utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Rate limiter ─────────────────────────────────────────────────────────────
// In-memory sliding-window rate limiter. Tracks request counts per IP within
// a rolling window and returns 429 when the limit is exceeded.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60)

export function createRateLimiter({ windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX } = {}) {
  const hits = new Map()

  function cleanup(now) {
    for (const [key, entry] of hits) {
      if (now - entry.start > windowMs) hits.delete(key)
    }
  }

  function middleware(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    cleanup(now)

    const entry = hits.get(ip)
    if (!entry || now - entry.start > windowMs) {
      hits.set(ip, { start: now, count: 1 })
    } else {
      entry.count++
    }

    const current = hits.get(ip)
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current.count))
    res.setHeader('X-RateLimit-Reset', new Date(current.start + windowMs).toISOString())

    if (current.count > max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      })
    }
    next()
  }

  // Expose for testing: reset internal state
  middleware._reset = () => hits.clear()
  return middleware
}

// ── Custom error handler ─────────────────────────────────────────────────────
// Formats all unhandled errors into a consistent JSON envelope so the client
// always receives a parseable response, never an HTML stack trace.
export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error'

  console.error(`[error] ${status}: ${message}`)
  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  })
}

const app = express()
const PORT = process.env.PORT || 3001

// Solves Issue 1: Restrict CORS policy on ZK Prover Server
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['https://helphone.com', 'https://staging.helphone.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}))
app.use(express.json({ limit: '1mb' }))

// Rate limiter on all routes (disabled in test)
if (process.env.NODE_ENV !== 'test') {
  const rateLimiter = createRateLimiter()
  app.use(rateLimiter)
}

// ── Contract event bridge ────────────────────────────────────────
// Issue #177: the frontend used to poll the contract directly on a timer
// (one RPC round-trip per connected browser, every few seconds). Instead,
// this server polls Soroban RPC's getEvents ONCE on an interval — no true
// push exists at the Soroban RPC layer, so this is the honest mechanism —
// and re-broadcasts new events to every connected browser over SSE. That
// turns N client-side polls into 1 server-side poll + fan-out.
const CONTRACT_ID = process.env.HELPHONE_CONTRACT_ID || 'CDP5XZ7UYCGSQBYRDYM2OEAUQJULBZPULSQXK7LGNAJTRXRG3VHZLSHY'
const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
const EVENT_POLL_MS = Number(process.env.EVENT_POLL_MS || 2000)
// Topics published by contract/contracts/helphone-contract/src/lib.rs.
const REQUEST_LIFECYCLE_TOPICS = new Set([
  'RqCreated', 'RqAcptd', 'LocUpd', 'Arrived', 'Resolved', 'Cancelled',
])

const rpcServer = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })
const sseClients = new Set()
let eventCursor = null // Soroban RPC pagination cursor; null until first poll seeds it

function decodeTopicSymbol(topicScVal) {
  try {
    return topicScVal?.sym?.() ? topicScVal.sym().toString() : null
  } catch {
    return null
  }
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) {
    res.write(payload)
  }
}

async function seedCursor() {
  const latest = await rpcServer.getLatestLedger()
  // Soroban RPC only retains a bounded recent-event window; start a few
  // ledgers back so we don't miss events from just before boot.
  return Math.max(1, latest.sequence - 100)
}

async function pollContractEvents() {
  try {
    if (eventCursor === null) {
      eventCursor = await seedCursor()
    }
    const res = await rpcServer.getEvents({
      startLedger: eventCursor,
      filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
      limit: 100,
    })
    for (const ev of res.events || []) {
      const topic = decodeTopicSymbol(ev.topic?.[0])
      if (topic && REQUEST_LIFECYCLE_TOPICS.has(topic)) {
        broadcast({ topic, ledger: ev.ledger, id: ev.id })
      }
    }
    if (typeof res.latestLedger === 'number') {
      eventCursor = res.latestLedger + 1
    }
  } catch (err) {
    // A single failed poll must not kill the loop or drop the cursor —
    // just retry next tick. Log so operators can notice sustained failure.
    console.error('[events] poll failed:', err.message || err)
  }
}

app.get('/events/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('retry: 3000\n\n')
  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
})

if (process.env.NODE_ENV !== 'test') {
  setInterval(pollContractEvents, EVENT_POLL_MS)
}

let _noir = null
let _backend = null
let _ready = false
let _readyPromise = null

async function ensureProver() {
  if (_ready) return
  if (!_readyPromise) {
    _readyPromise = initProver()
  }
  return _readyPromise
}

async function initProver() {
  const { Noir } = await import('@noir-lang/noir_js')
  const { UltraHonkBackend } = await import('@aztec/bb.js')
  const { cpus } = await import('os')

  const circuitPath = join(__dirname, '..', 'circuits', 'target', 'aegis.json')
  const circuit = JSON.parse(readFileSync(circuitPath, 'utf-8'))
  circuit.bytecode = normalizeBase64(circuit.bytecode)

  _noir = new Noir(circuit)
  _backend = new UltraHonkBackend(
    circuit.bytecode,
    { threads: Math.max(1, cpus().length - 1) }
  )

  console.log('[prover] Warming CRS...')
  await _backend.instantiate()
  _ready = true
  console.log('[prover] Ready')
}

function health(_req, res) {
  res.json({ status: _ready ? 'ready' : 'warming', ready: _ready })
}

app.get('/health', health)
app.get('/zk/health', health)

app.post('/zk/prove', async (req, res) => {
  try {
    const { inputs } = req.body
    if (!inputs) {
      return res.status(400).json({ success: false, error: 'Missing inputs' })
    }

    await ensureProver()
    const start = Date.now()

    const { witness, returnValue } = await _noir.execute(inputs)
    const proofResult = await _backend.generateProof(witness)
    const { proof } = proofResult

    const nullifier = typeof returnValue === 'string' ? returnValue : String(returnValue)

    console.log(`[prover] Proof generated in ${((Date.now() - start) / 1000).toFixed(1)}s`)

    res.json({
      success: true,
      proof: Buffer.from(proof).toString('hex'),
      nullifier,
    })
  } catch (err) {
    console.error('[prover] Error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Ranking API ─────────────────────────────────────────────────
// Issue #151: Expose ranking data through the server so period filtering
// can be applied. Currently the contract returns all-time rankings only;
// when the contract adds per-period data, the server can pass the period
// through to the contract call.
const RANKING_CACHE_TTL = 30_000
let _rankingCache = null
let _rankingCacheTime = 0

async function fetchRankingFromContract() {
  const now = Date.now()
  if (_rankingCache && now - _rankingCacheTime < RANKING_CACHE_TTL) {
    return _rankingCache
  }
  const { Contract, TransactionBuilder, Operation, rpc, Networks, Keypair, Account, BASE_FEE, scValToNative } = await import('@stellar/stellar-sdk')
  const serverRpc = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })
  const sourceAddress = Keypair.random().publicKey()
  const source = new Account(sourceAddress, '0')
  const sorobanContract = new Contract(CONTRACT_ID)
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(sorobanContract.call('get_ranking'))
    .setTimeout(30)
    .build()
  const sim = await serverRpc.simulateTransaction(tx)
  if (!sim.result) return []
  const raw = scValToNative(sim.result.retval)
  const entries = Array.isArray(raw) ? raw : []
  _rankingCache = entries
  _rankingCacheTime = now
  return entries
}

app.get('/api/ranking', async (req, res) => {
  try {
    const { period = 'All Time', limit = '50' } = req.query
    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200)
    const entries = await fetchRankingFromContract()
    const sorted = entries
      .filter(e => e && typeof e.responder === 'string' && Number.isFinite(e.total_arrivals))
      .sort((a, b) => b.total_arrivals - a.total_arrivals)
      .slice(0, maxLimit)
    res.json({ period, entries: sorted })
  } catch (err) {
    console.error('[ranking] Error:', err.message || err)
    res.status(500).json({ error: 'Failed to fetch ranking' })
  }
})

// ── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler)

// Only listen when run directly, not when imported for testing
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('/index.js') || process.argv[1].endsWith('\\index.js')
)

if (isDirectRun || process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`ZK Prover on http://localhost:${PORT}`)
    ensureProver().catch(err => console.error('[prover] Init failed:', err))
  })
}

export { app }
