---
name: wrap-session
description: Wrap up a Glidepath work session. Updates SESSION_HANDOFF.md with what shipped, new issues / tech debt, and the task list for the next session, then verifies the app builds clean. Use when the user says "wrap up", "wrap session", "end of session", "let's call it", "session handoff", or otherwise signals they're done for the day.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# Wrap Session

End-of-session checklist for Glidepath. Four jobs:

1. Verify the app builds clean.
2. Rewrite `SESSION_HANDOFF.md` so the next session can start cold.
3. Surface anything that needs the user's attention before they sign off (uncommitted work, unapplied migrations, failing checks).
4. Commit and push — behind a confirmation — so the next machine (or the next session) starts from a synced tree.

**This skill commits and pushes on exit, behind a confirmation, so wrapping leaves the repo synced.** It rewrites `SESSION_HANDOFF.md`, verifies the build, then (step 5) shows exactly what will be committed and asks before running `git commit` + `git push`. It still will **not** tag or bump the version unless the user explicitly asks — those stay separate, deliberate steps. If the build fails (step 2), it stops there and never commits broken code.

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

### 5. Sync to origin (commit + push)

This is the step that actually gets the handoff and code to the next machine.
Only reach it if the build passed in step 2 — never push a broken tree.

1. Show the user the full set of changes that will be committed:

   ```bash
   git status
   git diff --stat
   ```

2. **Confirm before committing.** State plainly what you're about to do — e.g.
   "I'll commit these N files and push to `origin/main`. OK?" — and wait for a
   yes. If the user declines, stop here: the handoff is still written and they
   can sync manually.

3. On confirmation, stage everything, commit with an imperative summary of the
   session plus the current co-author trailer, and push:

   ```bash
   git add -A
   git commit -m "<imperative summary of the session>

   <optional body — why, not what>

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
   git push origin main
   ```

   Keep the trailer's model current with the one in use (see the Git convention
   in `CLAUDE.md`).

4. Confirm the push landed — `git status` should read `up to date with
   origin/main` — and report the pushed short SHA.

Still **do not** tag or bump the version unless the user explicitly asks.

End with a one-line summary: "Handoff written. Build clean. Pushed `<sha>`. N migrations pending." or, if the user declined the push, "Handoff written. Build clean. Not pushed (your call)."

## Style guidance for the handoff

- **Dates in Zulu** for in-app references but local date for the handoff header (`YYYY-MM-DD`).
- **Lowercase prose, no marketing voice.** "Migration 2026042803 fixes a race in PPR# minting" — not "Major improvement to PPR numbering reliability!"
- **Wrap lines at ~80 columns** in prose blocks. Tables don't wrap.
- **Inline code spans** for filenames, function names, SQL identifiers, env vars, commit SHAs.
- **Don't repeat the diff.** If the reader can see it in `git show`, the handoff should explain *why*, not *what*.
- **Don't list every file.** The "Key docs / files touched" section is for orientation, not auditing.
