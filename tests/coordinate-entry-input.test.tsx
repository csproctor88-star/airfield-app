import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CoordinateEntryInput from '@/components/ui/coordinate-entry-input'

// ─── CoordinateEntryInput: manual coordinate entry for /obstructions ───
// Drives the real parser (lib/calculations/coordinates.ts) — no mocking; the
// component's status line and commit-gating are parse-driven, so the tests
// exercise real input strings end to end.

function getInput() {
  return screen.getByRole('textbox') as HTMLInputElement
}

function getButton() {
  return screen.getByRole('button', { name: /place pin/i }) as HTMLButtonElement
}

describe('CoordinateEntryInput', () => {
  it('shows the detected format label + DD preview for valid input and enables the button', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })

    expect(screen.getByText(/DD → 42.60522, -82.82047/)).toBeTruthy()
    expect(getButton().disabled).toBe(false)
  })

  it('shows the format label for a detected MGRS grid reference', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} />)
    fireEvent.change(getInput(), { target: { value: '17TLH5066718582' } })

    expect(screen.getByText(/^MGRS →/)).toBeTruthy()
    expect(getButton().disabled).toBe(false)
  })

  it('shows the parser error line for invalid (but structurally complete) input and keeps the button disabled', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, 200' } })

    expect(screen.getByText('Longitude out of range (-180 to 180)')).toBeTruthy()
    expect(getButton().disabled).toBe(true)
  })

  it('shows a muted per-format example hint (not a hard error) while the user is still mid-entry', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} />)
    // Only one coordinate group typed so far — parser returns the generic
    // "enter both" result, not a specific validation failure.
    fireEvent.change(getInput(), { target: { value: '42.6' } })

    expect(screen.getByText(/^Try:/)).toBeTruthy()
    expect(screen.queryByText('Enter both a latitude and a longitude')).toBeNull()
    expect(getButton().disabled).toBe(true)
  })

  it('hides the hint/status line entirely when the field is empty', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} />)
    expect(screen.queryByText(/^Try:/)).toBeNull()
    expect(getButton().disabled).toBe(true)
  })

  it('fires onPoint with the parsed LatLon on Enter', () => {
    const onPoint = vi.fn()
    render(<CoordinateEntryInput onPoint={onPoint} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(onPoint).toHaveBeenCalledTimes(1)
    const [point, meta] = onPoint.mock.calls[0]
    expect(point.lat).toBeCloseTo(42.60522, 5)
    expect(point.lon).toBeCloseTo(-82.82047, 5)
    expect(meta).toEqual({ format: 'dd' })
  })

  it('fires onPoint with the parsed LatLon on button click', () => {
    const onPoint = vi.fn()
    render(<CoordinateEntryInput onPoint={onPoint} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })
    fireEvent.click(getButton())

    expect(onPoint).toHaveBeenCalledTimes(1)
    expect(onPoint.mock.calls[0][1]).toEqual({ format: 'dd' })
  })

  it('re-disables the button after commit until the text changes', () => {
    const onPoint = vi.fn()
    render(<CoordinateEntryInput onPoint={onPoint} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })

    fireEvent.click(getButton())
    expect(onPoint).toHaveBeenCalledTimes(1)
    expect(getButton().disabled).toBe(true)

    // Clicking again with unchanged text must not re-fire.
    fireEvent.click(getButton())
    expect(onPoint).toHaveBeenCalledTimes(1)

    // Editing the text re-enables the button.
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.820471' } })
    expect(getButton().disabled).toBe(false)
  })

  it('calls onPoint with fresh object instances (equal values) on repeated commits', () => {
    const onPoint = vi.fn()
    render(<CoordinateEntryInput onPoint={onPoint} />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })
    fireEvent.click(getButton())

    // Nudge the text with a trailing zero — identical numeric value, but a
    // different string, so the button re-enables for a second commit.
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.820470' } })
    expect(getButton().disabled).toBe(false)
    fireEvent.click(getButton())

    expect(onPoint).toHaveBeenCalledTimes(2)
    const first = onPoint.mock.calls[0][0]
    const second = onPoint.mock.calls[1][0]
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  it('disables both the input and the button when disabled is set', () => {
    render(<CoordinateEntryInput onPoint={vi.fn()} disabled />)
    fireEvent.change(getInput(), { target: { value: '42.60522, -82.82047' } })

    expect(getInput().disabled).toBe(true)
    expect(getButton().disabled).toBe(true)
  })
})
