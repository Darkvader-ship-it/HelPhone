import {
  rpc, Contract, TransactionBuilder, Operation, Transaction, Account, Keypair,
  nativeToScVal, scValToNative, Networks, BASE_FEE,
} from '@stellar/stellar-sdk'

const DEFAULT_CONTRACT_ID = 'CDP5XZ7UYCGSQBYRDYM2OEAUQJULBZPULSQXK7LGNAJTRXRG3VHZLSHY'
const CONTRACT_ID = import.meta.env?.VITE_HELPHONE_CONTRACT_ID || DEFAULT_CONTRACT_ID
const RPC_URL = 'https://soroban-testnet.stellar.org'
const DEFAULT_FRIENDBOT_URL = 'https://friendbot.stellar.org'
const FRIENDBOT_URL = import.meta.env?.VITE_FRIENDBOT_URL || DEFAULT_FRIENDBOT_URL
const NETWORK = Networks.TESTNET

const server = new rpc.Server(RPC_URL, { timeout: 30_000 })
const contract = new Contract(CONTRACT_ID)

// ── Coordinate encoding ─────────────────────────────────────────
// The contract stores lat/lng as fixed-point i32: degrees * COORD_SCALE.
const COORD_SCALE = 1_000_000
const LAT_MIN = -90
const LAT_MAX = 90
const LNG_MIN = -180
const LNG_MAX = 180
const LNG_SPAN = LNG_MAX - LNG_MIN
// Bounds of the on-chain i32 the scaled value has to fit into.
const I32_MIN = -2_147_483_648
const I32_MAX = 2_147_483_647

/** Safely convert a Soroban contract value to a JavaScript number without precision loss.
 *  Handles BigInt, number, and string inputs. Returns NaN for unconvertible values. */
function safeToNumber(val) {
  if (typeof val === 'number') return val
  if (typeof val === 'bigint') {
    if (val > BigInt(Number.MAX_SAFE_INTEGER) || val < BigInt(-Number.MAX_SAFE_INTEGER)) {
      return NaN
    }
    return Number(val)
  }
  if (typeof val === 'string') return Number(val)
  return NaN
}

/** Clamp a value into an inclusive range. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Wrap a longitude value into [LNG_MIN, LNG_MAX]. */
function clampLng(lng) {
  if (lng < LNG_MIN || lng > LNG_MAX) {
    return ((lng - LNG_MIN) % LNG_SPAN + LNG_SPAN) % LNG_SPAN + LNG_MIN
  }
  return lng
}

/** Decode an on-chain fixed-point coordinate into degrees. NaN if unconvertible. */
function decodeCoord(raw) {
  const num = safeToNumber(raw)
  return Number.isFinite(num) ? num / COORD_SCALE : NaN
}

/** Decode + clamp a latitude, or null when the raw value is unusable. */
function decodeLat(raw) {
  const lat = decodeCoord(raw)
  return Number.isFinite(lat) ? clamp(lat, LAT_MIN, LAT_MAX) : null
}

/** Decode + wrap a longitude, or null when the raw value is unusable. */
function decodeLng(raw) {
  const lng = decodeCoord(raw)
  return Number.isFinite(lng) ? clampLng(lng) : null
}

/** Encode degrees into the fixed-point i32 the contract expects.
 *  Throws instead of silently writing a value the contract would truncate. */
function encodeCoord(value, label) {
  const scaled = Math.round(guardNaN(value, label) * COORD_SCALE)
  if (scaled < I32_MIN || scaled > I32_MAX) {
    throw new Error(`${label} is outside the range the contract can store (got ${value})`)
  }
  return scaled
}

// Dummy source for read-only simulations. TransactionBuilder.build() increments the
// source account's sequence number, so a single shared Account drifts once more than
// one read has run. Each simulation gets a fresh Account pinned to sequence 0 instead;
// the keypair is generated lazily so importing this module never touches crypto.
const READ_SOURCE_SEQUENCE = '0'
let _readSourceAddress = null

