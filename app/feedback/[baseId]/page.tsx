'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { fetchFeedbackConfig, submitFeedback, type FeedbackFormConfig, type FeedbackFormField, DEFAULT_FEEDBACK_CONFIG } from '@/lib/supabase/feedback'

const STAR_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

export default function FeedbackFormPage() {
  const { baseId } = useParams<{ baseId: string }>()
  const [config, setConfig] = useState<FeedbackFormConfig>(DEFAULT_FEEDBACK_CONFIG)
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
    fetchFeedbackConfig(baseId).then(cfg => {
      setConfig(cfg)
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
    border: '1px solid #334155', background: '#0F172A', color: '#E2E8F0',
    fontSize: 16, fontFamily: 'inherit', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 600, color: '#94A3B8', marginBottom: 4,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94A3B8', fontSize: 16 }}>Loading...</div>
      </div>
    )
  }

  if (!config.enabled) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>-</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 8 }}>Feedback Form Not Available</div>
          <div style={{ fontSize: 14, color: '#64748B' }}>This feedback form has not been activated yet.</div>
        </div>
      </div>
    )
  }

  if (rateLimited) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 8 }}>Thank You</div>
          <div style={{ fontSize: 14, color: '#64748B' }}>You have already submitted feedback recently. Please wait a few minutes before submitting again.</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E', marginBottom: 8 }}>Submitted</div>
          <div style={{ fontSize: 16, color: '#E2E8F0', lineHeight: 1.5 }}>{config.thank_you_message}</div>
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
          {field.label}{field.required && <span style={{ color: '#EF4444' }}> *</span>}
        </label>
        {field.type === 'text' && (
          <input value={value} onChange={e => setValue(e.target.value)} style={inputStyle} />
        )}
        {field.type === 'textarea' && (
          <textarea value={value} onChange={e => setValue(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
        )}
        {field.type === 'rating' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setValue(String(n))}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 18, fontWeight: 700,
                  border: value === String(n) ? '2px solid #22D3EE' : '1px solid #334155',
                  background: value === String(n) ? 'rgba(34,211,238,0.15)' : '#0F172A',
                  color: value === String(n) ? '#22D3EE' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >{n}</button>
            ))}
          </div>
        )}
        {field.type === 'yes_no' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {['Yes', 'No'].map(opt => (
              <button
                key={opt}
                onClick={() => setValue(opt)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 14, fontWeight: 600,
                  border: value === opt ? '2px solid #22D3EE' : '1px solid #334155',
                  background: value === opt ? 'rgba(34,211,238,0.15)' : '#0F172A',
                  color: value === opt ? '#22D3EE' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >{opt}</button>
            ))}
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
    <div style={{ minHeight: '100vh', background: '#0B1120', padding: '24px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22D3EE', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            GLIDEPATH
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
            {config.title}
          </div>
          {config.description && (
            <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.5 }}>
              {config.description}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{
          background: '#1E293B', border: '1px solid #334155', borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Standard fields */}
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

          {/* Overall rating */}
          {config.show_overall_rating && (
            <div>
              <label style={labelStyle}>Overall Experience</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 20,
                      border: rating === n ? '2px solid #FBBF24' : '1px solid #334155',
                      background: rating === n ? 'rgba(251,191,36,0.15)' : '#0F172A',
                      color: rating === n ? '#FBBF24' : '#475569',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    <span>{rating != null && n <= rating ? '\u2605' : '\u2606'}</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>{STAR_LABELS[n - 1]}</span>
                  </button>
                ))}
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
            <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '12px 0', borderRadius: 8, border: 'none',
              background: submitting ? '#334155' : 'linear-gradient(135deg, #0369A1, #22D3EE)',
              color: '#FFF', fontSize: 16, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#475569' }}>
          Powered by Glidepath
        </div>
      </div>
    </div>
  )
}
