'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { fetchPublicFeedbackConfig, submitFeedback, type FeedbackFormConfig, type FeedbackFormField, DEFAULT_FEEDBACK_CONFIG } from '@/lib/supabase/feedback'
import { CheckCircle2, Star } from 'lucide-react'

const WORDMARK_STYLE: React.CSSProperties = {
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  background: 'linear-gradient(135deg, var(--color-logo-start), var(--color-logo-end))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const STAR_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

export default function FeedbackFormPage() {
  const { baseId } = useParams<{ baseId: string }>()
  const [config, setConfig] = useState<FeedbackFormConfig | null>(DEFAULT_FEEDBACK_CONFIG)
  const [baseName, setBaseName] = useState('')
  const [moduleEnabled, setModuleEnabled] = useState(true)
  const [baseFound, setBaseFound] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const [responses, setResponses] = useState<Record<string, string>>({})

  // Rate limiting
  const [rateLimited, setRateLimited] = useState(false)

  useEffect(() => {
    if (!baseId) return
    // Check rate limit
    const lastSubmit = localStorage.getItem(`feedback_cooldown_${baseId}`)
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 300000) { // 5 min cooldown
      setRateLimited(true)
    }
    fetchPublicFeedbackConfig(baseId).then(result => {
      if (!result) {
        setBaseFound(false)
        setConfig(null)
      } else {
        setBaseName(result.baseName)
        setModuleEnabled(result.moduleEnabled)
        setConfig(result.config)
      }
      setLoading(false)
    })
  }, [baseId])

  const handleSubmit = async () => {
    if (!baseId || submitting) return
    setError('')
    setSubmitting(true)

    const result = await submitFeedback({
      base_id: baseId,
      name: name.trim() || null,
      email: email.trim() || null,
      organization: organization.trim() || null,
      overall_rating: rating,
      comments: comments.trim() || null,
      responses,
    })

    if (result.success) {
      setSubmitted(true)
      localStorage.setItem(`feedback_cooldown_${baseId}`, String(Date.now()))
    } else {
      setError(result.error || 'Failed to submit. Please try again.')
    }
    setSubmitting(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--color-border-mid)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)',
    fontSize: 16, fontFamily: 'inherit', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: 16 }}>Loading...</div>
      </div>
    )
  }

  if (!baseFound || !config || !moduleEnabled || !config.enabled) {
    const heading = !baseFound
      ? 'Feedback Form Not Found'
      : baseName
        ? `${baseName} is not collecting feedback`
        : 'Feedback Form Closed'
    const body = !baseFound
      ? 'This link does not match an active base. Check the QR code and try again.'
      : !moduleEnabled
        ? `${baseName || 'This base'} does not currently use the Glidepath feedback module. Please reach out to airfield management directly.`
        : baseName
          ? `The feedback form for ${baseName} is not active right now. Please check back later or contact airfield management.`
          : 'This feedback form is not active right now. Please check back later.'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ ...WORDMARK_STYLE, fontSize: 11, marginBottom: 12 }}>
            GLIDEPATH
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 10 }}>{heading}</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.5 }}>{body}</div>
        </div>
      </div>
    )
  }

  if (rateLimited) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>Thank You</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-3)' }}>You have already submitted feedback recently. Please wait a few minutes before submitting again.</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <CheckCircle2 size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)', marginBottom: 8 }}>Submitted</div>
          <div style={{ fontSize: 16, color: 'var(--color-text-1)', lineHeight: 1.5 }}>{config.thank_you_message}</div>
        </div>
      </div>
    )
  }

  const renderField = (field: FeedbackFormField) => {
    const value = responses[field.id] || ''
    const setValue = (v: string) => setResponses(prev => ({ ...prev, [field.id]: v }))

    return (
      <div key={field.id}>
        <label style={labelStyle}>
          {field.label}{field.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
        </label>
        {field.type === 'text' && (
          <input value={value} onChange={e => setValue(e.target.value)} style={inputStyle} />
        )}
        {field.type === 'textarea' && (
          <textarea value={value} onChange={e => setValue(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
        )}
        {field.type === 'rating' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const selected = value === String(n)
              return (
                <button
                  key={n}
                  onClick={() => setValue(String(n))}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 18, fontWeight: 700,
                    border: selected
                      ? '1px solid color-mix(in srgb, var(--color-cyan) 50%, transparent)'
                      : '1px solid var(--color-border-mid)',
                    background: selected
                      ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                      : 'var(--color-bg-inset)',
                    color: selected ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    cursor: 'pointer',
                  }}
                >{n}</button>
              )
            })}
          </div>
        )}
        {field.type === 'yes_no' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {['Yes', 'No'].map(opt => {
              const selected = value === opt
              return (
                <button
                  key={opt}
                  onClick={() => setValue(opt)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 14, fontWeight: 600,
                    border: selected
                      ? '1px solid color-mix(in srgb, var(--color-cyan) 50%, transparent)'
                      : '1px solid var(--color-border-mid)',
                    background: selected
                      ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                      : 'var(--color-bg-inset)',
                    color: selected ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    cursor: 'pointer',
                  }}
                >{opt}</button>
              )
            })}
          </div>
        )}
        {field.type === 'dropdown' && (
          <select value={value} onChange={e => setValue(e.target.value)} style={inputStyle}>
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ ...WORDMARK_STYLE, fontSize: 11, marginBottom: 6 }}>
            GLIDEPATH
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 8 }}>
            {config.title}
          </div>
          {config.description && (
            <div style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
              {config.description}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-mid)', borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Identity fields */}
          {(config.show_name || config.show_organization || config.show_email) && (
            <span className="section-label" style={{ marginBottom: 0 }}>About You</span>
          )}
          {config.show_name && (
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
            </div>
          )}
          {config.show_organization && (
            <div>
              <label style={labelStyle}>Organization / Unit</label>
              <input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="e.g. 127th Wing" style={inputStyle} />
            </div>
          )}
          {config.show_email && (
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@example.com" style={inputStyle} />
            </div>
          )}

          {/* Feedback fields */}
          {(config.show_overall_rating || config.fields.length > 0) && (
            <span className="section-label" style={{ marginBottom: 0, marginTop: 4 }}>Your Feedback</span>
          )}

          {/* Overall rating */}
          {config.show_overall_rating && (
            <div>
              <label style={labelStyle}>Overall Experience</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => {
                  const selected = rating === n
                  const filled = rating != null && n <= rating
                  return (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8,
                        border: selected
                          ? '1px solid color-mix(in srgb, var(--color-amber) 50%, transparent)'
                          : '1px solid var(--color-border-mid)',
                        background: selected
                          ? 'color-mix(in srgb, var(--color-amber) 14%, transparent)'
                          : 'var(--color-bg-inset)',
                        color: selected ? 'var(--color-amber)' : 'var(--color-text-4)',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}
                    >
                      <Star size={20} fill={filled ? 'var(--color-amber)' : 'transparent'} color={filled ? 'var(--color-amber)' : 'currentColor'} />
                      <span style={{ fontSize: 9, fontWeight: 600 }}>{STAR_LABELS[n - 1]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom fields */}
          {config.fields.map(renderField)}

          {/* Comments */}
          <div>
            <label style={labelStyle}>Comments</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Share your thoughts..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--color-danger)',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary"
            style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer' }}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--color-text-4)' }}>
          Powered by Glidepath
        </div>
      </div>
    </div>
  )
}
