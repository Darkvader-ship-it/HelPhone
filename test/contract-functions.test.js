import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Issue #107 — unit tests for src/lib/contract.js transaction flows
// (`createRequest` is the emergency-submission path, `resolveRequest` the
// emergency-resolution path).
//
// The Stellar SDK is partially mocked: only the Soroban RPC client
// (`rpc.Server`) and `rpc.assembleTransaction` are replaced, so transactions
// are really built with the production TransactionBuilder/Operation code and
// only the network round-trips (simulate → sign → submit → poll) are faked.
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({ servers: [] }))

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal()

  // Capturing fake RPC client — every method contract.js touches is a vi.fn.
  class Server {
    constructor(url, opts) {
      this.url = url
      this.opts = opts
      this.simulateTransaction = vi.fn()
      this.getAccount = vi.fn()
      this.sendTransaction = vi.fn()
      this.getTransaction = vi.fn()
      state.servers.push(this)
    }
  }

  // Pass the already-built transaction through unchanged so signing/parsing
  // below exercises real XDR instead of fabricated strings.
  function assembleTransaction(rawTx) {
    return { build: () => rawTx }
  }

  return {
    ...actual,
    rpc: { ...actual.rpc, Server, assembleTransaction },
  }
})

import {
  Keypair,
  Account,
  nativeToScVal,
} from '@stellar/stellar-sdk'
import {
  createRequest,
  resolveRequest,
  getRequestCount,
} from '../src/lib/contract.js'

const TX_HASH = 'abc123hash'

// Valid G... address generated with the real SDK (needed for address-typed
// contract arguments).
const REQUESTER = Keypair.random().publicKey()

function makeWallet() {
  return {
    // Pretend-signed echo: sendWrite re-parses the returned XDR as a
    // Transaction, so echoing the unsigned envelope keeps that parse real.
    signTransaction: vi.fn(async (xdr) => xdr),
  }
}

function mockSuccessfulSubmit({ returnValue } = {}) {
  const server = state.servers.at(-1)
  server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
  server.simulateTransaction.mockResolvedValue({})
  server.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: TX_HASH })
  server.getTransaction.mockResolvedValue({
    status: 'SUCCESS',
    hash: TX_HASH,
    ...(returnValue !== undefined ? { returnValue } : {}),
  })
  return server
}

describe('contract.js — transaction submission and resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('createRequest builds, simulates, signs and confirms an emergency request', async () => {
    const server = mockSuccessfulSubmit({
      returnValue: nativeToScVal(7n, { type: 'u64' }),
    })

    const wallet = makeWallet()
    const result = await createRequest(
      REQUESTER, 52.52, 13.405, 'fire', 'nick', 'contact', wallet
    )

    expect(result).toEqual({ requestId: 7, hash: TX_HASH })
    expect(wallet.signTransaction).toHaveBeenCalledTimes(1)

    // Transaction building: one invoke_contract_function operation was simulated.
    const tx = server.simulateTransaction.mock.calls[0][0]
    expect(tx.operations).toHaveLength(1)
    expect(tx.operations[0].type).toBe('invoke_contract_function')

    expect(server.sendTransaction).toHaveBeenCalledTimes(1)
    expect(server.getTransaction).toHaveBeenCalledWith(TX_HASH)
  })

  it('resolveRequest submits and confirms resolution of an emergency', async () => {
    const server = mockSuccessfulSubmit()

    await expect(
      resolveRequest(REQUESTER, 42, makeWallet())
    ).resolves.toBeUndefined()

    expect(server.simulateTransaction).toHaveBeenCalledTimes(1)
    expect(server.sendTransaction).toHaveBeenCalledTimes(1)
    expect(server.getTransaction).toHaveBeenCalledWith(TX_HASH)
  })

  it('maps simulation contract errors to friendly messages without retrying', async () => {
    const server = state.servers.at(-1)
    server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
    server.simulateTransaction.mockResolvedValue({
      error: 'Error(Contract, #2)',
    })

    const err = await createRequest(
      REQUESTER, 52.52, 13.405, 'fire', 'nick', 'contact', makeWallet()
    ).catch((e) => e)

    expect(err.message).toBe('This wallet is not authorized for that action.')
    expect(err.contractCode).toBe(2)
    // Contract logic errors are deterministic — never retried.
    expect(server.simulateTransaction).toHaveBeenCalledTimes(1)
    expect(server.sendTransaction).not.toHaveBeenCalled()
  })

  it('surfaces friendly errors for failed emergency resolution', async () => {
    const server = state.servers.at(-1)
    server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
    server.simulateTransaction.mockResolvedValue({
      error: 'Error(Contract, #2)',
    })

    const err = await resolveRequest(REQUESTER, 42, makeWallet()).catch((e) => e)

    expect(err.message).toBe('Only the requester can resolve this request.')
    expect(err.contractCode).toBe(2)
  })

  it('retries transient RPC failures and succeeds on a later attempt', async () => {
    vi.useFakeTimers()
    const server = state.servers.at(-1)
    server.simulateTransaction
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({
        result: { retval: nativeToScVal(42n, { type: 'u64' }) },
      })

    const pending = getRequestCount()
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(pending).resolves.toBe(42)
    expect(server.simulateTransaction).toHaveBeenCalledTimes(3)
  })

  it('gives up after three attempts when the RPC stays unreachable', async () => {
    vi.useFakeTimers()
    const server = state.servers.at(-1)
    server.simulateTransaction.mockRejectedValue(new Error('Failed to fetch'))

    const pending = expect(getRequestCount()).rejects.toThrow(
      'Reading from contract failed after 3 attempts due to network congestion'
    )
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await pending
    expect(server.simulateTransaction).toHaveBeenCalledTimes(3)
  })

  it('throws when the submitted transaction ends in ERROR status', async () => {
    const server = state.servers.at(-1)
    server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
    server.simulateTransaction.mockResolvedValue({})
    server.sendTransaction.mockResolvedValue({
      status: 'ERROR',
      errorResult: { result: { code: -1 } },
    })

    await expect(
      resolveRequest(REQUESTER, 42, makeWallet())
    ).rejects.toThrow('-1')
    expect(server.getTransaction).not.toHaveBeenCalled()
  })

  it('throws when the polled transaction fails on-chain', async () => {
    const server = state.servers.at(-1)
    server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
    server.simulateTransaction.mockResolvedValue({})
    server.sendTransaction.mockResolvedValue({
      status: 'PENDING',
      hash: TX_HASH,
    })
    server.getTransaction.mockResolvedValue({ status: 'FAILED' })

    await expect(
      resolveRequest(REQUESTER, 42, makeWallet())
    ).rejects.toThrow('Transaction failed')
  })

  it('times out when the transaction never confirms', async () => {
    vi.useFakeTimers()
    const server = state.servers.at(-1)
    server.getAccount.mockResolvedValue(new Account(REQUESTER, '100'))
    server.simulateTransaction.mockResolvedValue({})
    server.sendTransaction.mockResolvedValue({
      status: 'PENDING',
      hash: TX_HASH,
    })
    server.getTransaction.mockResolvedValue({ status: 'PENDING' })

    const pending = expect(
      resolveRequest(REQUESTER, 42, makeWallet())
    ).rejects.toThrow('Transaction timed out')
    for (let i = 0; i < 31; i++) {
      await vi.advanceTimersByTimeAsync(1000)
    }
    await pending
  })
})