function _readSource() {
  if (!_readSourceAddress) _readSourceAddress = Keypair.random().publicKey()
  return new Account(_readSourceAddress, READ_SOURCE_SEQUENCE)
}

function normalizeBase64(input, label = 'Base64 value') {
  if (typeof input !== 'string') {
    throw new Error(`${label} must be a string.`)
  }

  let value = input.trim()
  const commaIndex = value.indexOf(',')
  if (commaIndex !== -1 && /^data:.*;base64/i.test(value.slice(0, commaIndex))) {
    value = value.slice(commaIndex + 1)
  }

  value = value
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error(`${label} contains invalid Base64 characters.`)
  }

  const remainder = value.length % 4
  if (remainder === 1) {
    throw new Error(`${label} has an invalid Base64 length.`)
  }
  if (remainder > 0) {
    value += '='.repeat(4 - remainder)
  }

  return value
}

function scv(val, opts) {
  return nativeToScVal(val, opts)
}

function mapRequest(raw) {
  const STATUS = ['Pending', 'Enroute', 'Resolved', 'Cancelled']
  return {
    id: raw.id ? safeToNumber(raw.id) : raw.id,
    requester: raw.requester,
    lat: decodeLat(raw.lat),
    lng: decodeLng(raw.lng),
    emergency_type: raw.emergency_type,
    nickname: raw.nickname,
    contact: raw.contact,
    status: STATUS[raw.status] ?? (Array.isArray(raw.status) ? raw.status[0] : raw.status),
    created_at: safeToNumber(raw.created_at),
    resolved_at: raw.resolved_at ? safeToNumber(raw.resolved_at) : null,
  }
}

function mapResponder(raw) {
  return {
    responder: raw.responder,
    lat: decodeLat(raw.lat),
    lng: decodeLng(raw.lng),
    eta_seconds: raw.eta_seconds,
    arrived: raw.arrived,
    responded_at: safeToNumber(raw.responded_at),
  }
}

