# Glidepath Marketing Site — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `glidepath-site` repo from zero to a Vercel-preview-deployed homepage with the full design system, module registry, terminology guard tests, and CI.

**Architecture:** A new Next.js 15 App Router site, statically rendered, dark-only, mirroring the airfield-app repo's conventions. All site copy lives in typed data files (`lib/`) so regression-guard tests can enforce the spec's terminology rules mechanically. The homepage is assembled from focused section components; screenshots render through an `AppFrame` that shows a styled placeholder until Phase 2's capture pipeline supplies real images.

**Tech Stack:** Next.js 15.3.9 · React 19.1 · TypeScript strict · Tailwind CSS 3.4 · Vitest + Testing Library · next/font (Archivo + IBM Plex Mono, self-hosted at build) · GitHub Actions · Vercel.

**Spec of record:** `docs/superpowers/specs/2026-07-02-marketing-website-design.md` (in the airfield-app repo). This plan implements its Phase 1 only. Phases 2–5 get their own plans at each phase boundary.

## Global Constraints

Every task's requirements implicitly include all of these:

- **Repo location:** `C:\Users\cspro\glidepath-site` (sibling of `airfield-app`). All commands below run from this directory unless stated otherwise. Shell syntax is Git Bash (POSIX).
- **Versions:** `next@15.3.9`, `react@19.1.0`, `tailwindcss@^3.4.19`, TypeScript `strict: true`. Do not upgrade majors mid-plan.
- **File naming:** kebab-case for all source files (`site-header.tsx`); PascalCase component names inside. Path alias `@/*` → repo root.
- **Dark-only site.** No theme switching, no `dark:` variants — the tokens ARE the theme.
- **Terminology (from spec §4 — enforced by Task 4's guard tests):** "Airfield Manager" never "AMT"; never "AMOPS controller/staff" or "airfield controller"; "FOD Check" never "FOD walk"; no "walk the route/airfield" phrasing; no snake_case role keys in copy; civilian module names say "Airport"/neutral, never "Airfield" (the module label exception is none in Phase 1 data); data-posture wording is "no sensitive personal data".
- **Copy stance (spec §2):** lead with automation + compliance. Never "replaces paper/whiteboards" or any paper comparison. No fabricated regulatory citations — omit a citation rather than guess it.
- **Claims (spec §5):** no installation/unit names, no emblems, no endorsement implication. Adoption stats render only when real values are supplied; components must hide, not fake, missing stats.
- **Commits:** imperative header, optional body. Every commit message ends with these two trailer lines:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H
  ```
- **Never attach any production domain** (`glidepathops.com` or subdomains) to the Vercel project in this phase. Preview URLs only. The cutover is Phase 5.
- **Gate every commit on green:** `npm run lint` (no errors), `npx tsc --noEmit`, `npx vitest run`, `npm run build` all pass before each commit that touches code.

## File Structure (end state of Phase 1)

```
glidepath-site/
├── app/
│   ├── layout.tsx                 Root layout: fonts, metadata, header/footer
│   ├── page.tsx                   Homepage assembly
│   ├── globals.css                Tokens + Tailwind layers + component classes
│   ├── favicon.ico                Copied from airfield-app
│   ├── sitemap.ts                 Static route list
│   ├── robots.ts                  Allow-all (Vercel previews auto-noindex)
│   ├── military/page.tsx          Stub (full page: Phase 3)
│   ├── civilian/page.tsx          Stub (full page: Phase 3)
│   ├── platform/page.tsx          Stub (full page: Phase 4)
│   ├── security/page.tsx          Stub (full page: Phase 4)
│   └── demo/page.tsx              Stub w/ mailto (form: Phase 4)
├── components/
│   ├── ui/
│   │   ├── container.tsx          Max-width wrapper
│   │   ├── section-heading.tsx    Mono eyebrow + balanced title
│   │   ├── glidepath-divider.tsx  The descending-line SVG motif
│   │   └── app-frame.tsx          Screenshot frame w/ built-in placeholder
│   ├── layout/
│   │   ├── site-header.tsx        Nav + CTA (server) 
│   │   ├── mobile-nav.tsx         Hamburger disclosure (client)
│   │   └── site-footer.tsx        LLC line, motto, nav, contact
│   └── home/
│       ├── hero.tsx               Motto headline, CTAs, glidepath into AppFrame
│       ├── regulation-strip.tsx   Mono reg citations band
│       ├── operation-split.tsx    Military/Civilian track cards
│       ├── deep-dives.tsx         3 alternating screenshot/copy rows
│       ├── module-mosaic.tsx      All-modules chip grid + track filter (client)
│       ├── stats-band.tsx         Generic adoption stats (hides empty)
│       ├── security-strip.tsx     Data-posture points → /security
│       └── closing-cta.tsx        "See your airfield in Glidepath."
├── lib/
│   ├── utils.ts                   cn() class joiner
│   ├── site-config.ts             Nav, org facts, URLs, adoption stats
│   ├── modules-data.ts            The 22 + 14 module registry (typed)
│   └── home-content.ts            Hero/deep-dive/reg-strip copy strings
├── tests/
│   ├── setup.ts                   jest-dom matchers
│   ├── primitives.test.tsx        Container/SectionHeading/AppFrame/Divider
│   ├── modules-data.test.ts       Roster counts, slug uniqueness, labels
│   ├── terminology.test.ts        Spec §4 guard patterns over ALL copy
│   ├── site-header.test.tsx       Nav links + demo CTA
│   └── home.test.tsx              Homepage renders; mosaic filter behavior
├── public/brand/wordmark-dark.png Copied from airfield-app
├── .github/workflows/ci.yml       lint → tsc → vitest → build
├── eslint.config.mjs · next.config.ts · tailwind.config.ts · postcss.config.mjs
├── tsconfig.json · vitest.config.mts · package.json · .gitignore
├── README.md · CLAUDE.md
```

**Interface conventions locked here for later phases:** `ModuleEntry` (Task 4) is the seed of Phase 2's full content model — Phase 2 *extends* this type (adds page sections, screenshots, FAQ), never replaces it. `AppFrame`'s `src?: string` contract is what Phase 2's capture pipeline fills. Mosaic chips are non-links in Phase 1; Phase 3 converts them to `/{track}/{slug}` links.

---

### Task 1: Repo scaffold + toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `.gitignore`, `README.md`, `app/layout.tsx` (temporary minimal), `app/page.tsx` (temporary minimal), `app/globals.css` (temporary minimal)

**Interfaces:**
- Produces: a building, lintable, testable empty app. Scripts: `dev`, `build`, `start`, `lint`, `test`. Alias `@/*` → root. Tailwind token names (Task 2) will extend `tailwind.config.ts` written here.

- [ ] **Step 1: Create the directory and git repo**

```bash
mkdir -p /c/Users/cspro/glidepath-site && cd /c/Users/cspro/glidepath-site && git init -b main
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "glidepath-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.3.9",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.28.0",
    "eslint-config-next": "15.3.9",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.19",
    "typescript": "^5.9.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "types": ["vitest/globals"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Lint runs as its own CI step; under CI=1 `next build` escalates
  // warnings to failures (the airfield-app Next 15 lesson).
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
export default config
```

- [ ] **Step 6: Write `tailwind.config.ts`** (token values land in Task 2; the shell is here so the build passes)

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

- [ ] **Step 7: Write `eslint.config.mjs`** (mirrors airfield-app: core-web-vitals + TS, two rules at warn)

```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]

export default eslintConfig
```

- [ ] **Step 8: Write `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 9: Write `.gitignore`**

```gitignore
node_modules/
.next/
out/
coverage/
.vercel
.env*
!.env.example
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 10: Write the minimal app shell** — these three files are temporary; Task 2 replaces them.

`app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Glidepath',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Glidepath</main>
}
```

`tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 11: Write `README.md`**

```markdown
# glidepath-site

Marketing and SEO site for Glidepath — glidepathops.com.
The app itself lives in the `airfield-app` repo (app.glidepathops.com).

Design spec of record: `airfield-app/docs/superpowers/specs/2026-07-02-marketing-website-design.md`.

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npx tsc --noEmit` | Type check |
```

- [ ] **Step 12: Install and verify the toolchain**

```bash
npm install && npm run lint && npx tsc --noEmit && npm run build
```

Expected: install completes; lint reports no errors (warnings acceptable); tsc silent; build prints "Compiled successfully" with route `/` static. If `npx tsc --noEmit` complains about `vitest/globals` missing before install finishes, re-run after install.

- [ ] **Step 13: Run vitest to verify the runner works with zero tests**

```bash
npx vitest run --passWithNoTests
```

Expected: "No test files found" then exit 0. (The plain `npm run test` gate applies from Task 3 onward, once test files exist.)

- [ ] **Step 14: First commit + create the private GitHub repo**

```bash
git add -A && git commit -m "Scaffold Next 15 + Tailwind 3.4 + Vitest toolchain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
gh repo create glidepath-site --private --source . --push
```

Expected: repo created at `<github-user>/glidepath-site`, `main` pushed. If `gh` is not authenticated, run `gh auth status` and stop for the user — do not create the repo any other way without asking.

---

### Task 2: Design tokens, fonts, and global styles

**Files:**
- Modify: `tailwind.config.ts` (fill `theme.extend`)
- Modify: `app/globals.css` (full token + component layer)
- Modify: `app/layout.tsx` (fonts + real metadata)
- Create: `lib/utils.ts`

**Interfaces:**
- Produces: Tailwind color names `ground, surface, surface2, ink, muted, faint, sky, skyline, skydim, line, linestrong, amber, amberline, amberbg`; font utilities `font-sans` (Archivo) / `font-mono` (IBM Plex Mono); CSS classes `.btn-primary`, `.btn-ghost`, `.chip`, `.chip-amber`, `.eyebrow`; helper `cn(...parts: Array<string | undefined | false>): string`. Every later task consumes these exact names.

- [ ] **Step 1: Write `lib/utils.ts`**

```ts
export function cn(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ')
}
```

- [ ] **Step 2: Fill `tailwind.config.ts` `theme.extend`** — replace the empty `extend: {}` with:

```ts
    extend: {
      colors: {
        ground: '#0B1220',
        surface: '#101A2C',
        surface2: '#0E1626',
        ink: '#E2EAF5',
        muted: '#93A5C0',
        faint: '#6B7D99',
        sky: '#38BDF8',
        skyline: 'rgba(56, 189, 248, 0.35)',
        skydim: 'rgba(56, 189, 248, 0.14)',
        line: 'rgba(143, 163, 191, 0.16)',
        linestrong: 'rgba(143, 163, 191, 0.30)',
        amber: '#FBBF24',
        amberline: 'rgba(245, 158, 11, 0.45)',
        amberbg: 'rgba(245, 158, 11, 0.08)',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
    },
```

- [ ] **Step 3: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    scroll-behavior: smooth;
  }
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }
  body {
    @apply bg-ground text-ink antialiased;
  }
  ::selection {
    @apply bg-sky/25 text-white;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-md bg-sky px-5 py-2.5 text-sm font-semibold text-ground transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky;
  }
  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 rounded-md border border-linestrong px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-skyline hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky;
  }
  .chip {
    @apply inline-flex items-center whitespace-nowrap rounded-full border border-line bg-surface2 px-2.5 py-1 font-mono text-xs text-muted;
  }
  .chip-amber {
    @apply border-amberline bg-amberbg text-amber;
  }
  .eyebrow {
    @apply font-mono text-xs uppercase tracking-[0.14em] text-sky;
  }
}
```

Note the amber recipe: tinted background + amber border + amber text — outlined pill, never a filled amber block (spec §6).

- [ ] **Step 4: Replace `app/layout.tsx`** — fonts self-host at build via `next/font` (no runtime font CDN requests — deliberate for government networks):

```tsx
import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://glidepathops.com'),
  title: {
    default: 'Glidepath — Airfield & Airport Operations Platform',
    template: '%s · Glidepath',
  },
  description:
    'One operations platform for military airfields and Part 139 airports — built on the regulations you operate under.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Verify tokens render**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: all green. Then `npm run dev`, open `http://localhost:3000` — near-black navy page, "Glidepath" in Archivo. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add design tokens, Archivo + IBM Plex Mono, global component classes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 3: UI primitives

**Files:**
- Create: `components/ui/container.tsx`, `components/ui/section-heading.tsx`, `components/ui/glidepath-divider.tsx`, `components/ui/app-frame.tsx`
- Test: `tests/primitives.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; token classes from Task 2.
- Produces:
  - `Container({ className?, children })` — centered `max-w-6xl` wrapper.
  - `SectionHeading({ eyebrow, title, as?, className? })` — mono eyebrow + balanced heading; `as` is `'h1' | 'h2'`, default `'h2'` (stub pages pass `as="h1"`).
  - `GlidepathDivider({ className? })` — the descending-line SVG, `aria-hidden`.
  - `AppFrame({ src?, alt, label? })` — bordered screenshot figure; renders `next/image` at 1600×1000 when `src` given, else a grid-textured placeholder `role="img"` with the `label` chip. **Phase 2's capture pipeline fills `src`; the contract does not change.**

- [ ] **Step 1: Write the failing tests** — `tests/primitives.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { GlidepathDivider } from '@/components/ui/glidepath-divider'
import { AppFrame } from '@/components/ui/app-frame'

describe('Container', () => {
  it('renders children and merges classes', () => {
    render(<Container className="py-4">inside</Container>)
    const el = screen.getByText('inside')
    expect(el).toHaveClass('max-w-6xl', 'py-4')
  })
})

describe('SectionHeading', () => {
  it('renders eyebrow and title as a heading', () => {
    render(<SectionHeading eyebrow="Modules" title="Built for your operation" />)
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Built for your operation' })
    ).toBeInTheDocument()
  })
})

describe('GlidepathDivider', () => {
  it('is decorative (hidden from the accessibility tree)', () => {
    const { container } = render(<GlidepathDivider />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('AppFrame', () => {
  it('renders a labeled placeholder when no src is given', () => {
    render(<AppFrame alt="Airfield Status dashboard" label="Capture lands in Phase 2" />)
    expect(screen.getByRole('img', { name: 'Airfield Status dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Capture lands in Phase 2')).toBeInTheDocument()
  })

  it('renders an image when src is given', () => {
    render(<AppFrame src="/screenshots/status.png" alt="Airfield Status dashboard" />)
    const img = screen.getByRole('img', { name: 'Airfield Status dashboard' })
    expect(img.tagName).toBe('IMG')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/primitives.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/ui/container'` (and siblings).

- [ ] **Step 3: Write the components**

`components/ui/container.tsx`:

```tsx
import { cn } from '@/lib/utils'

export function Container({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>
}
```

`components/ui/section-heading.tsx`:

```tsx
import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  as: Tag = 'h2',
  className,
}: {
  eyebrow: string
  title: string
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <Tag className="mt-2 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {title}
      </Tag>
    </div>
  )
}
```

`components/ui/glidepath-divider.tsx`:

```tsx
import { cn } from '@/lib/utils'

/** The brand motif: a thin line on a descending glidepath, leveling at the threshold. */
export function GlidepathDivider({ className }: { className?: string }) {
  return (
    <svg
      className={cn('block h-10 w-full', className)}
      viewBox="0 0 800 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="0" y1="4" x2="640" y2="34" stroke="#38BDF8" strokeWidth="1.5" opacity="0.7" />
      <line x1="640" y1="34" x2="800" y2="34" stroke="#38BDF8" strokeWidth="1.5" opacity="0.3" />
      <circle cx="640" cy="34" r="3" fill="#38BDF8" />
    </svg>
  )
}
```

`components/ui/app-frame.tsx`:

```tsx
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Frames an app screenshot per spec §9: thin border + subtle shadow, no fake
 * device chrome. Until Phase 2's capture pipeline supplies `src`, renders a
 * grid-textured placeholder so layout and copy can be finalized now.
 */
export function AppFrame({
  src,
  alt,
  label,
  className,
}: {
  src?: string
  alt: string
  label?: string
  className?: string
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface2',
        'shadow-[0_24px_64px_-24px_rgba(0,0,0,0.65)]',
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt} width={1600} height={1000} className="block w-full" />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="grid aspect-[16/10] place-items-center bg-[linear-gradient(rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px)] bg-[size:32px_32px]"
        >
          <span className="chip">{label ?? 'App capture — Phase 2'}</span>
        </div>
      )}
    </figure>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/primitives.test.tsx
