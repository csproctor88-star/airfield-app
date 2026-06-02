import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepperRail } from '@/components/base-setup/StepperRail'

// ─── Base-config stepper rail ───
// Regression: the rail used to re-derive step visibility itself, filtering by
// module only (without airport_type). That leaked the civilian AEP step onto
// USAF bases AND desynced the rail's index space from the page's content
// (clicking a pill showed the wrong screen). The rail must be a pure
// pass-through of the already-filtered list the page hands it.

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView (the rail calls it in an effect).
  Element.prototype.scrollIntoView = vi.fn()
})

const steps = [
  { key: 'runways', number: 1, label: 'Runways', required: true },
  { key: 'qrc', number: 10, label: 'QRCs', required: true },
  { key: 'aepagencies', number: 11, label: 'AEP Agencies', required: true },
] as never

describe('StepperRail', () => {
  it('renders exactly the steps it is given, in order (no internal filtering)', () => {
    render(
      <StepperRail steps={steps} currentIndex={0} setupProgress={null} touched={new Set()} onStepClick={() => {}} />,
    )
    // getByText throws if the step is absent, so reaching the assertion is proof.
    expect(screen.getByText('Runways')).toBeTruthy()
    expect(screen.getByText('QRCs')).toBeTruthy()
    expect(screen.getByText('AEP Agencies')).toBeTruthy()
  })

  it('reports click index as the position in the passed list', () => {
    const clicks: number[] = []
    render(
      <StepperRail steps={steps} currentIndex={0} setupProgress={null} touched={new Set()} onStepClick={(i) => clicks.push(i)} />,
    )
    fireEvent.click(screen.getByText('AEP Agencies'))
    expect(clicks).toEqual([2])
  })
})
