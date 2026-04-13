# 22 — User Management

**Path:** Sidebar → Settings → User Management · URL `/settings/users`
**Who can access:** Base Admin, System Admin, Airfield Manager, NAMO

User Management is where administrators invite new users, approve self-registrations, assign roles, manage installation memberships, and deactivate accounts. This is an admin-only module. Regular users see their own profile in Settings → Profile.

---

## Overview

Every Glidepath user has:
- A **profile** (name, rank, email, OI, phone)
- A **role** (one of 9)
- One or more **installation memberships** scoped by base

Admins control who can sign in, what they can do, and where they can do it.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Role** | Determines module access and permitted actions. 9 roles in 3 tiers. |
| **Installation membership** | A row in `base_members` associating a user with an installation and assigning a role at that installation. |
| **Invite** | An email sent to a prospective user with a link to complete signup. |
| **Signup Pending** | A user who self-registered and awaits admin approval before gaining access. |
| **Deactivated** | A user record kept for audit trail but signed out and unable to sign in. |

---

## The 9 Roles

| Tier | Role | Primary permissions |
|---|---|---|
| **1 — Admin** | System Administrator | Full cross-installation access; user management across all installations |
| **1 — Admin** | Base Administrator | Full admin at assigned installations |
| **1 — Admin** | Airfield Manager | Full operational + administrative at assigned installations |
| **1 — Admin** | NAMO | NAVAID Maintenance Officer with administrative privileges |
| **2 — Operational** | AMOPS | Airfield Management Operations — no admin functions, full operational modules |
| **3 — Observer** | CES | Civil Engineering — restricted to work order flow |
| **3 — Observer** | Safety | Read-only across inspections, checks, discrepancies, reports |
| **3 — Observer** | ATC | Read-only status and operational awareness |
| **3 — Observer** | Read Only | View-only access to all modules |

---

## How to invite a user

1. User Management → **+ Invite User**.
2. Fill:
   - **Email**
   - **Role**
   - **Installation** (from the full 155-base directory in the picker)
3. Optional: initial name, rank.
4. Click **Send Invite**.
5. A **branded invite email** sends via Resend with a signup link.
6. The user signs up via the link and is created as Active (skipping the pending queue).

### Who can invite whom

- **System Admin** — any role at any installation.
- **Base Admin / Airfield Manager / NAMO** — any role at assigned installations, including airfield_manager and namo roles (added v2.29).
- **Others** — cannot invite.

## How to approve a Signup Pending user

1. User Management → **Pending** tab.
2. Review signup requests (name, email, requested installation, requested role).
3. Per request:
   - **Approve** — send Approved email, user becomes Active.
   - **Info Needed** — send Info Needed email requesting additional info.
   - **Reject** — send Rejected email, user is denied.
4. Approved users receive a branded email and can sign in immediately.

## How to change a user's role

1. User Management → find user → **Edit**.
2. Change **Role**.
3. Save.
4. Change takes effect immediately — user may need to refresh to see new module access.

## How to add a user to additional installations

1. Find user → **Edit** → **Memberships** section.
2. **+ Add Installation** → select from directory.
3. Select role at that installation (can be different per installation).
4. Save.

## How to remove a user from an installation

1. Find user → Edit → Memberships.
2. Remove the installation from the list.
3. Save. User immediately loses access to that installation's data.

## How to deactivate a user

1. Find user → Edit → **Deactivate**.
2. Confirm.
3. User is signed out of any active session and cannot sign in.
4. Audit trail preserved.

## How to delete a user (permanent)

**Caution: this is destructive. Prefer deactivation.**

1. Find user → Edit → **Delete**.
2. The system first nullifies 12 FK columns across 10 tables to preserve audit trail integrity.
3. Then deletes the profile and auth record.
4. All references to the user now show "[deleted user]" with the original OI where preserved.

## How to assign a user to a CES shop

1. Find user → Edit → **CES Shop Membership**.
2. Select one or more shops.
3. Save.
4. CES-role user will see work orders routed to those shops only.

## How to send a password reset

1. Find user → **Send Password Reset**.
2. Branded password reset email sends via Resend.
3. User follows the link to set a new password.

## How to mask or show user email

- Email is **hidden from user cards by default**.
- In the edit modal, click the eye icon to reveal (admin only).
- Users can toggle their own email visibility in Settings → Profile.

---

## Self-signup flow

1. User clicks **Create Account** on the login page.
2. Fills email, name, rank, selects installation from directory.
3. Signup Pending email sends automatically with a confirmation that approval is pending.
4. Admin reviews in User Management → Pending tab.
5. Admin approves → user receives Approved email and can sign in.

---

## Role permission quick reference

| Capability | Admin Tier | AMOPS | CES | Safety/ATC | Read Only |
|---|---|---|---|---|---|
| View operational data | Yes | Yes | Limited | Yes | Yes |
| Create inspections/checks | Yes | Yes | No | No | No |
| Manage discrepancies | Yes | Yes | Status only | No | No |
| Update airfield status | Yes | Yes | No | No | No |
| Execute QRCs | Yes | Yes | No | No | No |
| Manage users | Yes | No | No | No | No |
| Configure base settings | Yes | No | No | No | No |
| Switch installations | Sys Admin | Per-membership | Per-membership | Per-membership | Per-membership |

---

## CES role restrictions (worth re-reading)

The CES role implements separation of duties:
- Flattened sidebar: only 4 modules (CES Work Orders, Discrepancies read-only, Visual NAVAIDs read-only, Settings).
- Restricted status palette: can set In Work, Project, Work Completed. Cannot Close or Verify.
- Read-only access to all other modules (most are invisible in the sidebar).

See [07_ces_work_orders.md](07_ces_work_orders.md) for CES workflows.

---

## Keyboard shortcuts

None specific to User Management.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Invite email didn't arrive | Spam filter, or wrong email | Ask user to check spam; resend if needed. |
| User approved but can't sign in | RLS on `base_members` — user not in any membership | Check memberships; approval alone isn't enough. |
| Can't invite with role "airfield_manager" | Pre-v2.29 restriction | Update; Base Admins can now invite airfield_manager and namo. |
| User deletion blocked | FK constraints not pre-cleared | The system nullifies the 12 FKs first; if failed, check API logs. |
| CES user sees more than 4 sidebar modules | Role is wrong, or customization override | Verify role in User Management. |
| Password reset email doesn't arrive | Resend misconfigured or recipient filtering | Admin: verify Resend credentials. |
| Pending tab shows approved user | Cache lag | Refresh. |

---

## Related manual files

- [00_getting_started.md](00_getting_started.md) — Self-signup and profile basics.
- [07_ces_work_orders.md](07_ces_work_orders.md) — CES role specifics.
- [21_base_setup.md](21_base_setup.md) — Base-scoped configuration.
