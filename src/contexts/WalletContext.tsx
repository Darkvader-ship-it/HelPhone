import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk'
import { KitEventType, Networks, SwkAppDarkTheme } from '@creit-tech/stellar-wallets-kit/types'
import { defaultModules } from '@creit-tech/stellar-wallets-kit/modules/utils'

// ── Wallet icon overrides ─────────────────────────────────────────────────────

const WALLET_ICON_PATHS: Record<string, string> = {
  albedo: '/assets/wallets/albedo.png',
  freighter: '/assets/wallets/freighter.png',
  fordefi: '/assets/wallets/fordefi.png',
  rabet: '/assets/wallets/rabet.png',
  xbull: '/assets/wallets/xbull.png',
  lobstr: '/assets/wallets/lobstr.png',
  hana: '/assets/wallets/hana.png',
  klever: '/assets/wallets/klever.png',
  onekey: '/assets/wallets/onekey.png',
  BitgetWallet: '/assets/wallets/bitget.png',
  cactuslink: '/assets/wallets/cactuslink.png',
}

function buildWalletModules() {
  return defaultModules().map((module) => {
    const iconPath = WALLET_ICON_PATHS[module.productId]
    if (iconPath) module.productIcon = iconPath
    return module
  })
}

// ── Kit initialisation ────────────────────────────────────────────────────────
// Performed once per application lifetime inside the provider's useEffect so
// it is no longer a global side-effect in main.tsx.

function initKit(): void {
  StellarWalletsKit.init({
    modules: buildWalletModules(),
    network: Networks.TESTNET,
    theme: {
      ...SwkAppDarkTheme,
      background: '#1c2c24',
      'background-secondary': '#234B4E',
      'foreground-strong': '#F4ECDC',
      foreground: 'rgba(242,236,220,0.9)',
      'foreground-secondary': 'rgba(242,236,220,0.62)',
      primary: '#7357FF',
      'primary-foreground': '#ffffff',
      border: 'rgba(255,255,255,0.12)',
      shadow: '0 24px 72px rgba(0,0,0,0.58)',
      'border-radius': '0.875rem',
      'font-family': 'Inter, Helvetica Neue, sans-serif',
    },
    authModal: {
      showInstallLabel: true,
      hideUnsupportedWallets: false,
    },
  })
}

// ── Address validation ────────────────────────────────────────────────────────

/**
 * Stellar G-address structural validator.
 * Returns the trimmed address if valid, or an empty string otherwise.
 */
export function sanitizeWalletAddress(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const addr = raw.trim()
  if (!/^G[A-Z2-7]{55}$/.test(addr)) return ''
  return addr
}

// ── Context shape ─────────────────────────────────────────────────────────────

export interface WalletContextValue {
  /** The currently connected Stellar G-address, or empty string if not connected. */
  walletAddress: string
  /** True when a wallet is connected. */
  isConnected: boolean
  /**
   * Opens the wallet auth modal and returns the connected address.
   * Returns "" if the user cancels or the address is invalid.
   * Re-entrant safe — a second call while a modal is already open returns ""
   * without opening a second modal.
   */
  connect(): Promise<string>
  /** Disconnects the active wallet and clears the address. */
  disconnect(): Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState('')
  // Re-entrant guard: prevents two concurrent auth modals from racing.
  const connectionInFlight = useRef(false)

  // Initialise StellarWalletsKit once after mount and subscribe to events.
  useEffect(() => {
    initKit()

    let mounted = true

    // Sync any address that was already set before mount (e.g. hot-reload).
    async function syncWallet() {
      try {
        const { address: raw } = await StellarWalletsKit.getAddress()
        if (mounted) setWalletAddress(sanitizeWalletAddress(raw))
      } catch {
        if (mounted) setWalletAddress('')
      }
    }

    syncWallet()

    const offState = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      if (!mounted) return
      const raw = (event as { payload?: { address?: unknown } })?.payload?.address
      setWalletAddress(sanitizeWalletAddress(raw))
    })

    const offDisconnect = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      if (mounted) setWalletAddress('')
    })

    return () => {
      mounted = false
      offState()
      offDisconnect()
    }
  }, [])

  async function connect(): Promise<string> {
    if (connectionInFlight.current) return ''
    connectionInFlight.current = true
    try {
      // Defer to next macrotask — fixes Safari/Firefox timing on click handlers.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const { address: raw } = await StellarWalletsKit.authModal()
      const address = sanitizeWalletAddress(raw)
      if (address) {
        setWalletAddress(address)
        return address
      }
    } catch {
      // Intentionally silent: wallet-kit rejections can contain cryptographic
      // session material (side-channel risk). Callers treat "" as not connected.
    } finally {
      connectionInFlight.current = false
    }
    return ''
  }

  async function disconnect(): Promise<void> {
    await StellarWalletsKit.disconnect()
    setWalletAddress('')
  }

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the wallet context from any component inside <WalletProvider>.
 * Throws if called outside the provider tree.
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>')
  }
  return ctx
}
