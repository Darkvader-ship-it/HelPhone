import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ---------------------------------------------------------------------------
// Issue #106 — sanity test for the Vitest + jsdom + React Testing Library
// setup. If this suite passes, the runner, DOM environment, and component
// rendering pipeline are all wired correctly.
// ---------------------------------------------------------------------------

function SanityComponent() {
  return <h1>HelPhone test harness</h1>
}

describe('test framework sanity', () => {
  it('runs inside a jsdom environment', () => {
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })

  it('renders a React component with Testing Library matchers', () => {
    render(<SanityComponent />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'HelPhone test harness'
    )
  })
})