```

Expected: 6 passed.

- [ ] **Step 5: Full gate + commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Add UI primitives: container, section heading, glidepath divider, app frame

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 4: Module registry + terminology guard tests

This is the plan's keystone: all rosters and copy live in typed data, and the
spec's terminology rules become regression tests (the airfield-app
audit-invariant pattern). Any future copy edit that violates spec §4 fails CI.

**Files:**
- Create: `lib/modules-data.ts`, `lib/site-config.ts`, `lib/home-content.ts`
- Test: `tests/modules-data.test.ts`, `tests/terminology.test.ts`

**Interfaces:**
- Produces (exact — later tasks and Phase 2/3 consume these):

```ts
// lib/modules-data.ts
export type Track = 'military' | 'civilian'
export interface ModuleEntry {
  slug: string      // kebab-case, unique per track
  name: string      // display label
  track: Track
  tagline: string   // one line, automation/compliance-led
  regCite?: string  // REAL citation only; omit when unsure
}
export const MODULES: ModuleEntry[]
export const militaryModules: ModuleEntry[]  // 22 entries
export const civilianModules: ModuleEntry[]  // 14 entries

// lib/site-config.ts
export interface AdoptionStat { value: string | null; label: string }
export const siteConfig: {
  name: string; legalName: string; motto: string
  url: string; appUrl: string; contactEmail: string
  nav: { label: string; href: string }[]
  adoptionStats: AdoptionStat[]   // value null ⇒ component hides it
}

