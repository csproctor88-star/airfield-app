---
name: start-session
description: Orient on Glidepath at the start of a new session. Reads SESSION_HANDOFF.md to surface where the project left off, what's pending, and what the next session should pick up. Use when the user says "start session", "where did we leave off", "catch me up", "what's next", or otherwise opens a session without a specific task in hand.
tools: Read, Bash
---

# Start Session

Beginning-of-session orientation for Glidepath.

## Workflow

### 1. Read the handoff

Read `SESSION_HANDOFF.md` end-to-end. That file is the primary source of truth for project state.

### 2. Sanity-check against current state

Quick parallel reads to confirm the handoff isn't stale:

```bash
git log --oneline -5
git status
```

If the handoff's `**HEAD:**` SHA doesn't match the current `git log`, or there are uncommitted changes the handoff doesn't mention, flag it — work happened outside the handoff's view.

### 3. Report back

Tell the user, in 4-6 lines:

- The date of the last session and the headline of what shipped.
- Build status as of the handoff (clean / known failures).
- Anything pending: unapplied migrations, known issues, uncommitted work.
- The "Next session tasks" entry — what the user planned to pick up, or "no required next step" if the backlog was empty.

Then stop. Wait for the user to tell you what they want to do. Don't pre-emptively start work, propose plans, or read further files. The point of this skill is orientation, not action.
