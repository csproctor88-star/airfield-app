# Claude Code Starter Prompt
## Copy everything below the line and paste as your first message to Claude Code

---

Read the file `docs/SRS.md` completely before doing anything. This is the definitive Software Requirements Specification for the Airfield OPS Management Suite — a Next.js web application for USAF airfield management at Selfridge ANGB (KMTC), Michigan.

Also read `docs/Airfield_OPS_Unified_Prototype.jsx` if present — it's a visual reference for UI layout and interaction patterns. Use it for design guidance but follow the SRS for all technical decisions.

## Your task

Build this application following Section 13 (Development Phases & MVP Definition) in exact order. Start with step 1: Project Setup.

## Stack (do not deviate)

- Next.js 14+ with App Router and TypeScript
- Tailwind CSS for styling
- Supabase for database (PostgreSQL), auth, storage, and realtime
- Vercel for deployment
- Recharts for charts
- Lucide React for icons
- Zod for validation
- date-fns for date formatting

## Rules

1. Follow the SRS exactly. Do not add features, fields, screens, or behaviors not specified.
2. Use the exact database schema from Section 5 — table names, column names, types, and constraints as written.
3. Use the exact project structure from Section 3.2.
4. Use the exact business logic from Section 6 — SLA calculations, status transitions, severity configs, discrepancy types.
5. Use dark theme (slate-900 bg) as specified in Section 7.1 Design System.
6. Mobile-first responsive design. Minimum 44x44px touch targets.
7. All data operations via Supabase client in Server Components and Server Actions.
8. TypeScript strict mode. No `any` types.

## Step 1: Project Setup

Create the Next.js project with all dependencies from Section 3.1. Set up:
- TypeScript config (strict)
- Tailwind config with the dark theme colors from Section 7.1
- Supabase client files (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- Environment variable template (`.env.local.example`)
- Root layout with dark theme body class
- The project structure directories from Section 3.2 (empty files are fine for now)

Do NOT set up the database yet — I need to create the Supabase project first and provide the keys. Just get the Next.js project scaffolded and ready.

After completing step 1, stop and tell me what to do next (create Supabase project, get keys, etc.) before moving to step 2.
