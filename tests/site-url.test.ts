import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSiteUrl } from '@/lib/site-url'

describe('getSiteUrl', () => {
  const saved = { site: process.env.NEXT_PUBLIC_SITE_URL, app: process.env.NEXT_PUBLIC_APP_URL }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (saved.site) process.env.NEXT_PUBLIC_SITE_URL = saved.site
    if (saved.app) process.env.NEXT_PUBLIC_APP_URL = saved.app
    vi.restoreAllMocks()
  })

  it('prefers NEXT_PUBLIC_SITE_URL over NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.example.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    expect(getSiteUrl()).toBe('https://site.example.com')
  })

  it('falls back to NEXT_PUBLIC_APP_URL when SITE_URL is unset', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    expect(getSiteUrl()).toBe('https://app.example.com')
  })

  it('falls back to app.glidepathops.com when both are unset', () => {
    expect(getSiteUrl()).toBe('https://app.glidepathops.com')
  })

  it('strips trailing slashes so `${getSiteUrl()}/setup-account` is predictable', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'
    expect(getSiteUrl()).toBe('https://example.com')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com///'
    expect(getSiteUrl()).toBe('https://example.com')
  })

  it('strips leading/trailing quote characters from .env leakage', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '"https://example.com"'
    expect(getSiteUrl()).toBe('https://example.com')
  })

  it('never returns an empty string even when env is empty', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ''
    process.env.NEXT_PUBLIC_APP_URL = ''
    expect(getSiteUrl()).toBe('https://app.glidepathops.com')
  })
})
