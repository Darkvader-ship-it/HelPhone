import { useTranslation } from 'react-i18next'

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
]

interface LanguageSwitcherProps {
  /** Override button styles for use in different nav contexts. */
  style?: React.CSSProperties
}

/**
 * Language switcher UI component.
 *
 * Renders a set of compact toggle buttons — one per supported locale.
 * The active locale button is highlighted. Switching instantly updates
 * all i18next consumers in the tree via the react-i18next context.
 *
 * Additional languages can be enabled by:
 *   1. Adding a /public/locales/<code>/{common,help}.json file
 *   2. Pushing `{ code, label }` into the LANGUAGES array above
 */
export default function LanguageSwitcher({ style }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language

  if (LANGUAGES.length <= 1) {
    // Nothing to switch — hide until a second language is added.
    return null
  }

  return (
    <div
      role="group"
      aria-label="Language selector"
      style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        ...style,
      }}
    >
      {LANGUAGES.map(({ code, label }) => {
        const isActive = currentLang === code
        return (
          <button
            key={code}
            type="button"
            aria-label={`Switch language to ${label}`}
            aria-pressed={isActive}
            onClick={() => i18n.changeLanguage(code)}
            style={{
              padding: '5px 9px',
              borderRadius: '7px',
              border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: isActive ? 'rgba(242,236,220,0.95)' : 'rgba(242,236,220,0.45)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.8px',
              cursor: isActive ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
