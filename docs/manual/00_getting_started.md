# 00 — Getting Started

**Path:** `/login`, `/signup`, sidebar, more page, settings · Opens on your installation's Airfield Status by default.

This file covers installing the app, signing in, navigating, personalizing your profile, and switching between installations. Every other module assumes you've done the basics here.

---

## Overview

Glidepath is a Progressive Web App (PWA). You access it through a web browser — Chrome, Edge, Safari, or Firefox — on any device. You can also install it to your home screen or Start menu and run it like a regular app. Once you're signed in, your installation scopes everything you see: status boards, inspections, discrepancies, personnel, etc.

---

## Key Concepts

| Concept | What it means |
|---|---|
| **Installation** | Your base. Data is strictly scoped to installations — you cannot see another base's records unless you have explicit membership there. |
| **Role** | What you're allowed to do inside your installation (see [22_user_management.md](22_user_management.md)). The sidebar only shows modules your role has access to. |
| **Demo Mode** | A sandboxed "Demo AFB" installation with sample data. Accessible via `?demo=true` on the login URL. |
| **Operating Initials (OI)** | 1–4 character short-form of your name shown on events log entries and used for quick attribution. |
| **Default PDF email** | The address pre-filled whenever you email a PDF report. Change it anytime. |

---

## How to sign in

1. Open the app URL in your browser.
2. Enter your email and password.
3. (Optional) Check **Remember Me** to keep the session across browser restarts.
4. Click **Sign In**.
5. First-time users are prompted to complete a profile (rank, name, operating initials) and select an installation.

## How to create an account

1. On the login page, click **Create Account**.
2. Enter name, rank, email, and select an installation from the directory.
3. Submit. You will receive a "Signup Pending" branded email.
4. An administrator at your installation approves the request. Once approved, you get an "Approved" email and can sign in.

You cannot add a new installation from the signup form. If your base isn't listed, email `info@glidepathops.com` or click **Contact us**.

## How to reset your password

1. On the login page, click **Forgot Password**.
2. Enter your email.
3. Check your email for a password reset link (from `info@glidepathops.com`).
4. Follow the link and set a new password.

## How to open Demo Mode (no account required)

1. Append `?demo=true` to the login URL (e.g., `https://glidepath.example.com/login?demo=true`).
2. You're signed in as the demo user on Demo AFB.
3. Explore every module with sample data. Demo data is shared across demo users and resets periodically.

## How to install Glidepath to your home screen

**iOS (Safari):**
1. Tap the Share icon.
2. Scroll down → **Add to Home Screen**.
3. Confirm the name and tap **Add**.

**Android (Chrome):**
1. Tap the ⋮ menu.
2. Select **Install app** (or **Add to Home screen**).
3. Confirm.

**Desktop (Chrome / Edge):**
1. In the address bar, look for the install icon (a monitor with a down arrow) to the right.
2. Click it → **Install**.
3. Glidepath opens in a standalone window.

Installed Glidepath caches static assets and previously-loaded map tiles via a service worker — previously-visited maps will render instantly offline.

---

## Navigation

### Desktop

- **Sidebar** on the left shows every module your role has access to, organized into collapsible groups (Operations, Safety, Compliance, Admin, etc.).
- Click a module to open it. The current module is highlighted.
- **Customize Navigation** at the bottom of the sidebar lets you hide or reorder modules (see "How to customize the sidebar" below).
- **Sign Out** is below Customize Navigation.

### Mobile

- **Bottom tab bar** has five tabs: Status, Dashboard, Obstruction, Events Log, More.
- **More** opens a full page of every module not on the tab bar, plus Contact Support and Sign Out.

### Header

- Left: **Installation switcher** — tap to switch between installations you have access to.
- Right: **Presence indicator** (green dot if realtime is connected) and **your name / username**.

---

## How to customize the sidebar

1. Desktop → bottom of sidebar → **Customize Navigation**.
2. The customization page lists every available module.
3. Toggle visibility per module, or drag to reorder.
4. Save. Your preferences are stored per-user.

Modules you don't have access to (based on role) do not appear in the list.

## How to complete or update your profile

1. Sidebar / More page → **Settings** → **Profile** tab.
2. Edit: Rank, First Name, Last Name, Operating Initials (max 4 characters), Phone (optional).
3. (Optional) Toggle **Show my email to others** — default is hidden; when hidden, other users see a masked placeholder.
4. Save. Changes are visible immediately across the app.

## How to set your default PDF email

1. Settings → **Profile** tab → **Default PDF Email**.
2. Enter the email address used most often for report distribution (typically your shop's distro list).
3. Save.
4. Every Email PDF modal across the app pre-fills this address.

## How to toggle dark / light mode

1. Settings → **Appearance** section.
2. Toggle **Dark Mode** / **Light Mode**.
3. Applies instantly and persists per device.

## How to contact support

- Sidebar → **Contact Support** (below Customize Navigation).
- More page (mobile) → **Contact Support**.
- Settings → **Contact Support** button.

Each opens a pre-addressed mailto to `info@glidepathops.com` with a structured subject.

---

## How to switch installations

If your profile has access to multiple installations:

1. Click the installation name in the header (top-left).
2. The installation switcher drops down with every installation you belong to.
3. Select one.
4. The app resets all cached data, reconnects realtime subscriptions, and redirects to Airfield Status for the new installation.

System administrators can switch to any installation. Regular users only see installations they explicitly belong to (managed in User Management).

## How to sign out

- Desktop: Sidebar → **Sign Out** (at the bottom).
- Mobile: More page → **Sign Out** (at the bottom).

You're returned to the login page.

---

## About Zulu time

Every timestamp in Glidepath is displayed in Zulu (UTC). The trailing **Z** on times (e.g., `1500Z`) confirms this. The only exception is the Daily Operations PDF date picker, which uses installation-local time so you can pick "today" naturally.

Installation-local time appears where specifically relevant (inspection one-per-day cutoff at 0600L, shift checklist reset).

---

## Keyboard shortcuts (global)

| Key | Action |
|---|---|
| **Tab** / **Shift + Tab** | Move through form fields |
| **Enter** | Submit a form in focus |
| **Esc** | Close modal / cancel current action |

Module-specific shortcuts (Space for fullscreen, Arrow keys for nudge, etc.) are documented in each module's manual file.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login fails with correct credentials | Account not yet approved | Wait for admin approval email. If >24h, email `info@glidepathops.com`. |
| "Installation not selected" on first login | Profile not complete | Complete the profile prompt; you must pick an installation. |
| Sidebar doesn't show a module you expect | Your role doesn't permit it, or it's hidden in your customization | Check Settings → Customize Navigation. If not there, your role doesn't grant access — ask an admin. |
| Presence dot is red | Realtime subscription failed | Refresh the page. If persistent, check network (some corporate firewalls block WebSockets). |
| Password reset email doesn't arrive | Spam filter, or email address mismatch | Check spam/junk. Add `info@glidepathops.com` to safe senders. |
| Installed PWA opens in browser not as app | OS-level PWA install didn't complete | Uninstall (long-press the icon → Remove, or desktop right-click → Uninstall) and re-install via the browser prompt. |
| Installation switcher missing | You only belong to one installation | Ask your admin to add you to additional installations. |

---

## Related manual files

- [01_airfield_status.md](01_airfield_status.md) — The default landing page on mobile.
- [02_dashboard.md](02_dashboard.md) — KPI and activity hub.
- [22_user_management.md](22_user_management.md) — Roles, permissions, invites.
- [21_base_setup.md](21_base_setup.md) — Per-installation configuration (admin-only).