// lib/home-content.ts
export const heroContent: { headline: string; subline: string; primaryCta: ...; secondaryCta: ... }
export const regulationStrip: string[]
export const deepDives: { eyebrow: string; title: string; body: string; imageAlt: string }[]
export const securityStrip: { points: string[]; link: { label: string; href: string } }
export const closingCta: { title: string; body: string }
```

- [ ] **Step 1: Write the failing roster tests** — `tests/modules-data.test.ts`:

```ts
import { MODULES, militaryModules, civilianModules } from '@/lib/modules-data'

describe('module registry', () => {
  it('has 22 military and 14 civilian modules (spec §3)', () => {
    expect(militaryModules).toHaveLength(22)
    expect(civilianModules).toHaveLength(14)
    expect(MODULES).toHaveLength(36)
  })

  it('has unique kebab-case slugs within each track', () => {
    for (const list of [militaryModules, civilianModules]) {
      const slugs = list.map((m) => m.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('every module has a non-empty tagline', () => {
    for (const m of MODULES) expect(m.tagline.trim().length).toBeGreaterThan(10)
  })

  it('civilian module names never say Airfield (spec §4 — Airport Status, not Airfield Status)', () => {
    for (const m of civilianModules) expect(m.name).not.toMatch(/airfield/i)
  })
})
```

- [ ] **Step 2: Write the failing terminology guard** — `tests/terminology.test.ts`:

```ts
import { MODULES } from '@/lib/modules-data'
import { siteConfig } from '@/lib/site-config'
import { heroContent, regulationStrip, deepDives, securityStrip, closingCta } from '@/lib/home-content'

/** Every copy string on the site, flattened. New copy sources get added here. */
function allCopy(): string {
  return JSON.stringify([
    MODULES,
    siteConfig,
    heroContent,
    regulationStrip,
    deepDives,
    securityStrip,
    closingCta,
  ])
}

/** Spec §4 + §2: patterns that must never appear in site copy. */
const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: '"AMT" (say Airfield Manager)', pattern: /\bAMT\b/ },
  { name: '"AMOPS controller/staff"', pattern: /\bAMOPS (controller|staff)\b/i },
  { name: '"airfield controller"', pattern: /airfield controller/i },
  { name: '"FOD walk" (say FOD Check)', pattern: /FOD walk/i },
  { name: '"walk the route/airfield"', pattern: /walk (the )?(route|airfield)/i },
  { name: 'paper/whiteboard comparison (spec §2)', pattern: /\b(paper|paperless|whiteboard|clipboard)\b/i },
  { name: 'snake_case role keys in copy', pattern: /\b(base_admin|sys_admin|airfield_manager|majcom_rfm|sms_manager|aep_coordinator|read_only)\b/ },
  { name: '"PII" (say sensitive personal data)', pattern: /\bPII\b/ },
  { name: 'endorsement implication', pattern: /trusted by the (usaf|air force)/i },
]

describe('terminology guard (spec §4, §2, §5)', () => {
  const copy = allCopy()
  for (const { name, pattern } of FORBIDDEN) {
    it(`never contains ${name}`, () => {
      const match = copy.match(pattern)
      expect(match, `found forbidden ${name}: "${match?.[0]}"`).toBeNull()
    })
  }
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/modules-data.test.ts tests/terminology.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/modules-data'`.

- [ ] **Step 4: Write `lib/modules-data.ts`** — complete registry. Citations included only where certain; all others deliberately omitted (Global Constraints).

```ts
export type Track = 'military' | 'civilian'

export interface ModuleEntry {
  slug: string
  name: string
  track: Track
  tagline: string
  regCite?: string
}

export const MODULES: ModuleEntry[] = [
  // ── Military (22) ─────────────────────────────────────────────
  { slug: 'airfield-status', name: 'Airfield Status', track: 'military',
    tagline: 'Live runway, NAVAID, and field-condition status the whole base works from — one screen, always current.' },
  { slug: 'dashboards', name: 'Dashboards', track: 'military',
    tagline: 'Customizable widget dashboards that surface the day\'s workload the moment you log in.' },
  { slug: 'airfield-checks', name: 'Airfield Checks', track: 'military',
    tagline: 'Seven check types guided end to end and archived with a signed PDF record.' },
  { slug: 'inspections', name: 'Inspections', track: 'military',
    tagline: 'Daily, construction, and joint-monthly inspections stepped through item by item, aligned to DAFMAN 13-204.',
    regCite: 'DAFMAN 13-204 V2' },
  { slug: 'acsi', name: 'ACSI', track: 'military',
    tagline: 'Annual Airfield Certification/Safety Inspection records with per-fiscal-year completion tracking.',
    regCite: 'DAFMAN 13-204 V2' },
  { slug: 'discrepancies', name: 'Discrepancies', track: 'military',
    tagline: 'Every airfield discrepancy tracked from identification through verified closure.' },
  { slug: 'ces-work-orders', name: 'CES Work Orders', track: 'military',
    tagline: 'Civil Engineer work orders coordinated in the same picture the airfield runs on.' },
  { slug: 'visual-navaids', name: 'Visual NAVAIDs', track: 'military',
    tagline: 'Threshold-driven outage detection that flags a lighting system the moment it falls below minimums.',
    regCite: 'DAFMAN 13-204 V2, Table A3.1' },
  { slug: 'parking-plans', name: 'Parking Plans', track: 'military',
    tagline: 'Aircraft parking plans with wingtip and taxilane clearance envelopes computed for you.',
    regCite: 'UFC 3-260-01' },
  { slug: 'obstructions', name: 'Obstructions', track: 'military',
    tagline: 'Geodesic imaginary-surface analysis behind every obstruction evaluation.',
    regCite: 'UFC 3-260-01, Ch. 3' },
  { slug: 'qrc', name: 'QRCs', track: 'military',
    tagline: 'Quick Reaction Checklists ready at the moment of the emergency — 25 checklists, eight step types.',
    regCite: 'AFMAN 91-203' },
  { slug: 'shift-checklist', name: 'Shift Checklist', track: 'military',
    tagline: 'A three-state shift checklist that resets itself at 0600L.' },
  { slug: 'wildlife-bash', name: 'Wildlife / BASH', track: 'military',
    tagline: 'Sightings, strikes, and a live BASH heatmap across 270+ species.',
    regCite: 'DAFMAN 91-212' },
  { slug: 'waivers', name: 'Waivers', track: 'military',
    tagline: 'Six classifications, seven statuses — the full waiver lifecycle with annual review.',
    regCite: 'AF Form 505' },
  { slug: 'notams', name: 'NOTAMs', track: 'military',
    tagline: 'The live FAA feed scoped to your airfield, with expiring-NOTAM alerts.' },
  { slug: 'ppr', name: 'PPR', track: 'military',
    tagline: 'Prior Permission Required — from public request form to approval to the PDF log.' },
  { slug: 'scn', name: 'SCN', track: 'military',
    tagline: 'Secondary Crash Net activation records with per-agency notification logging.' },
  { slug: 'daily-reviews', name: 'Daily Reviews', track: 'military',
    tagline: 'The shift sign-off queue that satisfies the daily review requirement.',
    regCite: 'DAFMAN 13-204 V2, Para 2.5.2.10' },
  { slug: 'personnel-on-airfield', name: 'Personnel on Airfield', track: 'military',
    tagline: 'Contractor and escort credentials with expiry tracking.',
    regCite: 'AF Form 483' },
  { slug: 'amtr', name: 'AMTR', track: 'military',
    tagline: 'The Airfield Management Training Record, fleet-wide — 623A signatures, 1098 tracking, records inspections.' },
  { slug: 'flip-management', name: 'FLIP Management', track: 'military',
    tagline: 'Flight Information Publication accountability and currency, tracked.' },
  { slug: 'events-log-reports', name: 'Events Log & Reports', track: 'military',
    tagline: 'An append-only events log plus daily, trends, aging, and lighting reports.',
    regCite: 'AF Form 3616' },

  // ── Civilian (14) ─────────────────────────────────────────────
  { slug: 'airport-status', name: 'Airport Status', track: 'civilian',
    tagline: 'Live field, NAVAID, and surface-condition status your whole operation works from.' },
  { slug: 'dashboards', name: 'Dashboards', track: 'civilian',
    tagline: 'Customizable dashboards that surface the day\'s workload at login.' },
  { slug: 'self-inspections', name: 'Self-Inspections', track: 'civilian',
    tagline: 'Part 139 self-inspections stepped through item by item, with the record to prove it.',
    regCite: '14 CFR §139.327' },
  { slug: 'work-orders', name: 'Discrepancies & Work Orders', track: 'civilian',
    tagline: 'Airfield discrepancies routed to maintenance and tracked to verified closure.' },
  { slug: 'sms', name: 'Safety Management System', track: 'civilian',
    tagline: 'Hazard reporting, risk assessment, and safety assurance in one closed loop.' },
  { slug: 'aep', name: 'Airport Emergency Plan', track: 'civilian',
    tagline: 'AEP management aligned to the emergency-plan requirement, exercise-ready.',
    regCite: '14 CFR §139.325' },
  { slug: 'part-139-training', name: 'Training', track: 'civilian',
    tagline: 'Personnel training records and currency, aligned to §139.303.',
    regCite: '14 CFR §139.303' },
  { slug: 'wildlife', name: 'Wildlife', track: 'civilian',
    tagline: 'Wildlife hazard management — sightings, strikes, and trend visibility.',
    regCite: '14 CFR §139.337' },
  { slug: 'notams', name: 'NOTAMs', track: 'civilian',
    tagline: 'The live FAA feed scoped to your airport, with expiry alerts.' },
  { slug: 'ppr', name: 'PPR', track: 'civilian',
    tagline: 'Prior Permission Required requests from public form to approval, with a clean audit trail.' },
  { slug: 'parking', name: 'Parking', track: 'civilian',
    tagline: 'Aircraft parking with clearance envelopes computed against design standards.',
    regCite: 'AC 150/5300-13B' },
  { slug: 'personnel', name: 'Personnel on Airfield', track: 'civilian',
    tagline: 'Contractor and escort tracking with credential expiry.' },
  { slug: 'reports', name: 'Reports', track: 'civilian',
    tagline: 'Daily operations, trends, aging, and lighting analytics on demand.' },
  { slug: 'records-export', name: 'Records Export', track: 'civilian',
    tagline: 'Records retention and disposition exports, inspection-ready.',
    regCite: '14 CFR §139.301' },
]

export const militaryModules = MODULES.filter((m) => m.track === 'military')
export const civilianModules = MODULES.filter((m) => m.track === 'civilian')
```

- [ ] **Step 5: Write `lib/site-config.ts`**

```ts
export interface AdoptionStat {
  /** Real number as display string ("14"). null ⇒ stat is hidden. NEVER invent a value. */
  value: string | null
  label: string
}

export const siteConfig = {
  name: 'Glidepath',
  legalName: 'Glidepath Technologies, LLC',
  motto: 'Guiding you to mission success.',
  url: 'https://glidepathops.com',
  appUrl: 'https://app.glidepathops.com',
  contactEmail: 'info@glidepathops.com',
  nav: [
    { label: 'Military', href: '/military' },
    { label: 'Civilian', href: '/civilian' },
    { label: 'Platform', href: '/platform' },
    { label: 'Security', href: '/security' },
  ],
  // Spec §5: generic adoption stats only. Values supplied by the owner at
  // execution time; null values are hidden by StatsBand, never faked.
  adoptionStats: [
    { value: null, label: 'military airfields in daily use' },
    { value: null, label: 'inspections completed on the platform' },
    { value: null, label: 'discrepancies tracked to closure' },
  ] as AdoptionStat[],
}
```

- [ ] **Step 6: Write `lib/home-content.ts`**

```ts
export const heroContent = {
  headline: 'Guiding you to mission success.',
  subline:
    'One operations platform for military airfields and Part 139 airports — built on the regulations you operate under.',
  primaryCta: { label: 'Request a demo', href: '/demo' },
  secondaryCta: { label: 'Explore the platform', href: '#operation' },
}

export const regulationStrip = [
  'DAFMAN 13-204',
  'UFC 3-260-01',
  'AFMAN 91-203',
  'DAFMAN 91-212',
  '14 CFR Part 139',
]

export const deepDives = [
  {
    eyebrow: 'DAFMAN 13-204 V2 · Table A3.1',
    title: 'Visual NAVAIDs that watch the thresholds for you',
    body: 'The outage engine evaluates every lighting system against Table A3.1 thresholds and raises four-tier alerts the moment a system falls below minimums — bar-out detection included. Your team sees the impact before the phone rings.',
    imageAlt: 'Visual NAVAIDs map with a lighting system flagged below threshold',
  },
  {
    eyebrow: 'Inspections & Checks',
    title: 'From first item to signed record without leaving the flow',
    body: 'Inspections and checks step through every item, hand discrepancies off to the tracking module as they are found, and archive a signed PDF the moment the run is complete. The compliance record writes itself while the work happens.',
    imageAlt: 'An in-progress airfield inspection with items being completed',
  },
  {
    eyebrow: 'Live Airfield Status',
    title: 'The picture everyone works from',
    body: 'NOTAMs, WWA Notifications, open discrepancies, and field conditions on one live screen — the same truth for the tower, the field, and leadership, updated as the day unfolds.',
    imageAlt: 'The Airfield Status screen showing runway, NOTAM, and discrepancy state',
  },
]

export const securityStrip = {
  points: [
    'No sensitive personal data on the platform',
    'Row-level tenant isolation on every table',
    'PDF reports generated client-side — documents never transit third parties',
  ],
  link: { label: 'Security & compliance', href: '/security' },
}

export const closingCta = {
  title: 'See your airfield in Glidepath.',
  body: 'A live walkthrough with your scenarios — military or civilian.',
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/modules-data.test.ts tests/terminology.test.ts
```

Expected: all pass (4 roster tests + 9 terminology guards).

- [ ] **Step 8: Full gate + commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Add module registry, site config, home copy + terminology guard tests

All site copy lives in typed data; spec §4/§2/§5 terminology rules are
enforced as regression tests over every copy string.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 5: Site header + footer + brand assets

**Files:**
- Create: `components/layout/site-header.tsx`, `components/layout/mobile-nav.tsx`, `components/layout/site-footer.tsx`
- Create: `public/brand/wordmark-dark.png`, `app/favicon.ico` (copied from airfield-app)
- Modify: `app/layout.tsx` (mount header/footer)
- Test: `tests/site-header.test.tsx`

**Interfaces:**
- Consumes: `siteConfig.nav`, `siteConfig` org fields (Task 4); `Container` (Task 3); token classes (Task 2).
- Produces: `SiteHeader()` and `SiteFooter()` mounted in the root layout around `{children}` — later pages get them for free. `MobileNav({ nav })` is internal to the header.

- [ ] **Step 1: Copy brand assets from the app repo**

```bash
mkdir -p public/brand
cp /c/Users/cspro/airfield-app/public/Glidepath_logo_sidenav_dark.png public/brand/wordmark-dark.png
cp /c/Users/cspro/airfield-app/public/favicon.ico app/favicon.ico
```

Expected: both files exist (`ls public/brand app/favicon.ico`).

- [ ] **Step 2: Write the failing header test** — `tests/site-header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { SiteHeader } from '@/components/layout/site-header'

describe('SiteHeader', () => {
  it('renders all four nav links with correct hrefs', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('link', { name: 'Military' })).toHaveAttribute('href', '/military')
    expect(screen.getByRole('link', { name: 'Civilian' })).toHaveAttribute('href', '/civilian')
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/platform')
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/security')
  })

  it('renders the demo CTA pointing at /demo', () => {
    render(<SiteHeader />)
    const ctas = screen.getAllByRole('link', { name: 'Request a demo' })
    expect(ctas.length).toBeGreaterThanOrEqual(1)
    for (const cta of ctas) expect(cta).toHaveAttribute('href', '/demo')
  })

  it('links the wordmark to the homepage', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('link', { name: /glidepath — home/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/site-header.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/layout/site-header'`.

- [ ] **Step 4: Write the components**

`components/layout/mobile-nav.tsx` (client — the only stateful piece):

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

export function MobileNav({ nav }: { nav: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-md border border-line text-ink"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
          {open ? (
            <path d="M2 2l14 10M16 2L2 12" stroke="currentColor" strokeWidth="1.6" />
          ) : (
            <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.6" />
          )}
        </svg>
      </button>
      {open && (
        <nav
          aria-label="Mobile"
          className="absolute inset-x-0 top-full border-b border-line bg-ground/95 backdrop-blur"
        >
          <ul className="space-y-1 px-5 py-4">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link href="/demo" onClick={() => setOpen(false)} className="btn-primary w-full">
                Request a demo
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}
```

`components/layout/site-header.tsx`:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { Container } from '@/components/ui/container'
import { MobileNav } from '@/components/layout/mobile-nav'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between">
        <Link href="/" aria-label="Glidepath — home" className="flex items-center">
          <Image
            src="/brand/wordmark-dark.png"
            alt=""
            width={160}
            height={32}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/demo" className="btn-primary ml-3">
            Request a demo
          </Link>
        </nav>
        <MobileNav nav={siteConfig.nav} />
      </Container>
    </header>
  )
}
```

`components/layout/site-footer.tsx`:

```tsx
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { Container } from '@/components/ui/container'
import { GlidepathDivider } from '@/components/ui/glidepath-divider'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-12">
        <GlidepathDivider className="mb-10 opacity-60" />
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
              {siteConfig.legalName}
            </p>
            <p className="mt-2 text-sm italic text-muted">{siteConfig.motto}</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={`mailto:${siteConfig.contactEmail}`} className="text-muted hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-10 font-mono text-xs text-faint">
          © {new Date().getFullYear()} {siteConfig.legalName}
        </p>
      </Container>
    </footer>
  )
}
```

- [ ] **Step 5: Mount in `app/layout.tsx`** — change the `body` element to:

```tsx
      <body className="font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
```

with the two imports added at the top of the file:

```tsx
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/site-header.test.tsx
```

Expected: 3 passed.

- [ ] **Step 7: Visual check, full gate, commit**

Run `npm run dev`, verify at `http://localhost:3000`: sticky header with wordmark, four nav items, sky CTA; hamburger menu opens/closes on a narrow window; footer shows LLC + motto. Stop the server. If the wordmark renders at a wrong aspect ratio, adjust only `width`/`height` numbers to the PNG's true ratio — keep `className="h-7 w-auto"`.

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Add site header, mobile nav, footer, and brand assets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 6: Route stubs for nav targets

Honest placeholders so the preview never 404s from its own nav. Each is
replaced wholesale in its phase (`/military`, `/civilian` → Phase 3;
`/platform`, `/security`, `/demo` → Phase 4).

**Files:**
- Create: `app/military/page.tsx`, `app/civilian/page.tsx`, `app/platform/page.tsx`, `app/security/page.tsx`, `app/demo/page.tsx`
- Test: `tests/route-stubs.test.tsx`

**Interfaces:**
- Consumes: `Container`, `SectionHeading` (Task 3); `siteConfig.contactEmail` (Task 4).
- Produces: five routes, each exporting `metadata` with a `title` and rendering an `h1`. Phase 3/4 replace file contents but keep the paths.

- [ ] **Step 1: Write the failing test** — `tests/route-stubs.test.tsx`:

```tsx
import { render, screen, cleanup } from '@testing-library/react'
import MilitaryPage, { metadata as militaryMeta } from '@/app/military/page'
import CivilianPage, { metadata as civilianMeta } from '@/app/civilian/page'
import PlatformPage, { metadata as platformMeta } from '@/app/platform/page'
import SecurityPage, { metadata as securityMeta } from '@/app/security/page'
import DemoPage, { metadata as demoMeta } from '@/app/demo/page'

const cases = [
  { Page: MilitaryPage, meta: militaryMeta, h1: /military airfield management/i },
  { Page: CivilianPage, meta: civilianMeta, h1: /part 139 airport operations/i },
  { Page: PlatformPage, meta: platformMeta, h1: /platform/i },
  { Page: SecurityPage, meta: securityMeta, h1: /security & compliance/i },
  { Page: DemoPage, meta: demoMeta, h1: /request a demo/i },
]

describe('route stubs', () => {
  for (const { Page, meta, h1 } of cases) {
    it(`${String(meta.title)} renders an h1 and has metadata`, () => {
      render(<Page />)
      expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument()
      expect(meta.title).toBeTruthy()
      expect(meta.description).toBeTruthy()
      cleanup()
    })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/route-stubs.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/military/page'`.

- [ ] **Step 3: Write the five stubs**

`app/military/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

export const metadata: Metadata = {
  title: 'Military Airfield Management',
  description:
    'Airfield management built on DAFMAN 13-204 — status, inspections, checks, discrepancies, NOTAMs, and more in one platform.',
}

export default function MilitaryPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow="Military Airfields" title="Military airfield management, built on DAFMAN 13-204" />
      <p className="mt-4 max-w-2xl text-muted">
        The full module catalog for this track is being written now. In the
        meantime, a live walkthrough shows all of it.
      </p>
      <Link href="/demo" className="btn-primary mt-8">
        Request a demo
      </Link>
    </Container>
  )
}
```

`app/civilian/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

export const metadata: Metadata = {
  title: 'Part 139 Airport Operations',
  description:
    'Airport operations software built for 14 CFR Part 139 — self-inspections, SMS, AEP, training records, and more in one platform.',
}

export default function CivilianPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow="Civilian Airports" title="Part 139 airport operations, in one platform" />
      <p className="mt-4 max-w-2xl text-muted">
        The full module catalog for this track is being written now. In the
        meantime, a live walkthrough shows all of it.
      </p>
      <Link href="/demo" className="btn-primary mt-8">
        Request a demo
      </Link>
    </Container>
  )
}
```

`app/platform/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

export const metadata: Metadata = {
  title: 'Platform',
  description:
    'The capabilities under every module: offline-capable PWA, permission matrix, multi-base tenancy, PDF exports, and the mapping engine.',
}

export default function PlatformPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow="Platform" title="The platform under every module" />
      <p className="mt-4 max-w-2xl text-muted">
        Offline-capable PWA, role-based permissions, multi-base tenancy, PDF
        report generation, and the mapping engine — the full page is on its way.
      </p>
      <Link href="/demo" className="btn-primary mt-8">
        Request a demo
      </Link>
    </Container>
  )
}
```

`app/security/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

export const metadata: Metadata = {
  title: 'Security & Compliance',
  description:
    'Data posture, tenant isolation, and the hosting and accreditation roadmap.',
}

export default function SecurityPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow="Security" title="Security & compliance" />
      <p className="mt-4 max-w-2xl text-muted">
        No sensitive personal data on the platform, row-level tenant isolation,
        and a hosting roadmap written for both audiences — the full page is on
        its way.
      </p>
      <Link href="/demo" className="btn-primary mt-8">
        Request a demo
      </Link>
    </Container>
  )
}
```

`app/demo/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Request a Demo',
  description:
    'See Glidepath live with your scenarios — military airfield or Part 139 airport.',
}

export default function DemoPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow="Demo" title="Request a demo" />
      <p className="mt-4 max-w-2xl text-muted">
        A live walkthrough with your scenarios — military or civilian. The
        request form lands here shortly; until then, email works just as well.
      </p>
      <a href={`mailto:${siteConfig.contactEmail}?subject=Glidepath%20demo%20request`} className="btn-primary mt-8">
        Email {siteConfig.contactEmail}
      </a>
    </Container>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/route-stubs.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Full gate + commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Add honest route stubs for the five nav targets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 7: Homepage — hero + regulation strip

**Files:**
- Create: `components/home/hero.tsx`, `components/home/regulation-strip.tsx`

**Interfaces:**
- Consumes: `heroContent`, `regulationStrip` (Task 4); `Container`, `AppFrame` (Task 3); token classes (Task 2).
- Produces: `Hero()` and `RegulationStrip()` — assembled into `app/page.tsx` in Task 9 (which also carries the homepage test; components stay untested until assembly, deliberately, since Task 9's page test covers them rendered together).

- [ ] **Step 1: Write `components/home/hero.tsx`**

The glidepath line is drawn as an absolutely-positioned SVG descending from
the headline block into the screenshot frame — the motif introduced exactly
once, at full size (spec §6/§7).

```tsx
import Link from 'next/link'
import { heroContent } from '@/lib/home-content'
import { Container } from '@/components/ui/container'
import { AppFrame } from '@/components/ui/app-frame'

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-20 sm:pt-28">
      <Container>
        <div className="relative z-10 max-w-3xl">
          <p className="eyebrow">Airfield &amp; airport operations</p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
            {heroContent.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{heroContent.subline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={heroContent.primaryCta.href} className="btn-primary">
              {heroContent.primaryCta.label}
            </Link>
            <Link href={heroContent.secondaryCta.href} className="btn-ghost">
              {heroContent.secondaryCta.label}
            </Link>
          </div>
        </div>

        <div className="relative mt-16">
          <svg
            className="pointer-events-none absolute -top-14 left-0 hidden h-14 w-full sm:block"
            viewBox="0 0 1100 56"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1="0" y1="4" x2="860" y2="50" stroke="#38BDF8" strokeWidth="1.5" opacity="0.7" />
            <line x1="860" y1="50" x2="1100" y2="50" stroke="#38BDF8" strokeWidth="1.5" opacity="0.3" />
            <circle cx="860" cy="50" r="3.5" fill="#38BDF8" />
          </svg>
          <AppFrame
            alt="The Glidepath Airfield Status screen"
            label="Airfield Status — live capture lands with the screenshot pipeline"
          />
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Write `components/home/regulation-strip.tsx`**

```tsx
import { regulationStrip } from '@/lib/home-content'
import { Container } from '@/components/ui/container'

export function RegulationStrip() {
  return (
    <section aria-label="Regulations Glidepath is built on" className="border-y border-line bg-surface2/50">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-5">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
          Built on the regulations
        </span>
        {regulationStrip.map((reg) => (
          <span key={reg} className="font-mono text-sm text-muted">
            {reg}
          </span>
        ))}
      </Container>
    </section>
  )
}
```

- [ ] **Step 3: Type-check and commit** (page-level test lands in Task 9)

```bash
npm run lint && npx tsc --noEmit && npm run build
git add -A && git commit -m "Add homepage hero and regulation strip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 8: Homepage — operation split + deep dives

**Files:**
- Create: `components/home/operation-split.tsx`, `components/home/deep-dives.tsx`

**Interfaces:**
- Consumes: `militaryModules`, `civilianModules` (Task 4); `deepDives` (Task 4); `Container`, `SectionHeading`, `AppFrame` (Task 3).
- Produces: `OperationSplit()` (renders `id="operation"` — the hero's secondary CTA anchor target) and `DeepDives()`. Assembled in Task 9.

- [ ] **Step 1: Write `components/home/operation-split.tsx`**

Track card counts derive from the registry — they can never drift from the
data (spec §8's "rosters can't drift" rule applied to the homepage too).

```tsx
import Link from 'next/link'
import { militaryModules, civilianModules } from '@/lib/modules-data'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

const tracks = [
  {
    kicker: 'Military Airfields',
    line: 'DAFMAN 13-204 operations — status, inspections, checks, discrepancies, NOTAMs, training records, and the rest of the airfield day.',
    count: militaryModules.length,
    href: '/military',
  },
  {
    kicker: 'Civilian Airports',
    line: 'FAA Part 139 operations — self-inspections, SMS, AEP, training, wildlife, and the records that prove compliance.',
    count: civilianModules.length,
    href: '/civilian',
  },
]

export function OperationSplit() {
  return (
    <section id="operation" className="scroll-mt-24 py-20">
      <Container>
        <SectionHeading eyebrow="Two configurations" title="Built for your operation" />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {tracks.map((track) => (
            <Link
              key={track.href}
              href={track.href}
              className="group rounded-xl border border-line bg-surface2 p-7 transition hover:border-skyline"
            >
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-sky">
                {track.kicker}
              </p>
              <p className="mt-3 text-muted">{track.line}</p>
              <p className="mt-6 font-mono text-sm text-ink">
                {track.count} modules{' '}
                <span aria-hidden="true" className="text-sky transition group-hover:translate-x-1">
                  →
                </span>
              </p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Write `components/home/deep-dives.tsx`**

```tsx
import { deepDives } from '@/lib/home-content'
import { Container } from '@/components/ui/container'
import { AppFrame } from '@/components/ui/app-frame'
import { GlidepathDivider } from '@/components/ui/glidepath-divider'

export function DeepDives() {
  return (
    <section className="py-10">
      <Container>
        <div className="space-y-20">
          {deepDives.map((dive, i) => (
            <article
              key={dive.title}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
            >
              <div className={i % 2 === 1 ? 'md:order-2' : undefined}>
                <p className="eyebrow">{dive.eyebrow}</p>
                <h3 className="mt-2 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {dive.title}
                </h3>
                <p className="mt-4 text-muted">{dive.body}</p>
              </div>
              <AppFrame
                alt={dive.imageAlt}
                label="App capture — screenshot pipeline"
                className={i % 2 === 1 ? 'md:order-1' : undefined}
              />
            </article>
          ))}
        </div>
        <GlidepathDivider className="mt-20" />
      </Container>
    </section>
  )
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run lint && npx tsc --noEmit && npm run build
git add -A && git commit -m "Add operation split cards and deep-dive rows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 9: Homepage — module mosaic, stats band, closing CTA, assembly

**Files:**
- Create: `components/home/module-mosaic.tsx`, `components/home/stats-band.tsx`, `components/home/security-strip.tsx`, `components/home/closing-cta.tsx`
- Modify: `app/page.tsx` (full assembly)
- Test: `tests/home.test.tsx`

**Interfaces:**
- Consumes: `MODULES` (Task 4), `siteConfig.adoptionStats` (Task 4), `closingCta` (Task 4), primitives (Task 3), `Hero`/`RegulationStrip` (Task 7), `OperationSplit`/`DeepDives` (Task 8).
- Produces: the complete homepage. **Mosaic chips are static (non-link) in Phase 1** — Phase 3 turns each chip into a `Link` to `/{track}/{slug}`. `StatsBand` renders `null` when every stat value is `null` — Phase-agnostic contract: never render an empty or fabricated stat.

- [ ] **Step 1: Write the failing tests** — `tests/home.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import HomePage from '@/app/page'
import { ModuleMosaic } from '@/components/home/module-mosaic'
import { StatsBand } from '@/components/home/stats-band'

describe('HomePage', () => {
  it('renders the motto as the h1', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Guiding you to mission success.' })
    ).toBeInTheDocument()
    cleanup()
  })

  it('renders the security strip pointing at /security', () => {
    render(<HomePage />)
    expect(screen.getByText('No sensitive personal data on the platform')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Security & compliance' })).toHaveAttribute(
      'href',
      '/security'
    )
    cleanup()
  })

  it('renders both track cards with live module counts', () => {
    render(<HomePage />)
    expect(screen.getByText('Military Airfields')).toBeInTheDocument()
    expect(screen.getByText('Civilian Airports')).toBeInTheDocument()
    expect(screen.getByText(/22 modules/)).toBeInTheDocument()
    expect(screen.getByText(/14 modules/)).toBeInTheDocument()
    cleanup()
  })
})

describe('ModuleMosaic filter', () => {
  it('shows all modules by default, filters by track on click', () => {
    render(<ModuleMosaic />)
    expect(screen.getByText('Visual NAVAIDs')).toBeInTheDocument()
    expect(screen.getByText('Airport Status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Civilian' }))
    expect(screen.queryByText('Visual NAVAIDs')).not.toBeInTheDocument()
    expect(screen.getByText('Airport Status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Military' }))
    expect(screen.getByText('Visual NAVAIDs')).toBeInTheDocument()
    expect(screen.queryByText('Airport Status')).not.toBeInTheDocument()
    cleanup()
  })
})

describe('StatsBand', () => {
  it('renders nothing when all stat values are null (spec §5 — never fake stats)', () => {
    const { container } = render(<StatsBand stats={[{ value: null, label: 'airfields' }]} />)
    expect(container.firstChild).toBeNull()
    cleanup()
  })

  it('renders only stats with real values', () => {
    render(
      <StatsBand
        stats={[
          { value: '12', label: 'military airfields in daily use' },
          { value: null, label: 'hidden stat' },
        ]}
      />
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText('hidden stat')).not.toBeInTheDocument()
    cleanup()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/home.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/home/module-mosaic'`.

- [ ] **Step 3: Write the components**

`components/home/module-mosaic.tsx` (client — carries the filter state). The
filter is a chip cluster: one bordered container, dimmed off-state (the
airfield-app grouped-toggle pattern):

```tsx
'use client'

import { useState } from 'react'
import { MODULES, type Track } from '@/lib/modules-data'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

const FILTERS: { label: string; value: Track | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Military', value: 'military' },
  { label: 'Civilian', value: 'civilian' },
]

export function ModuleMosaic() {
  const [filter, setFilter] = useState<Track | 'all'>('all')
  const visible = MODULES.filter((m) => filter === 'all' || m.track === filter)

  return (
    <section className="py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="The full catalog" title="Every module, one platform" />
          <div
            role="group"
            aria-label="Filter modules by track"
            className="inline-flex rounded-full border border-line bg-surface2 p-1"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  'rounded-full px-4 py-1.5 font-mono text-xs transition',
                  filter === f.value ? 'bg-sky text-ground' : 'text-faint hover:text-muted'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phase 3: each chip becomes <Link href={`/${m.track}/${m.slug}`}> */}
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <li
              key={`${m.track}-${m.slug}`}
              className="rounded-lg border border-line bg-surface2 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{m.name}</span>
                <span className="chip">{m.track === 'military' ? 'MIL' : 'CIV'}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{m.tagline}</p>
              {m.regCite && <p className="mt-2 font-mono text-xs text-faint">{m.regCite}</p>}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```

`components/home/stats-band.tsx`:

```tsx
import type { AdoptionStat } from '@/lib/site-config'
import { Container } from '@/components/ui/container'

/** Renders nothing until real values exist. Never fabricate a stat (spec §5). */
export function StatsBand({ stats }: { stats: AdoptionStat[] }) {
  const real = stats.filter((s): s is { value: string; label: string } => s.value !== null)
  if (real.length === 0) return null

  return (
    <section aria-label="Adoption" className="border-y border-line bg-surface2/50">
      <Container className="grid gap-8 py-12 sm:grid-cols-3">
        {real.map((stat) => (
          <div key={stat.label}>
            <p className="font-mono text-4xl font-semibold tabular-nums text-white">{stat.value}</p>
            <p className="mt-1 text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </Container>
    </section>
  )
}
```

`components/home/security-strip.tsx`:

```tsx
import Link from 'next/link'
import { securityStrip } from '@/lib/home-content'
import { Container } from '@/components/ui/container'

export function SecurityStrip() {
  return (
    <section aria-label="Security" className="py-16">
      <Container className="rounded-xl border border-line bg-surface2 p-7 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow">Security</p>
            <ul className="mt-4 space-y-2">
              {securityStrip.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-muted">
                  <span aria-hidden="true" className="mt-0.5 font-mono text-sky">
                    ▸
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Link href={securityStrip.link.href} className="btn-ghost">
            {securityStrip.link.label}
          </Link>
        </div>
      </Container>
    </section>
  )
}
```

`components/home/closing-cta.tsx`:

```tsx
import Link from 'next/link'
import { closingCta } from '@/lib/home-content'
import { Container } from '@/components/ui/container'

export function ClosingCta() {
  return (
    <section className="py-24">
      <Container className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {closingCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">{closingCta.body}</p>
        <Link href="/demo" className="btn-primary mt-8">
          Request a demo
        </Link>
      </Container>
    </section>
  )
}
```

- [ ] **Step 4: Replace `app/page.tsx` with the full assembly**

```tsx
import { Hero } from '@/components/home/hero'
import { RegulationStrip } from '@/components/home/regulation-strip'
import { OperationSplit } from '@/components/home/operation-split'
import { DeepDives } from '@/components/home/deep-dives'
import { ModuleMosaic } from '@/components/home/module-mosaic'
import { StatsBand } from '@/components/home/stats-band'
import { SecurityStrip } from '@/components/home/security-strip'
import { ClosingCta } from '@/components/home/closing-cta'
import { siteConfig } from '@/lib/site-config'

export default function HomePage() {
  return (
    <>
      <Hero />
      <RegulationStrip />
      <OperationSplit />
      <DeepDives />
      <ModuleMosaic />
      <StatsBand stats={siteConfig.adoptionStats} />
      <SecurityStrip />
      <ClosingCta />
    </>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/home.test.tsx
```

Expected: 6 passed.

- [ ] **Step 6: Ask the owner for real adoption numbers**

Ask the user for real values for the three `adoptionStats` entries in
`lib/site-config.ts` ("military airfields in daily use", "inspections
completed on the platform", "discrepancies tracked to closure" — or
replacement labels they prefer). If they supply values, fill them in; if not
available yet, leave `null` — the band stays hidden and the site remains
honest. Do not proceed past this step without asking.

- [ ] **Step 7: Visual review on the dev server**

`npm run dev` → `http://localhost:3000`. Verify against spec §7's wireframe:
hero (motto h1, sub-line, two CTAs, glidepath line descending into the framed
placeholder) → regulation strip → split cards → three alternating deep dives →
mosaic with working filter → stats band (hidden if values are null) →
security strip → closing CTA. Check at 375px width: no horizontal scroll, hamburger works. Stop the
server.

- [ ] **Step 8: Full gate + commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Assemble the homepage: mosaic with track filter, stats band, closing CTA

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 10: SEO foundation — sitemap + robots

**Files:**
- Create: `app/sitemap.ts`, `app/robots.ts`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Consumes: `siteConfig.url` (Task 4).
- Produces: `sitemap()` listing the six live routes; `robots()` allow-all with sitemap pointer. Phase 3 extends the sitemap with module routes (it will map over `MODULES` — noted here so the shape is anticipated). Vercel previews send `x-robots-tag: noindex` automatically, so allow-all is safe before launch; the apex only attaches at Phase 5 cutover.

- [ ] **Step 1: Write the failing test** — `tests/seo.test.ts`:

```ts
import sitemap from '@/app/sitemap'
import robots from '@/app/robots'

describe('sitemap', () => {
  it('lists the homepage and the five nav routes on the production origin', () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://glidepathops.com')
    for (const path of ['/military', '/civilian', '/platform', '/security', '/demo']) {
      expect(urls).toContain(`https://glidepathops.com${path}`)
    }
  })
})

describe('robots', () => {
  it('allows all and points at the sitemap', () => {
    const r = robots()
    expect(JSON.stringify(r.rules)).toContain('"allow":"/"')
    expect(r.sitemap).toBe('https://glidepathops.com/sitemap.xml')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/seo.test.ts
```

Expected: FAIL — `Cannot find module '@/app/sitemap'`.

- [ ] **Step 3: Write the routes**

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/military', '/civilian', '/platform', '/security', '/demo']
  return routes.map((path) => ({
    url: `${siteConfig.url}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.8,
  }))
}
```

`app/robots.ts`:

```ts
import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/seo.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Full gate + commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add -A && git commit -m "Add sitemap and robots routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
```

---

### Task 11: CI workflow + repo CLAUDE.md

**Files:**
- Create: `.github/workflows/ci.yml`, `CLAUDE.md`

**Interfaces:**
- Consumes: the scripts from Task 1.
- Produces: green CI on `main`; a conventions file future sessions load automatically.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npm run build
```

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
# CLAUDE.md

## Project Overview

glidepath-site — the marketing and SEO site for Glidepath (glidepathops.com).
The product itself lives in the sibling `airfield-app` repo and serves at
app.glidepathops.com. Design spec of record:
`airfield-app/docs/superpowers/specs/2026-07-02-marketing-website-design.md`.

## Stack

Next.js 15.3.9 (App Router, static rendering) · React 19.1 · TypeScript strict ·
Tailwind CSS 3.4 · Vitest + Testing Library · next/font (Archivo + IBM Plex
Mono, self-hosted at build — no runtime font CDN) · Vercel.

## Conventions

- Kebab-case filenames; PascalCase component names; alias `@/*` → repo root.
- Dark-only. Design tokens live in `tailwind.config.ts` + `app/globals.css`
  (`ground/surface/surface2/ink/muted/faint/sky/amber` + `.btn-primary`,
  `.btn-ghost`, `.chip`, `.chip-amber`, `.eyebrow`). Amber is outlined-pill
  only, never filled blocks.
- **All copy lives in `lib/` data files** (`modules-data.ts`, `site-config.ts`,
  `home-content.ts`) — never hardcode marketing copy in components. New copy
  sources must be added to `tests/terminology.test.ts`'s `allCopy()`.
- **Terminology guards are law:** `tests/terminology.test.ts` enforces the
  spec's language rules (never "AMT", "FOD walk", paper comparisons,
  snake_case role keys, "PII", endorsement claims). If a guard fails, fix the
  copy, not the test.
- Adoption stats render only real values (`null` hides) — never invent numbers.
- No fabricated regulatory citations; omit rather than guess.
- Commit trailer: `Co-Authored-By:` line for the Claude model in use.

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build (ESLint decoupled — runs in CI separately) |
| `npm run lint` | ESLint (errors fail, warnings don't) |
| `npm run test` | Vitest |
| `npx tsc --noEmit` | Type check |

## Deployment

Vercel project `glidepath-site`, preview deploys on every push. **Never attach
glidepathops.com or any production domain — the apex cutover is Phase 5 of the
plan and is executed by the owner.**
```

- [ ] **Step 3: Push and verify CI**

```bash
git add -A && git commit -m "Add CI workflow and repo conventions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ggut2oY1Nj8VSfnsQiJS6H"
git push
gh run watch --exit-status
```

Expected: the CI run completes green (lint → tsc → vitest → build). If `gh run watch` reports no runs yet, wait for the push webhook: `gh run list --limit 1` until the run appears.

---

### Task 12: Vercel project + preview deploy (owner-assisted)

**Files:** none (dashboard operations + verification)

**Interfaces:**
- Consumes: the pushed `main` branch.
- Produces: a Vercel preview/production URL on `*.vercel.app` serving the homepage. **No custom domain.**

- [ ] **Step 1: Owner creates the Vercel project**

These are dashboard steps for the user (they own the Vercel account). Present them exactly:

1. Vercel dashboard → **Add New… → Project** → Import `glidepath-site` from GitHub.
2. Framework preset: **Next.js** (auto-detected). Build command / output: defaults. Root directory: repo root.
3. Environment variables: **none needed in Phase 1** (leads/rate-limit env vars come with the Phase 4 demo form).
4. Click **Deploy**. Do **not** add any domain on the Domains tab.

- [ ] **Step 2: Verify the deploy**

Once the user reports the deployment URL (e.g. `glidepath-site-xxxx.vercel.app`):

```bash
curl -s -o /dev/null -w "%{http_code}" https://<deployment-url>/
```

Expected: `200`. Then confirm with the user that the homepage renders correctly on their phone and desktop: hero, glidepath line, split cards, mosaic filter working (it's a client component — JS must hydrate), footer.

- [ ] **Step 3: Wrap Phase 1**

Report Phase 1 complete against the deliverable: repo scaffolded and pushed, CI green, design system + homepage live on a preview URL, 20+ tests passing including the terminology guards. Phase 2 planning (content model, demo tenants, screenshot pipeline) starts on user go-ahead.

---

## Later phases (each gets its own plan at its boundary)

- **Phase 2 plan:** extends `ModuleEntry` into the full page content model; seeds the two fictional demo tenants in the app; builds `scripts/capture-screenshots.ts` (Playwright) + the route manifest; swaps `AppFrame` placeholders for real captures. Includes the `lib/airport-mode.ts` civilian "Airport Status" relabel in the app repo (user-flagged 2026-07-02).
- **Phase 3 plan:** the module-page template, all ~36 module pages, track pillar pages replacing stubs, mosaic chips → links, sitemap extension over `MODULES`.
- **Phase 4 plan:** `/security`, `/about` (add to footer nav), `/faq` (+ JSON-LD), the `/demo` form (route handler → `marketing_leads` + Resend + rate limit + honeypot), `/privacy`, `/terms`, per-page OG images, Vercel Analytics.
- **Phase 5 plan:** app → `app.glidepathops.com` (Supabase auth URLs, hardcoded-domain sweep, PWA reinstall comms), apex cutover, transition redirects, Search Console, launch checklist. Owner executes cutover steps.

## Execution notes

- **Worktrees:** not applicable to Tasks 1–12 — this plan creates a brand-new repo; there is nothing to isolate from.
- If any airfield-app file is touched (none are in this plan), stop — that's out of scope for Phase 1.



