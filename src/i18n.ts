import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * i18next configuration.
 *
 * Translation files live in /public/locales/<lang>/<namespace>.json so they
 * are served as static assets — no bundling overhead and easy to add new
 * locales without a rebuild.
 *
 * Namespaces:
 *   common — landing page (App.tsx)
 *   help   — help/map page (Help.tsx)
 */

const SUPPORTED_LANGUAGES = ['en'] as const
const DEFAULT_LNG = 'en'
const DEFAULT_NS = 'common'

async function loadNamespace(lang: string, ns: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/locales/${lang}/${ns}.json`)
  if (!res.ok) {
    console.warn(`[i18n] Could not load /locales/${lang}/${ns}.json (${res.status})`)
    return {}
  }
  return res.json() as Promise<Record<string, unknown>>
}

// Load all namespaces for the initial language up-front so the app never
// renders with missing keys on first paint.
async function preloadResources(lang: string): Promise<void> {
  const namespaces = ['common', 'help']
  await Promise.all(
    namespaces.map(async (ns) => {
      const data = await loadNamespace(lang, ns)
      i18n.addResourceBundle(lang, ns, data, true, true)
    }),
  )
}

i18n.use(initReactI18next).init({
  lng: DEFAULT_LNG,
  fallbackLng: DEFAULT_LNG,
  defaultNS: DEFAULT_NS,
  ns: ['common', 'help'],

  // Resources are added via addResourceBundle after fetch; start empty.
  resources: {},

  interpolation: {
    escapeValue: false, // React already escapes
  },

  react: {
    useSuspense: false,
  },
})

// Kick off preload — consumers should await i18nReady before first render.
export const i18nReady: Promise<void> = preloadResources(DEFAULT_LNG)

export { SUPPORTED_LANGUAGES, DEFAULT_LNG }
export default i18n
