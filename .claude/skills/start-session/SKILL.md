---
name: start-session
description: Orient on Glidepath at the start of a new session. Reads SESSION_HANDOFF.md to surface where the project left off, what's pending, and what the next session should pick up. Use when the user says "start session", "where did we leave off", "catch me up", "what's next", or otherwise opens a session without a specific task in hand.
tools: Read, Bash
---

# Start Session

Beginning-of-session orientation for Glidepath.

## Workflow

### 1. Pull latest from origin

Before reading anything, get the repo current — the whole multi-machine
workflow depends on this. `wrap-session` pushes on exit, so origin holds the
newest handoff and code from whatever machine you last worked on.

```bash
git status --porcelain          # confirm the tree is clean first
git pull --ff-only origin main
```

- If the working tree has **uncommitted changes**, stop and show them before
  pulling. Since `wrap-session` commits+pushes on exit, leftover uncommitted
  work usually means a session on *this* machine that never wrapped — let the
  user decide whether to stash, commit, or discard first.
- If `git pull --ff-only` **fails on divergence** (local `main` has commits not
  on origin), don't force it. Surface the divergence and let the user
  reconcile. In the normal case this is a clean fast-forward.

### 2. Read the handoff

Read `SESSION_HANDOFF.md` end-to-end. That file is the primary source of truth for project state.

### 3. Sanity-check against current state

Quick parallel reads to confirm the handoff isn't stale:

```bash
git log --oneline -5
git status
```

If the handoff's `**HEAD:**` SHA doesn't match the current `git log`, or there are uncommitted changes the handoff doesn't mention, flag it — work happened outside the handoff's view.

Also sweep for orphaned local servers:

```bash
netstat -ano | grep LISTENING | grep -E ":300[0-9]"
```

Prior sessions have leaked `next start` processes that squat ports 3000–3006 and keep serving stale builds — a server that outlives a rebuild 404s rotated chunks and can 500 authenticated pages (the 2026-07-03 "ghost listeners"). Identify anything found (PowerShell: `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`) and kill stale `next start` orphans from prior sessions before any local-server work.

### 4. Report back

Tell the user, in 4-6 lines:

- Whether the pull was a clean fast-forward, a no-op (already current), or hit
  something that needed attention (uncommitted work, divergence).
- The date of the last session and the headline of what shipped.
- Build status as of the handoff (clean / known failures).
- Anything pending: unapplied migrations, known issues, uncommitted work.
- The "Next session tasks" entry — what the user planned to pick up, or "no required next step" if the backlog was empty.
- Orphaned servers found on :300x, if any, and whether you killed them.

Then stop. Wait for the user to tell you what they want to do. Don't pre-emptively start work, propose plans, or read further files. The point of this skill is orientation, not action.
