import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ---------------------------------------------------------------------------
// Issue #129 — Automated Accessibility Testing (E2E)
//
// Uses @axe-core/playwright to scan pages for WCAG 2.1 violations during
// E2E testing. Tests fail when critical or serious violations are found.
// ---------------------------------------------------------------------------

test.describe('Accessibility — Landing page', () => {
  test('has no critical or serious WCAG violations', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v => v.impact === 'critical')
    const serious = results.violations.filter(v => v.impact === 'serious')

    if (critical.length > 0) {
      console.error('Critical a11y violations:', critical.map(v => `${v.id}: ${v.description}`))
    }
    if (serious.length > 0) {
      console.error('Serious a11y violations:', serious.map(v => `${v.id}: ${v.description}`))
    }

    expect(critical).toHaveLength(0)
    expect(serious).toHaveLength(0)
  })

  test('has no color contrast violations', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .include('body')
      .withRules(['color-contrast'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })

  test('has no missing form labels', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })

  test('has valid landmark regions', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withRules(['landmark-unique', 'region'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})

test.describe('Accessibility — Help page', () => {
  test('has no critical or serious WCAG violations', async ({ page }) => {
    await page.goto('/help')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v => v.impact === 'critical')
    const serious = results.violations.filter(v => v.impact === 'serious')

    if (critical.length > 0) {
      console.error('Critical a11y violations:', critical.map(v => `${v.id}: ${v.description}`))
    }
    if (serious.length > 0) {
      console.error('Serious a11y violations:', serious.map(v => `${v.id}: ${v.description}`))
    }

    expect(critical).toHaveLength(0)
    expect(serious).toHaveLength(0)
  })

  test('has no missing alt text on images', async ({ page }) => {
    await page.goto('/help')

    const results = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })

  test('has no duplicate IDs', async ({ page }) => {
    await page.goto('/help')

    const results = await new AxeBuilder({ page })
      .withRules(['duplicate-id'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/help')

    const results = await new AxeBuilder({ page })
      .withRules(['focusable-content', 'tabindex'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})

test.describe('Accessibility — Ranking page', () => {
  test('has no critical or serious WCAG violations', async ({ page }) => {
    await page.goto('/ranking')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v => v.impact === 'critical')
    const serious = results.violations.filter(v => v.impact === 'serious')

    expect(critical).toHaveLength(0)
    expect(serious).toHaveLength(0)
  })

  test('data tables have proper headers', async ({ page }) => {
    await page.goto('/ranking')

    const results = await new AxeBuilder({ page })
      .withRules(['td-headers-attr', 'th-has-data-cells'])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})

test.describe('Accessibility — All pages snapshot', () => {
  const pages = ['/', '/help', '/ranking']

  for (const path of pages) {
    test(`full WCAG scan on ${path}`, async ({ page }) => {
      await page.goto(path)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Report all violations for debugging
      for (const violation of results.violations) {
        const help = violation.helpUrl ? ` (${violation.helpUrl})` : ''
        console.warn(
          `[a11y] ${violation.impact}: ${violation.id} — ${violation.description}${help}`,
        )
      }

      // Fail on critical violations only (serious/minor are warnings)
      const critical = results.violations.filter(v => v.impact === 'critical')
      expect(critical).toHaveLength(0)
    })
  }
})
