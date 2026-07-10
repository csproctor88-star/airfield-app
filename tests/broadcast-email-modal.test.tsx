import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BroadcastEmailModal } from '@/components/admin/broadcast-email-modal'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recipientCount: 5, sent: 5, failed: 0 }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  return render(
    <BroadcastEmailModal onClose={() => {}} callerName="MSgt Proctor" bases={[{ id: 'b1', name: 'Demo AFB' }]} />,
  )
}

function bodyOf(call: unknown[]) {
  return JSON.parse((call[1] as { body: string }).body)
}

describe('BroadcastEmailModal', () => {
  it('renders the live preview from the message markdown', async () => {
    const { container } = setup()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: '## Hi\n\n- one' } })
    await waitFor(() => {
      const preview = container.querySelector('[data-testid="broadcast-preview"]')!
      expect(preview.innerHTML).toContain('<h2>Hi</h2>')
      expect(preview.innerHTML).toContain('<li>one</li>')
    })
  })

  it('the Bullet toolbar button inserts a "- " token', () => {
    setup()
    const msg = screen.getByLabelText(/message/i) as HTMLTextAreaElement
    fireEvent.change(msg, { target: { value: 'line' } })
    fireEvent.click(screen.getByRole('button', { name: /bullet/i }))
    expect(msg.value).toContain('- ')
  })

  it('Send test posts mode=test with subject+body', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: /send test to myself/i }))
    await waitFor(() => {
      const testCall = fetchMock.mock.calls.find((c) => bodyOf(c).mode === 'test')
      expect(testCall).toBeTruthy()
      expect(bodyOf(testCall!)).toMatchObject({ mode: 'test', subject: 'S', body: 'B' })
    })
  })

  it('Send requires confirmation before posting mode=send', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
    const sendBtn = await screen.findByRole('button', { name: /send to 5/i })
    expect(fetchMock.mock.calls.some((c) => bodyOf(c).mode === 'send')).toBe(false)
    fireEvent.click(sendBtn)
    fireEvent.click(screen.getByRole('button', { name: /confirm send/i }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => bodyOf(c).mode === 'send')).toBe(true)
    })
  })

  it('defaults From to info@ and includes it in the send payload', async () => {
    setup()
    expect((screen.getByLabelText(/from/i) as HTMLSelectElement).value).toBe('info@glidepathops.com')
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: /send test to myself/i }))
    await waitFor(() => {
      const testCall = fetchMock.mock.calls.find((c) => bodyOf(c).mode === 'test')
      expect(testCall).toBeTruthy()
      expect(bodyOf(testCall!).from).toBe('info@glidepathops.com')
    })
  })
})
