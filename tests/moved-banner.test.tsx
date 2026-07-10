import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MovedBanner } from '@/components/layout/moved-banner'

describe('MovedBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    // Fake ONLY Date so React's effect scheduler (timers/microtasks) stays real.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z')) // inside the transition window
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('shows the move notice on first render and marks it seen on first paint', () => {
    render(<MovedBanner />)
    expect(screen.getByText(/app\.glidepathops\.com/)).toBeTruthy()
    expect(localStorage.getItem('glidepath-moved-notice-seen')).toBeTruthy()
  })

  it('does not render again once the seen flag is set (no per-open spam)', () => {
    localStorage.setItem('glidepath-moved-notice-seen', 'x')
    const { container } = render(<MovedBanner />)
    expect(container.textContent).toBe('')
  })

  it('hides when dismissed with the × button', () => {
    render(<MovedBanner />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(/app\.glidepathops\.com/)).toBeNull()
  })

  it('stays hidden after the transition window closes', () => {
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z')) // past HIDE_AFTER
    const { container } = render(<MovedBanner />)
    expect(container.textContent).toBe('')
    expect(localStorage.getItem('glidepath-moved-notice-seen')).toBeNull()
  })
})