// ── Read helper ─────────────────────────────────────────────────
async function simulateRead(call) {
  const tx = new TransactionBuilder(_readSource(), { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(call)
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  return sim
}

async function resolveWalletAddress(wallet, fallback = '') {
  if (fallback) return fallback
  if (wallet?.account?.address) return wallet.account.address
  if (typeof wallet?.getAddress === 'function') {
    const { address } = await wallet.getAddress()
    return address || ''
  }
  if (typeof wallet?.fetchAddress === 'function') {
    const { address } = await wallet.fetchAddress()
    return address || ''
  }
  return ''
}

// ── Reads (no wallet needed) ───────────────────────────────────

export async function getRequest(requestId) {
  const sim = await simulateRead(
    contract.call('get_request', scv(Number(requestId), { type: 'u64' }))
  )
  if (!sim.result) return null
  const raw = scValToNative(sim.result.retval)
  return raw ? mapRequest(raw) : null
}

export async function getResponder(requestId, index) {
  const sim = await simulateRead(
    contract.call('get_responder',
      scv(Number(requestId), { type: 'u64' }),
      scv(Number(index), { type: 'u32' })
    )
  )
  if (!sim.result) return null
  const raw = scValToNative(sim.result.retval)
  return raw ? { id: `${requestId}-${index}`, ...mapResponder(raw) } : null
}

export async function getActiveRequests(max = 500) {
  const sim = await simulateRead(
    contract.call('get_active_requests')
  )
  if (!sim.result) return []
  const rawIds = scValToNative(sim.result.retval)
  return rawIds.map(id => safeToNumber(id)).slice(0, max)
}

export async function getRequestCount() {
  const sim = await simulateRead(contract.call('get_request_count'))
  if (!sim.result) return 0
  return safeToNumber(scValToNative(sim.result.retval))
}

export async function getResponderCount(requestId) {
  const sim = await simulateRead(
    contract.call('get_responder_count', scv(Number(requestId), { type: 'u64' }))
  )
  if (!sim.result) return 0
  return scValToNative(sim.result.retval)
}

export async function getRanking(limit = 50) {
  const sim = await simulateRead(
    contract.call('get_ranking')
  )
  if (!sim.result) return []
  return scValToNative(sim.result.retval).slice(0, limit)
}

export async function getExpertVerifications(walletAddress, limit = 10) {
  if (!walletAddress) return []
  const sim = await simulateRead(
    contract.call(
      'get_expert_verifications',
      scv(walletAddress, { type: 'address' }),
      scv(Number(limit), { type: 'u32' })
    )
  )
  if (!sim.result) return []
  return scValToNative(sim.result.retval) || []
}

export async function checkAccount(address) {
  if (!address) return false
  try {
    // rpc.Server.getAccount returns Account (sequence only, no balances).
    // Throws NotFoundError if account doesn't exist / isn't funded.
    await server.getAccount(address)
    return true
  } catch {
    return false
  }
}

/** Build the friendbot funding URL for an address.
 *  Uses the URL API so an override that already carries a path, a trailing slash or
 *  its own query string still yields a well-formed request in every browser, rather
 *  than the `?` concatenation that only worked for the bare default host. */
function friendbotUrl(address) {
  try {
    const url = new URL(FRIENDBOT_URL)
    url.searchParams.set('addr', address)
    return url.toString()
  } catch {
    const separator = FRIENDBOT_URL.includes('?') ? '&' : '?'
    return `${FRIENDBOT_URL}${separator}addr=${encodeURIComponent(address)}`
  }
}

export async function ensureAccountFunded(address) {
  if (!address) throw new Error('Wallet address is not available yet')
  if (await checkAccount(address)) return true

  const res = await fetch(friendbotUrl(address))
  if (!res.ok) {
    let message = 'Could not fund Stellar testnet account'
    try {
      const data = await res.json()
      message = data.detail || data.title || data.error || message
    } catch {}
    throw new Error(message)
  }

  for (let i = 0; i < 12; i++) {
    if (await checkAccount(address)) return true
    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error('Testnet funding was requested but account is not available yet')
}

// ── Aegis Vault — ZK location proof + aid claim ───────────────
const AEGIS_VAULT_ID = import.meta.env?.VITE_AEGIS_VAULT_ID || ''

export async function claimAid(recipient, publicInputsBytes, proofBytes, wallet) {
  if (!AEGIS_VAULT_ID) throw new Error('VITE_AEGIS_VAULT_ID not configured — deploy aegis_vault first')
  const signerAddress = await resolveWalletAddress(wallet)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: AEGIS_VAULT_ID,
      function: 'claim_aid',
      args: [
        scv(recipient, { type: 'address' }),
        nativeToScVal(publicInputsBytes instanceof Uint8Array ? publicInputsBytes : new Uint8Array(publicInputsBytes)),
        nativeToScVal(proofBytes instanceof Uint8Array ? proofBytes : new Uint8Array(proofBytes)),
      ],
    }))
    .setTimeout(60)
    .build()
  return await sendWrite(tx, wallet, 'claim_aid')
}

export async function fundZone(publicInputsPrefix, amount, wallet) {
  if (!AEGIS_VAULT_ID) throw new Error('VITE_AEGIS_VAULT_ID not configured — deploy aegis_vault first')
  const signerAddress = await resolveWalletAddress(wallet)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: AEGIS_VAULT_ID,
      function: 'fund_zone',
      args: [
        scv(signerAddress, { type: 'address' }),
        nativeToScVal(publicInputsPrefix instanceof Uint8Array ? publicInputsPrefix : new Uint8Array(publicInputsPrefix)),
        scv(BigInt(amount), { type: 'i128' }),
      ],
    }))
    .setTimeout(60)
    .build()
  return await sendWrite(tx, wallet, 'fund_zone')
}

// ── Writes (require wallet) ────────────────────────────────────

