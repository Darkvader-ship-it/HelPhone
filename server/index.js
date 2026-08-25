import express from 'express'
import cors from 'cors'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { rpc } from '@stellar/stellar-sdk'

import { normalizeBase64 } from './base64Utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
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

setInterval(pollContractEvents, EVENT_POLL_MS)

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

app.listen(PORT, () => {
  console.log(`ZK Prover on http://localhost:${PORT}`)
  ensureProver().catch(err => console.error('[prover] Init failed:', err))
})
