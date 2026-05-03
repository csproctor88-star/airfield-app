'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ExternalLink,
  Image as ImageIcon, BookOpen, Sparkles, Compass, Camera, ListOrdered,
  HelpCircle, Network, Check, Clock, CheckCircle2, Circle, type LucideIcon,
} from 'lucide-react'
import { MODULES, ROLE_LABELS, type ModuleRef } from '@/lib/training/modules'
import { useReviewedModules } from '@/lib/training/use-reviewed'

export default function ModuleDeepDivePage() {
  const params = useParams<{ 'module-id': string }>()
  const moduleId = params['module-id']
  const m = useMemo(() => MODULES.find(x => x.id === moduleId), [moduleId])

  if (!m) {
    notFound()
  }

  return <ModuleView m={m} />
}

function ModuleView({ m }: { m: ModuleRef }) {
  const Icon = m.icon
  const { isReviewed, toggle, loaded } = useReviewedModules()
  const reviewed = isReviewed(m.id)
  const related = (m.relatedModules ?? [])
    .map(id => MODULES.find(x => x.id === id))
    .filter((x): x is ModuleRef => Boolean(x))

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <BackLink />

      {/* HERO — gradient accent strip + large icon tile + role chips */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 24,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-surface)',
      }}>
        {/* Top accent stripe in module color */}
        <div style={{
          height: 4,
          background: `linear-gradient(90deg, ${m.color} 0%, color-mix(in srgb, ${m.color} 30%, transparent) 100%)`,
        }} />

        <div style={{
          padding: '20px 22px',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}>
          <div
            style={{
              width: 72,
              height: 72,
              minWidth: 72,
              borderRadius: 'var(--radius-md)',
              background: `color-mix(in srgb, ${m.color} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${m.color} 32%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: m.color,
              flexShrink: 0,
              boxShadow: `0 0 24px color-mix(in srgb, ${m.color} 18%, transparent)`,
            }}
          >
            <Icon size={36} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{
              fontSize: 'var(--fs-2xs)',
              fontWeight: 800,
              color: m.color,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
            }}>
              Glidepath Module
            </div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1.15 }}>
              {m.name}
            </div>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 6, lineHeight: 1.5 }}>
              {m.tagline}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12, alignItems: 'center' }}>
              {m.roles.map(r => (
                <span
                  key={r}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: `color-mix(in srgb, ${m.color} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${m.color} 22%, transparent)`,
                    color: m.color,
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {ROLE_LABELS[r]}
                </span>
              ))}
              {m.readMinutes && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 4,
                  fontSize: 'var(--fs-2xs)',
                  color: 'var(--color-text-3)',
                  fontWeight: 600,
                }}>
                  <Clock size={11} />
                  {m.readMinutes} min read
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <Link
              href={m.path}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${m.color} 38%, transparent)`,
                color: m.color,
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                justifyContent: 'center',
              }}
            >
              Open module <ExternalLink size={14} />
            </Link>
            <button
              type="button"
              onClick={() => void toggle(m.id)}
              disabled={!loaded}
              title={reviewed ? 'Click to mark unreviewed' : 'Mark this module reviewed'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: reviewed
                  ? '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)'
                  : '1px solid var(--color-border)',
                background: reviewed
                  ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
                  : 'var(--color-bg-surface)',
                color: reviewed ? 'var(--color-success)' : 'var(--color-text-2)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: loaded ? 'pointer' : 'wait',
                fontFamily: 'inherit',
                opacity: loaded ? 1 : 0.6,
                whiteSpace: 'nowrap',
              }}
            >
              {reviewed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {reviewed ? 'Reviewed' : 'Mark Reviewed'}
            </button>
          </div>
        </div>
      </div>

      {/* OVERVIEW — elevated card with module-colored left rail */}
      <Section icon={BookOpen} title="Overview" color={m.color}>
        <div style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderLeft: `3px solid ${m.color}`,
        }}>
          {m.overview.split(/\n\n+/).map((para, i, arr) => (
            <p
              key={i}
              style={{
                fontSize: 'var(--fs-sm)',
                color: 'var(--color-text-2)',
                lineHeight: 1.65,
                margin: i === arr.length - 1 ? 0 : '0 0 10px',
              }}
            >
              {para}
            </p>
          ))}
        </div>
      </Section>

      {/* KEY FEATURES — 2-column grid of check-icon cards */}
      <Section icon={Sparkles} title="Key features" color={m.color}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 8,
        }}>
          {m.keyFeatures.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                minWidth: 22,
                borderRadius: '50%',
                background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${m.color} 32%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: m.color,
                flexShrink: 0,
                marginTop: 1,
              }}>
                <Check size={12} strokeWidth={3} />
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {f}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* HOW TO ACCESS — tinted callout with icon */}
      <Section icon={Compass} title="How to access" color={m.color}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: `color-mix(in srgb, ${m.color} 6%, transparent)`,
            border: `1px solid color-mix(in srgb, ${m.color} 22%, transparent)`,
          }}
        >
          <div style={{
            width: 26,
            height: 26,
            minWidth: 26,
            borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${m.color} 18%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: m.color,
            flexShrink: 0,
          }}>
            <Compass size={14} strokeWidth={2.25} />
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.55, flex: 1 }}>
            {m.howToAccess}
          </div>
        </div>
      </Section>

      {/* SCREENSHOTS — gallery grid OR framed placeholder card */}
      <Section icon={Camera} title="Screenshots" color={m.color}>
        {m.screenshots && m.screenshots.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {m.screenshots.map((s, i) => (
              <figure key={i} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.caption}
                  loading="lazy"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-inset)',
                    display: 'block',
                  }}
                />
                <figcaption style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                  {s.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 160,
              padding: 20,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-inset)',
              border: '1px dashed var(--color-border)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: `color-mix(in srgb, ${m.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${m.color} 22%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: m.color,
            }}>
              <ImageIcon size={20} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600 }}>
              Screenshots coming
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
              Captured shots will land here as the module gets refreshed.
            </div>
          </div>
        )}
      </Section>

      {/* WORKFLOW — numbered stepper with connecting line */}
      {m.workflow && (
        <Section icon={ListOrdered} title={m.workflow.title} color={m.color}>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', position: 'relative' }}>
            {/* Vertical connecting line */}
            <div style={{
              position: 'absolute',
              left: 13,
              top: 12,
              bottom: 12,
              width: 2,
              background: `color-mix(in srgb, ${m.color} 22%, transparent)`,
              borderRadius: 1,
            }} />
            {m.workflow.steps.map((s, i) => (
              <li
                key={i}
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: 14,
                  paddingBottom: i < m.workflow!.steps.length - 1 ? 12 : 0,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: '50%',
                  background: `color-mix(in srgb, ${m.color} 16%, var(--color-bg))`,
                  border: `1.5px solid ${m.color}`,
                  color: m.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 800,
                  flexShrink: 0,
                  zIndex: 1,
                  boxShadow: `0 0 0 4px var(--color-bg)`,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  flex: 1,
                  padding: '4px 12px 8px',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--color-text-2)',
                  lineHeight: 1.55,
                }}>
                  {s}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* FAQ — accordion or empty hint */}
      <Section icon={HelpCircle} title="Frequently asked" color={m.color}>
        {m.faq && m.faq.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.faq.map((f, i) => <FaqRow key={i} q={f.q} a={f.a} color={m.color} />)}
          </div>
        ) : (
          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-inset)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-text-3)',
            fontSize: 'var(--fs-sm)',
            fontStyle: 'italic',
            textAlign: 'center',
          }}>
            FAQ entries will land here as questions come in from the field.
          </div>
        )}
      </Section>

      {/* RELATED MODULES — accent tile grid */}
      {related.length > 0 && (
        <Section icon={Network} title="Related modules" color={m.color}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
          }}>
            {related.map(r => {
              const RIcon = r.icon
              return (
                <Link
                  key={r.id}
                  href={`/training/${r.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${r.color}`,
                    color: 'inherit',
                    textDecoration: 'none',
                    fontFamily: 'inherit',
                    fontSize: 'var(--fs-sm)',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in srgb, ${r.color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${r.color} 28%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: r.color,
                    flexShrink: 0,
                  }}>
                    <RIcon size={14} />
                  </div>
                  <span style={{ flex: 1, fontWeight: 600, color: 'var(--color-text-1)' }}>{r.name}</span>
                  <ArrowRight size={14} color="var(--color-text-4)" />
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      <BackLink />
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: LucideIcon
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}>
        <Icon size={14} color={color} strokeWidth={2.25} />
        <div style={{
          fontSize: 'var(--fs-2xs)',
          fontWeight: 800,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {title}
        </div>
      </div>
      {children}
    </section>
  )
}

function FaqRow({ q, a, color }: { q: string; a: string; color: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg-surface)',
      borderLeft: open ? `3px solid ${color}` : '1px solid var(--color-border)',
      transition: 'border-color 0.15s',
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-1)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} color={color} /> : <ChevronRight size={14} color="var(--color-text-3)" />}
        <span style={{ flex: 1 }}>{q}</span>
      </button>
      {open && (
        <div style={{
          padding: '0 14px 14px 38px',
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-2)',
          lineHeight: 1.6,
        }}>
          {a}
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/training"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0',
        marginBottom: 12,
        background: 'none',
        border: 'none',
        color: 'var(--color-text-3)',
        fontSize: 'var(--fs-sm)',
        textDecoration: 'none',
        fontFamily: 'inherit',
      }}
    >
      <ArrowLeft size={14} /> All modules
    </Link>
  )
}
