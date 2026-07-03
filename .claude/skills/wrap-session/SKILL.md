---
name: wrap-session
description: Wrap up a Glidepath work session. Updates SESSION_HANDOFF.md with what shipped, new issues / tech debt, and the task list for the next session, then verifies the app builds clean. Use when the user says "wrap up", "wrap session", "end of session", "let's call it", "session handoff", or otherwise signals they're done for the day.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# Wrap Session

End-of-session checklist for Glidepath. Three jobs:

1. Verify the app builds clean.
2. Rewrite `SESSION_HANDOFF.md` so the next session can start cold.
3. Surface anything that needs the user's attention before they sign off (uncommitted work, unapplied migrations, failing checks).

**Do not commit, push, tag, or bump the version unless the user explicitly asks.** This skill writes one file (`SESSION_HANDOFF.md`) and runs read-only build checks. Everything else is the user's call.

## Workflow

### 1. Survey what happened this session

Run these in parallel, then read the results before doing anything else:

```bash
git log --oneline origin/main..HEAD 2>/dev/null || git log --oneline -20
git status
git diff --stat HEAD~10..HEAD 2>/dev/null
ls supabase/migrations/ | tail -15
```

For each commit since the last handoff (use the `**HEAD:**` line in the existing `SESSION_HANDOFF.md` as the cutoff), read the commit message body — `git log <prev-head>..HEAD` — so the rewrite captures intent, not just diff stats. Don't paraphrase from filenames alone.

If the user describes work that **isn't** in git yet (uncommitted edits, work-in-progress thoughts, decisions made in conversation), capture that too and flag it as uncommitted in the handoff.

### 2. Run build verification

Four checks, in this order. Run them in the foreground so you can read failures:

```bash
npx tsc --noEmit
npm run lint
npm run build
npx vitest run
```

`npm run lint` must show **zero errors** (warnings are fine — the project
keeps `no-explicit-any` / `no-unused-vars` at warn). Since the Next 15
upgrade, `next build` no longer lints; CI runs lint as its own gating step,
so a wrap that skips it can leave every subsequent push failing CI — exactly
what happened 2026-07-02/03 (13 `react/no-unescaped-entities` errors, a day
of failure emails).

If any fail:
- Stop and surface the failure to the user. Don't proceed to rewriting the handoff yet.
- Ask whether they want to fix it now or note it as a known issue and ship the handoff anyway.
- Capture the actual error text — the handoff's Build snapshot section needs to reflect reality, not aspiration.

If all pass, capture for the Build snapshot:
- `npm run build` First Load JS for the routes that changed this session (compare against the prior snapshot).
- Test count from vitest.

### 3. Rewrite SESSION_HANDOFF.md

Read the existing file first to match its tone and section ordering. Sections (in order):

1. **Header block** — Date, Branch, Build status, HEAD short SHA. One-liners.
2. **What shipped this session** — A 2-3 sentence theme paragraph, then one subsection per commit (or per logical group of commits). Each subsection: `### <headline> (\`<sha>\`)` followed by prose explaining the *why* and the *non-obvious how*. Read prior handoffs as the style template — they're dense, link cause to effect, and skip filename inventories.
3. **Migrations status** — table: file | Applied/Pending | what it does. Pull file list from `supabase/migrations/` filtered by date.
4. **Bugs fixed during the session** — table: Symptom | Root cause | Commit. Only include bugs that were genuinely surprising or that future-you would otherwise re-debug. Routine cleanups don't belong here.
5. **Lessons from this session** — bullets on anything the user or you would want to pin as durable guidance. If a lesson rises to "I don't want to re-learn this," also save it as a feedback memory (see auto-memory section in your system prompt).
6. **Known issues / tech debt** — table: Item | Severity | Notes. Carry forward unresolved items from the prior handoff, then add anything new surfaced this session. Drop items that were resolved.
7. **Next session tasks** — *This is the most important section.* If the active backlog is empty, say so explicitly ("Pick up wherever the user wants — there's no required next step"). If there's pending work, list it with enough context that the next session can start without re-deriving why. Carryover items go in a separate "Long-running carryover" subsection — those are bandwidth-permitting, not required.
8. **Build snapshot** — code fence with: build status line, tsc status, test count, Notable First Load JS table for the heaviest routes + any route that changed this session, Middleware size.
9. **Recent releases** — table: Version | Date | Headline. Carry forward, prepending today's row as `**Unreleased**` unless the user bumped the version. Reuse the existing rows verbatim.
10. **Key docs / files touched this session** — `### New files` and `### Modified files` lists. Helpful but optional — drop if the session was tiny. Do not list test files, lockfile changes, or generated output.

The handoff is the primary artifact. Treat it as if a different engineer will pick up cold tomorrow. Specifics > generalities. Cause-and-effect > inventories.

### 4. Final check before reporting done

Run `git status` one more time. Surface to the user:
- Whether `SESSION_HANDOFF.md` is the only new/modified file (expected) or if there's other uncommitted work.
- Any migrations in `supabase/migrations/` not marked Applied in the handoff — call these out as pending.
- Any failing checks from step 2 the user chose not to fix.
- Any local servers still running from this session (`netstat -ano | grep -E ":300[0-9]" | grep LISTENING`) — kill the ones this session started. Orphaned `next start` processes serve stale builds and become the next session's ghost listeners (2026-07-03).

End with a one-line summary: "Handoff written. Build clean. N migrations pending." or equivalent. Do not commit unless asked.

## Style guidance for the handoff

- **Dates in Zulu** for in-app references but local date for the handoff header (`YYYY-MM-DD`).
- **Lowercase prose, no marketing voice.** "Migration 2026042803 fixes a race in PPR# minting" — not "Major improvement to PPR numbering reliability!"
- **Wrap lines at ~80 columns** in prose blocks. Tables don't wrap.
- **Inline code spans** for filenames, function names, SQL identifiers, env vars, commit SHAs.
- **Don't repeat the diff.** If the reader can see it in `git show`, the handoff should explain *why*, not *what*.
- **Don't list every file.** The "Key docs / files touched" section is for orientation, not auditing.