const CONTRACT_ERROR_MESSAGES = {
  create_request: {
    1: 'Request was not found.',
    2: 'This wallet is not authorized for that action.',
  },
  accept_request: {
    1: 'This request was not found.',
    2: 'This wallet is not authorized to help with this request.',
    3: 'This request is no longer pending. Someone else may already be on the way.',
  },
  mark_arrived: {
    1: 'This request or responder was not found.',
    2: 'This wallet is not authorized to mark arrival.',
    4: 'You already marked yourself as arrived.',
  },
  resolve_request: {
    1: 'This request was not found.',
    2: 'Only the requester can resolve this request.',
    3: 'This request can only be resolved once a responder is on the way.',
  },
  cancel_request: {
    1: 'This request was not found.',
    2: 'Only the requester can cancel this request.',
    3: 'This request can only be cancelled while it is pending.',
  },
  record_expert_verification: {
    2: 'This wallet is not authorized to record the checkpoint.',
  },
}

function parseContractErrorCode(message) {
  const text = String(message || '')
  const match = text.match(/Contract,\s*#(\d+)/i)
  return match ? Number(match[1]) : null
}

function buildContractError(rawError, operation) {
  const raw = typeof rawError === 'string' ? rawError : rawError?.message || JSON.stringify(rawError)
  const contractCode = parseContractErrorCode(raw)
  const friendly = contractCode ? CONTRACT_ERROR_MESSAGES[operation]?.[contractCode] : ''
  const err = new Error(friendly || raw)
  err.contractCode = contractCode
  err.operation = operation
  err.rawMessage = raw
  return err
}

async function sendWrite(rawTx, wallet, operation = '') {
  const sim = await server.simulateTransaction(rawTx)
  if (sim.error) {
    throw buildContractError(sim.error, operation)
  }
  const preparedTx = rpc.assembleTransaction(rawTx, sim, NETWORK).build()
  const signResult = await wallet.signTransaction(preparedTx.toXDR(), { networkPassphrase: NETWORK })
  const signedTxXdr = normalizeBase64(
    typeof signResult === 'string' ? signResult : signResult?.signedTxXdr,
    'Signed Stellar transaction XDR'
  )
  const signedTx = new Transaction(signedTxXdr, NETWORK)
  const response = await server.sendTransaction(signedTx)

  if (response.status === 'ERROR') {
    throw new Error(response.errorResult?.result?.code || 'Transaction error')
  }

  const hash = response.hash
  for (let i = 0; i < 30; i++) {
    const txResult = await server.getTransaction(hash)
    if (txResult.status === 'SUCCESS') {
      return { hash, ...txResult }
    }
    if (txResult.status === 'FAILED') {
      throw new Error('Transaction failed')
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error('Transaction timed out')
}

function guardNaN(val, label) {
  const num = safeToNumber(val)
  if (!Number.isFinite(num)) {
    throw new Error(`${label} is invalid (got ${JSON.stringify(val)})`)
  }
  return num
}

export async function createRequest(requester, lat, lng, emergencyType, nickname, contact, wallet) {
  const signerAddress = await resolveWalletAddress(wallet, requester)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'create_request',
      args: [
        scv(requester, { type: 'address' }),
        scv(encodeCoord(lat, 'lat'), { type: 'i32' }),
        scv(encodeCoord(lng, 'lng'), { type: 'i32' }),
        scv(emergencyType, { type: 'string' }),
        scv(nickname, { type: 'string' }),
        scv(contact, { type: 'string' }),
      ],
    }))
    .setTimeout(30)
    .build()

  const result = await sendWrite(tx, wallet, 'create_request')
  const retval = scValToNative(result.returnValue)
  return { requestId: safeToNumber(retval), hash: result.hash }
}

