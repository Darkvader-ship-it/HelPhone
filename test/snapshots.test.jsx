import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Help from '../src/pages/Help.jsx'
import Ranking from '../src/pages/Ranking.jsx'

/**
 * Snapshot tests for UI components
 * 
 * These tests capture the rendered HTML output and detect unintended changes.
 * When components are intentionally modified, update snapshots with:
 * npm run test:update-snapshots
 */

describe('Component Snapshots', () => {
  describe('Help Page', () => {
    it('should match snapshot', () => {
      const { container } = render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('Ranking Page', () => {
    it('should match snapshot', () => {
      const { container } = render(
        <BrowserRouter>
          <Ranking />
        </BrowserRouter>
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})

/**
 * TODO: Add snapshot tests for shared UI components when they are created
 * 
 * Example structure for future shared components:
 * 
 * describe('Button Component', () => {
 *   it('should match snapshot for primary variant', () => {
 *     const { container } = render(<Button variant="primary">Click me</Button>)
 *     expect(container.firstChild).toMatchSnapshot()
 *   })
 *   
 *   it('should match snapshot for secondary variant', () => {
 *     const { container } = render(<Button variant="secondary">Click me</Button>)
 *     expect(container.firstChild).toMatchSnapshot()
 *   })
 * })
 * 
 * describe('Modal Component', () => {
 *   it('should match snapshot when open', () => {
 *     const { container } = render(<Modal isOpen={true} title="Test">Content</Modal>)
 *     expect(container.firstChild).toMatchSnapshot()
 *   })
 * })
 */
