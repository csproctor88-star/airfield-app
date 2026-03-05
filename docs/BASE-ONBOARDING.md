# Glidepath — Base Onboarding Guide

**For Base Administrators setting up a new installation in Glidepath**
**Version 2.14.0 | March 2026**

---

## OVERVIEW

This guide walks you through the full process of bringing your installation onto Glidepath — from initial coordination with the System Administrator through full base configuration and team onboarding. By the end, your base will have a fully configured airfield operations platform with your runways, NAVAIDs, inspection checklists, and team members ready to go.

**Estimated time:** 30–60 minutes for base configuration (depending on airfield complexity), plus time for team invitations.

**What you'll set up:**
1. Account access
2. Runways and runway endpoints
3. Navigation aids (NAVAIDs)
4. Airfield areas
5. Civil Engineering shops
6. Daily inspection templates
7. ACSI inspection configuration
8. Airfield diagram
9. Default PDF email
10. Team members

---

## STEP 1: COORDINATE WITH THE SYSTEM ADMINISTRATOR

Before you can begin configuring your base, a Glidepath **System Administrator** needs to set up your initial access.

**What the System Administrator does for you:**
1. Creates your installation in Glidepath (selects from the built-in directory of 155+ military installations, or manually adds your base if it's not on the list)
2. Creates your user account and assigns you the **Base Admin** (or **Airfield Manager**) role
3. Sends you an invitation email with a link to set up your password

**What you should provide to the System Administrator:**
- Your base's full name and ICAO code (e.g., "Selfridge ANG Base" / "KMTC")
- Your name, rank, and email address
- Your desired role (typically `base_admin` or `airfield_manager`)

**Optional — Bulk Data Seeding:**
If you'd prefer not to manually enter all of your airfield data (runways, NAVAIDs, areas, CE shops, etc.), you can provide this information to the System Administrator and they can seed it all at once on the backend. This is especially helpful for bases with complex airfield layouts or multiple runways. Simply compile the data listed in Steps 3–8 below and send it to your System Administrator. They'll have it loaded before you log in for the first time.

---

## STEP 2: SET UP YOUR ACCOUNT

Once the System Administrator has created your account, you'll receive an email invitation.

1. **Open the invitation email** and click the setup link
2. You'll be taken to the **"Welcome — Set Up Your Account"** page
3. **Create your password** and confirm it
4. Click **Submit** — your account is now active
5. You'll be redirected to the Glidepath login page
6. **Log in** with your email and the password you just created

After logging in, you'll see a **Login Activity Dialog** showing what happened since your last session — new discrepancies, checks, inspections, and status changes. This ensures you never miss what occurred while you were away.

You'll then land on the **Dashboard**. It will look mostly empty since your base hasn't been configured yet — that's what the next steps are for.

**Navigation:** On desktop and tablet, use the **sidebar** on the left to navigate between modules. On mobile, use the **bottom navigation bar** with a "More" menu for additional pages.

---

## STEP 3: CONFIGURE YOUR RUNWAYS

Runway data is the foundation of your base configuration. It's used by the dashboard (Active Runway control), obstruction evaluations, and inspection templates.

**Navigate to:** Settings → Base Configuration → Runways tab

**For each runway, click "+ Add Runway" and enter:**
- **Runway ID** — e.g., `01/19`, `05/23`, `10L/28R`
- **Runway Class** — `B` (Air Force Class B) or `Army_B` (Army Class B)
- **Length** — in feet (e.g., 9,000)
- **Width** — in feet (e.g., 150)
- **Surface type** — Asphalt, Concrete, or Asphalt/Concrete
- **True heading** — magnetic heading of the lower-numbered end
- **Endpoint coordinates** — latitude and longitude for each runway end
- **Designators** — e.g., `01` and `19`
- **Approach lighting** — type of approach lighting system at each end (if applicable)
- **Threshold elevations** — elevation in feet MSL at each runway end

**Where to find this data:**
- Your base's airfield diagram
- [AirNav.com](https://www.airnav.com) — search by ICAO code for coordinates, dimensions, and headings
- [SkyVector.com](https://skyvector.com) — airport diagrams and approach plates
- FAA Airport/Facility Directory
- Your installation's Airfield Operating Instruction (AOI)

**Tip:** If you have multiple runways, add them all now. The obstruction evaluation module evaluates against every configured runway simultaneously.

---

## STEP 4: CONFIGURE YOUR NAVAIDs

NAVAIDs appear on the dashboard as status toggles (Green/Yellow/Red) so your team can track the health of approach systems at a glance. Status changes push to all connected users in real time via Supabase Realtime — no page refresh needed.

**Navigate to:** Settings → Base Configuration → NAVAIDs tab

**Click "+ Add NAVAID" for each navigation aid at your installation.** Common examples:

| NAVAID | Description |
|--------|-------------|
| ILS 01 | Instrument Landing System (localizer + glideslope) |
| 01 Localizer | Localizer component only |
| 01 Glideslope | Glideslope component only |
| TACAN | Tactical Air Navigation (military DME/azimuth) |
| VORTAC | Combined VOR/TACAN |
| ASR-9 | Airport Surveillance Radar |
| PAR | Precision Approach Radar (GCA) |
| 01 PAPI | Precision Approach Path Indicator |
| 19 REILs | Runway End Identifier Lights |
| 01 MALSR | Medium-intensity Approach Lighting System |
| 01 SALS | Short Approach Lighting System |

**Tip:** Add them in the order you want them to appear on the dashboard. The sort order can be adjusted after creation.

---

## STEP 5: CONFIGURE AIRFIELD AREAS

Airfield areas are used throughout the app — in FOD checks (route selection), discrepancy tracking (location), inspections, and the Common Operating Picture map.

**Navigate to:** Settings → Base Configuration → Areas tab

**Click "+ Add Area" for each area your team inspects.** Typical areas include:

- Each runway (e.g., `RWY 01/19`)
- Each taxiway (e.g., `TWY A`, `TWY B`, `TWY K`)
- Ramp and apron areas (e.g., `East Ramp`, `West Ramp`, `Transient Ramp`)
- Hammerhead or turnaround areas (e.g., `North Hammerhead`, `South Hammerhead`)
- Arm/de-arm pads
- Overrun areas
- Perimeter or access roads
- Helicopter pads (if applicable)
- Hot cargo pads (if applicable)
- Any other areas specific to your installation

**Tip:** Think about every area your team covers during a FOD check or daily inspection — those should all be listed here.

---

## STEP 6: CONFIGURE CE SHOPS

Civil Engineering shops are used in the discrepancy module for assigning work orders to the appropriate shop.

**Navigate to:** Settings → Base Configuration → CE Shops tab

**Click "+ Add Shop" for each CE shop that handles airfield work.** Common examples:

- Electrical
- Pavements
- Structures
- Grounds
- HVAC (if applicable)

---

## STEP 7: SET UP INSPECTION TEMPLATES

Glidepath's daily inspection checklists are fully customizable per base. You'll set up the Airfield and Lighting inspection templates to match your installation's specific layout and infrastructure.

**Navigate to:** Settings → Inspection Templates

**Option A — Start from the default template (recommended):**
1. Click **"Initialize from Default Template"**
2. This clones a complete inspection checklist as a starting point (9 Airfield sections with 42 items, 5 Lighting sections with 32 items)
3. Then customize it for your base (see below)

**Option B — Build from scratch:**
1. Add sections manually for both the Airfield and Lighting halves
2. Add checklist items under each section

**Customizing your template:**
- **Add sections** — Create new sections for areas unique to your base
- **Edit sections** — Rename sections to match your airfield terminology
- **Remove sections** — Delete sections that don't apply to your installation
- **Add items** — Add checklist items under any section
- **Edit items** — Rename items to match your specific infrastructure (e.g., change "Stadium Lights" to your actual lighting configuration)
- **Remove items** — Delete items that don't apply
- **Reorder** — Drag sections and items into the order your inspectors prefer
- **Item type** — Toggle between Pass/Fail (standard) and BWC (four-state: LOW/MOD/SEV/PROHIB) for habitat-related items

**Tip:** Walk through a physical inspection of your airfield with the template open. Add, remove, and rename items so the digital checklist matches exactly what your inspectors check in the field.

**Note on default-to-pass:** All items default to Pass when an inspection is started. Inspectors only need to tap items that fail or are not applicable, which significantly speeds up routine inspections.

---

## STEP 8: UPLOAD YOUR AIRFIELD DIAGRAM

Upload your installation's airfield diagram so your team has it available as a reference throughout the app.

**Navigate to:** Settings → Base Configuration

**Click "Upload Diagram"** and select your airfield diagram image (PNG or JPG). The diagram is stored centrally in Supabase Storage so it's available on every device where a user logs in.

---

## STEP 9: SET YOUR DEFAULT PDF EMAIL

Configure a default email address for PDF exports. This saves time when emailing inspection reports, discrepancy summaries, or other PDF exports from the app.

**Navigate to:** Settings → Profile → Default PDF Email

Enter the email address you most commonly send reports to (e.g., your flight chief, operations group inbox, or your own .mil address). This address will be pre-filled in the email dialog whenever you export a PDF.

---

## STEP 10: VERIFY YOUR CONFIGURATION

Before inviting your team, take a few minutes to verify everything looks right.

**Dashboard check:**
- [ ] Active Runway card shows your runway(s) and you can toggle the active end
- [ ] NAVAID status panels display all your navigation aids with green/yellow/red toggles
- [ ] Weather data is pulling for your installation's location
- [ ] Installation name and ICAO code are correct in the header
- [ ] Advisory system allows setting INFO, CAUTION, or WARNING banners

**Quick function check:**
- [ ] Open a new discrepancy form — verify your airfield areas and CE shops appear in the dropdowns
- [ ] Open the inspection workspace — verify your customized template loads with the correct sections and items
- [ ] Open the checks page — verify your airfield areas appear in the route/location selection
- [ ] Open the obstruction evaluation tool — verify your runways appear and the map centers on your installation

**Real-time check (requires two devices or browser tabs):**
- [ ] Change the runway status in one tab — verify it updates in the other tab within 1–2 seconds
- [ ] Change an advisory — verify it pushes to the other tab automatically

If anything is missing, go back to the relevant configuration step and add it.

---

## STEP 11: INVITE YOUR TEAM

Now that your base is configured, invite your Airfield Management team.

**Navigate to:** User Management (accessible from the sidebar or More menu)

**For each team member, click "+ Invite User" and enter:**
- **Email address** (required — visible only to administrators, hidden from other users for privacy)
- **Rank** (dropdown)
- **First name** and **Last name**
- **Role** (see role guide below)
- **Installation** (your base will be pre-selected)

**Click "Send Invitation"** — the user will receive an email with a link to set up their account, just like you did in Step 2.

### Choosing the Right Role

Glidepath uses a three-tier role system with Row-Level Security enforced at the database level — users can only see and modify data for their assigned installation.

| Role | Tier | Who should have it | What they can do |
|------|------|-------------------|-----------------|
| `sys_admin` | Admin | System-wide administrators | Full cross-base access, all functions |
| `base_admin` | Admin | Senior leadership needing admin access | Full access within their base: create/edit all data, manage users, configure settings |
| `airfield_manager` | Admin | NCOIC, Flight Chief, or designated AFM | Full access within their base: create/edit all data, manage users, configure settings |
| `namo` | Admin | NAMO personnel | Full access within their base: create/edit all data, manage users, configure settings |
| `amops` | Ops | AMOPS technicians (day-to-day operators) | Create and edit discrepancies, checks, and inspections; view reports |
| `ces` | Ops | Civil Engineering shop personnel | View and update assigned discrepancies; limited access |
| `safety` | Read | Wing Safety officers | View-only access to all modules and reports |
| `atc` | Read | Air Traffic Control personnel | View-only access to discrepancies, NOTAMs, and airfield status |
| `read_only` | Read | Observers, visitors, or leadership needing view access | View-only access to dashboard and reports |

**Tip:** Start by inviting your core Airfield Management team (`airfield_manager` or `amops` roles). You can always invite additional users from other sections later.

**Note:** As a Base Admin, you can invite users to your own base with any operational role. Only a System Administrator can assign admin-tier roles (`sys_admin`, `base_admin`) or assign users to other installations.

---

## STEP 12: ORIENT YOUR TEAM

Once your team members have set up their accounts, consider a brief orientation:

1. **Walk through the Dashboard** — Show the runway status controls, NAVAID toggles, advisory system, BWC/RSC conditions, and quick action buttons. Emphasize that all changes push to every user in real time.
2. **Demonstrate a daily inspection** — Open the workspace, show how items default to Pass (tap to cycle: pass → fail → N/A), explain multi-discrepancy per failed item with per-issue photos, and demonstrate the Complete/File workflow and PDF export.
3. **Create a test discrepancy** — Show photo capture, map pinning with the Common Operating Picture, CE shop assignment, and the status lifecycle.
4. **Run through a check** — Pick a common check type (RSC or FOD) and complete it together. Show how drafts save automatically to the cloud and can be resumed on another device.
5. **Show the ACSI module** — Walk through the Annual Compliance Safety Inspection with its 10 sections and ~100 checklist items. Show how failures generate discrepancies with work orders, cost estimates, and risk certification signatures.
6. **Demonstrate email PDF delivery** — Export any report or inspection as a PDF and email it directly from the app using the built-in email dialog.
7. **Show the references library** — Demonstrate searching for a regulation, caching PDFs for offline use, and uploading personal documents.
8. **Explain the activity log** — Show how every action is tracked and auditable, and how the login activity dialog keeps everyone informed.

**Tip:** Glidepath has a built-in **Demo Mode** that runs with sample data and no server connection. If you want to train new team members without affecting live data, they can practice in demo mode first.

---

## QUICK REFERENCE — WHAT YOU NEED TO GATHER

Before starting, collect the following information about your installation:

| Data | Where to find it | Used in |
|------|------------------|---------|
| Base name and ICAO code | AOI, AirNav.com | Installation setup |
| Runway dimensions, headings, and coordinates | Airfield diagram, AirNav.com, SkyVector.com | Runway config, obstruction evals |
| Runway threshold elevations (MSL) | Approach plates, AirNav.com | Obstruction evals |
| NAVAID list | AOI, approach plates | Dashboard status tracking |
| Airfield areas inspected | Local procedures, AOI | Checks, discrepancies, inspections |
| CE shop names | Base CE squadron org chart | Discrepancy assignment |
| Inspection checklist items | Current paper/electronic checklist | Inspection templates |
| ACSI checklist customizations | DAFMAN 13-204v2, local AOI | ACSI inspection config |
| Team member names, emails, and roles | Flight roster | User invitations |
| Airfield diagram image (PNG/JPG) | Base Airfield Management office | Reference throughout app |
| Default report email address | Your flight's distribution list or inbox | PDF email delivery |

---

## NEED HELP?

- **Bulk data setup** — If you'd prefer not to enter all configuration data manually, send the information listed above to your System Administrator. They can seed all of your airfield data (runways, NAVAIDs, areas, CE shops, templates, and even historical waivers) in bulk on the backend, so your base is fully configured before your team logs in for the first time.
- **Base not in the directory** — If your installation isn't in the built-in 155-base directory, a System Administrator can manually add it. The system will automatically create the base site structure, and you can then configure all data through the admin UI.
- **Technical issues** — Contact the Glidepath System Administrator or development team for support.
- **Feature requests** — Feedback is welcome. Let the development team know what would make Glidepath work better for your installation.

---

*Glidepath v2.14.0 — Base Onboarding Guide*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB*