export async function acceptRequest(responder, requestId, lat, lng, etaSeconds, wallet) {
  const signerAddress = await resolveWalletAddress(wallet, responder)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'accept_request',
      args: [
        scv(responder, { type: 'address' }),
        scv(guardNaN(Number(requestId), 'requestId'), { type: 'u64' }),
        scv(encodeCoord(lat, 'lat'), { type: 'i32' }),
        scv(encodeCoord(lng, 'lng'), { type: 'i32' }),
        scv(guardNaN(Number(etaSeconds), 'etaSeconds'), { type: 'u32' }),
      ],
    }))
    .setTimeout(30)
    .build()

  const result = await sendWrite(tx, wallet, 'accept_request')
  const retval = scValToNative(result.returnValue)
  return { index: safeToNumber(retval), hash: result.hash }
}

export async function markArrived(responder, requestId, wallet) {
  const signerAddress = await resolveWalletAddress(wallet, responder)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'mark_arrived',
      args: [
        scv(responder, { type: 'address' }),
        scv(Number(requestId), { type: 'u64' }),
      ],
    }))
    .setTimeout(30)
    .build()

  return await sendWrite(tx, wallet, 'mark_arrived')
}

let trackingKeypair = null
let trackingAccount = null

async function getTrackingSigner() {
  if (trackingKeypair && trackingAccount) return { keypair: trackingKeypair, account: trackingAccount }
  trackingKeypair = Keypair.random()
  const addr = trackingKeypair.publicKey()
  await ensureAccountFunded(addr)
  trackingAccount = await server.getAccount(addr)
  return { keypair: trackingKeypair, account: trackingAccount }
}

export async function updateLocation(responder, requestId, lat, lng) {
  const { keypair, account } = await getTrackingSigner()
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'update_location',
      args: [
        scv(responder, { type: 'address' }),
        scv(Number(requestId), { type: 'u64' }),
        scv(encodeCoord(lat, 'lat'), { type: 'i32' }),
        scv(encodeCoord(lng, 'lng'), { type: 'i32' }),
      ],
    }))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  const preparedTx = rpc.assembleTransaction(tx, sim, NETWORK).build()
  preparedTx.sign(keypair)
  const response = await server.sendTransaction(preparedTx)

  if (response.status === 'ERROR') {
    throw new Error(response.errorResult?.result?.code || 'Tracking transaction error')
  }

  const hash = response.hash
  for (let i = 0; i < 20; i++) {
    const txResult = await server.getTransaction(hash)
    if (txResult.status === 'SUCCESS') return
    if (txResult.status === 'FAILED') throw new Error('Tracking tx failed')
    await new Promise(r => setTimeout(r, 1000))
  }
}

export async function resolveRequest(requester, requestId, wallet) {
  const signerAddress = await resolveWalletAddress(wallet, requester)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'resolve_request',
      args: [
        scv(requester, { type: 'address' }),
        scv(Number(requestId), { type: 'u64' }),
      ],
    }))
    .setTimeout(30)
    .build()

  await sendWrite(tx, wallet, 'resolve_request')
}

export async function cancelRequest(requester, requestId, wallet) {
  const signerAddress = await resolveWalletAddress(wallet, requester)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'cancel_request',
      args: [
        scv(requester, { type: 'address' }),
        scv(Number(requestId), { type: 'u64' }),
      ],
    }))
    .setTimeout(30)
    .build()

  await sendWrite(tx, wallet, 'cancel_request')
}

export async function recordExpertVerification(walletAddress, action, txHash, proofFingerprint, wallet) {
  if (!walletAddress) throw new Error('Wallet address is not available yet')
  const signerAddress = await resolveWalletAddress(wallet, walletAddress)
  if (!signerAddress) throw new Error('Wallet address is not available yet')
  await ensureAccountFunded(signerAddress)
  const account = await server.getAccount(signerAddress)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({
      contract: CONTRACT_ID,
      function: 'record_expert_verification',
      args: [
        scv(signerAddress, { type: 'address' }),
        scv(action, { type: 'string' }),
        scv(txHash || '', { type: 'string' }),
        scv(proofFingerprint || '', { type: 'string' }),
      ],
    }))
    .setTimeout(30)
    .build()

  return await sendWrite(tx, wallet, 'record_expert_verification')
}
