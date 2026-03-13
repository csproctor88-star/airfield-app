# Glidepath Capability Deep Dive: Administration & Deployment

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's administration, multi-installation architecture, security model, and deployment pathway. This is the "how it works under the hood" story — essential for technical evaluators, cybersecurity reviewers, and leadership making deployment decisions.

---

## User Management

### Role-Based Access Control
Glidepath uses 8 user roles, each with specific permissions:

| Role | Can Create Records | Can Edit Records | Can Admin Users | Can Config Base |
|------|-------------------|-----------------|----------------|----------------|
| System Admin | Yes | Yes | Yes | Yes |
| Base Admin | Yes | Yes | Yes | Yes |
| Airfield Manager | Yes | Yes | Limited | Yes |
| NAMO | Yes | Yes | No | No |
| AMOPS | Yes | Yes | No | No |
| CES | No | Limited | No | No |
| Safety | No | Limited | No | No |
| ATC | No | No | No | No |
| Read-Only | No | No | No | No |

### User Lifecycle
1. **Create** — Admin creates a user account with name, email, rank, role, EDIPI, and installation assignment
2. **Activate** — User receives login credentials and accesses the system
3. **Operate** — User's actions are governed by their role and installation assignment
4. **Modify** — Admin can change role, installation, or status at any time
5. **Deactivate** — Disable access without deleting data (preserves audit trail)
6. **Delete** — Full removal including nullification of 12 foreign key columns across 10 tables (preserves records but removes user attribution)

### Operating Initials
Every user has a configurable Operating Initials field (1–4 characters, auto-uppercase). OIs are used throughout the Events Log for compact attribution. Users can self-edit their OI in Settings; admins can override via User Management.

### Privacy Controls
- **Email masking** — User emails are hidden by default in user cards, with an eye-toggle to reveal
- **EDIPI masking** — EDIPIs shown as masked values with click-to-reveal in admin views
- **No PII in logs** — Events Log entries use operating initials, not full names or emails

---

## Base Setup & Configuration

### Installation Wizard
Each installation is configured through a comprehensive setup wizard:

**Installation Metadata**
- Name and ICAO identifier
- Timezone (per-installation, affects all time displays)
- Checklist reset time (when the daily shift checklist resets, default 0600 UTC)

**Runways**
- Add/edit/delete runways with:
  - Runway designation pair (e.g., "18/36")
  - Latitude/longitude for each end
  - Length and width
  - Elevation
  - Surface type
- Runway data drives the obstruction evaluation geometry and map displays
- All runway data can be seeded automatically with coordinate through the Gldiepath developer

**Areas**
- Define airfield areas (runways, taxiways, aprons, shelters, access roads, misc)
- Areas populate dropdown selectors in discrepancies, checks, and inspections

**CE Shops**
- Configure Civil Engineering shops (CE Pavements, CE Electrical, CE Horizontal, CE Grounds, etc.)
- Shops populate assignment dropdowns in discrepancy tracking

**ARFF Aircraft**
- Register ARFF (Aircraft Rescue and Fire Fighting) vehicles
- Used in heavy aircraft check workflows

**Inspection Templates**
- Customize inspection sections and items per installation
- Different bases may have different inspection requirements based on their specific airfield infrastructure

**Airfield Diagram**
- Upload an airfield diagram image
- Displayed as reference during checks, inspections, and ACSI evaluations
- Stored in Supabase Storage with IndexedDB fallback for demo mode

**QRC Templates**
- Configure Quick Reaction Checklist templates per installation
- Define steps, SCN form requirements, and review schedules

---

## Multi-Installation Architecture

### How It Works
Glidepath is designed from the ground up for multi-installation deployment. The same application instance serves every Air Force airfield — no separate deployments, no code forks, no per-base customization.

**Data Isolation: Row-Level Security (RLS)**
Every table in the database has Row-Level Security policies enforced at the PostgreSQL level. This means:
- A user at Selfridge ANGB can only see Selfridge data
- A user at Hurlburt Field can only see Hurlburt data
- Even if someone bypasses the application layer, the database itself rejects unauthorized access
- System admins can access all installations for enterprise oversight

**RLS Helper Functions**
Three PostgreSQL functions enforce access:
- `user_has_base_access(base_id)` — can this user see data for this installation?
- `user_can_write(base_id)` — can this user create/modify data here?
- `user_is_admin()` — does this user have admin privileges?

**Zero-Code Onboarding**
Adding a new installation requires:
1. Create the installation record (name, ICAO, timezone)
2. Configure runways, areas, and CE shops
3. Create user accounts and assign to the installation
4. Done — no code changes, no deployment, no environment variables

This means scaling from 1 installation to 155 installations is purely a data operation. The application code is identical for every base.

### Installation Switching
Users with access to multiple installations (common for NAMOs, MAJCOMs, and system admins) can switch between installations instantly:
- Dropdown selector in the app header
- Entire application context changes — data, runways, areas, checks, discrepancies, everything
- No logout/login required
- Preferences and settings persist per-user across installations

---

## Security Architecture

### Authentication
- Email/password authentication via Supabase Auth
- Session management with automatic token refresh
- Login activity tracking (per-session flag, `last_seen_at` on profile)
- Activity dialog on login shows last seen time for security awareness

### Authorization
- Role-based permissions at the application layer
- Row-Level Security at the database layer (belt AND suspenders)
- Storage RLS on file uploads (photos, documents, diagrams)

### Data Protection
- All data transmitted over HTTPS (TLS 1.3)
- Database encryption at rest (Supabase-managed PostgreSQL)
- No sensitive data in client-side storage (localStorage stores only draft data, not credentials)
- Photo uploads through authenticated API (Supabase Storage with policy enforcement)

### Audit Trail
- Every create, update, and delete operation is logged in the Events Log
- Logs include operator identity, timestamp (Zulu), and action details
- System-generated log entries cannot be modified
- Full export capability for compliance reviews

---

## Progressive Web App (PWA)

### What It Means
Glidepath is a Progressive Web App — it runs in a web browser but behaves like a native mobile app:
- **Add to Home Screen** — tap the browser's share button and add Glidepath to your phone's home screen. It launches like an app with its own icon
- **Full-screen mode** — runs without browser chrome (address bar, tabs)
- **Responsive design** — layouts adapt from phone to tablet to desktop
- **Fast loading** — optimized for mobile networks
- **No app store required** — no installation, no updates to download, no IT approval for app store access

### Why PWA for DoD
- **No MDM conflicts** — doesn't require managed device app installation
- **No app store review** — updates deploy instantly to all users
- **Works on any device** — iOS, Android, Windows, Mac, ChromeOS
- **Accessible on NIPR** — just needs a web browser and network access
- **GFE and personal device** — works on government-issued and personal phones equally

---

## Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Next.js (App Router) | Industry-standard React framework, server-side rendering, optimized performance |
| Language | TypeScript | Type safety, better developer experience, fewer runtime errors |
| Database | PostgreSQL (Supabase) | Enterprise-grade relational database with RLS, real-time, and REST API |
| Authentication | Supabase Auth | Email/password with session management, easily replaceable with SSO/Keycloak |
| File Storage | Supabase Storage | S3-compatible object storage with RLS policies |
| Real-Time | Supabase Realtime | WebSocket subscriptions for live updates |
| Maps | Mapbox GL JS | Vector tile maps with satellite imagery, obstruction surface overlays |
| PDF Generation | jsPDF + jspdf-autotable | Client-side PDF creation with tables, images, and maps |
| Excel Export | SheetJS + exceljs | Styled spreadsheet generation with multiple sheet support |
| Email | Resend | Transactional email delivery for PDF distribution |
| Styling | CSS Variables | Dark theme with consistent design tokens, no heavy framework dependency |
| Offline Storage | IndexedDB (idb) | Client-side document caching for regulations library |

### No Vendor Lock-In
Every technology choice is standard and replaceable:
- PostgreSQL → any PostgreSQL host (AWS RDS, Azure, Platform One managed)
- Supabase Auth → Keycloak, Auth0, or any OIDC provider
- Supabase Storage → S3, Azure Blob, or any S3-compatible store
- Vercel (current host) → Docker container on any infrastructure
- Resend → any SMTP/transactional email service

---

## Platform One Party Bus Pathway

### What is Platform One?
Platform One is the DoD's enterprise DevSecOps platform. It provides:
- **Continuous Authority to Operate (cATO)** — deploy updates without individual ATO packages
- **Iron Bank** — DoD-hardened container image registry
- **GitLab CI/CD** — automated build, test, and deploy pipelines
- **Managed infrastructure** — Kubernetes clusters, databases, and services

### What is Party Bus?
Party Bus is Platform One's onboarding program for existing applications. Instead of building on P1 from scratch, you bring your working application and adapt it to P1's infrastructure.

### Glidepath's Readiness

**Already P1-Compatible:**
- Standard Next.js application — containerizes trivially (Dockerfile)
- Standard PostgreSQL database — no proprietary database features
- REST API patterns — standard HTTP endpoints
- Environment-driven configuration — all settings via environment variables
- No proprietary SDKs or locked-in services

**Adaptation Required:**
1. **Containerize** — Write Dockerfile for Next.js app (straightforward, well-documented)
2. **Iron Bank scan** — Submit container image for hardening review
3. **SSO integration** — Replace Supabase Auth with P1 Keycloak (swap auth provider config)
4. **Database migration** — Point to P1-managed PostgreSQL instance
5. **CI/CD pipeline** — Configure GitLab CI for automated testing and deployment
6. **STIG compliance** — Application and OS-level hardening per DoD STIGs

**Cost on Platform One:**
- Development cost: $0 (already built)
- Hosting cost: Near-zero (shared P1 infrastructure)
- Per-installation cost: Zero (same deployment serves all bases)
- Maintenance: Minimal (single codebase, no per-base forks)

---

## Deployment Numbers

| Metric | Value |
|--------|-------|
| Application version | 2.17.0 |
| Page routes | 48 |
| Database tables | 36 |
| Schema migrations | 82 |
| PDF generators | 11 |
| Source files | 160+ |
| User roles | 8 |
| Check types | 6 |
| Inspection types | 4 |
| ACSI items | ~100 |
| Discrepancy types | 11 |
| Waiver types | 6 |
| Report types | 4 |
| Regulation categories | 19 |
| Real-time subscriptions | 3 tables |
| Total development cost | $12 |
| Commercial hosting cost | ~$45/month per installation |
| P1 hosting cost | Near-zero |

---

## Why This Architecture Matters

### For Airfield Managers
- Works on your phone, tablet, and laptop without installing anything
- Your data is isolated — you only see your installation's information
- Secure — role-based access means you can only do what you're authorized to do

### For IT/Cybersecurity
- Standard technology stack — no exotic dependencies
- RLS enforcement at database level — not just application-level authorization
- Full audit trail — every action logged and attributable
- No PII exposure in logs or exports
- Containerizable for DoD infrastructure

### For Decision-Makers
- Zero development cost to deploy additional installations
- Single codebase serves every Air Force airfield
- Platform One compatible — cATO pathway exists
- No vendor lock-in — can migrate to any standard infrastructure
- Already production-quality — not a prototype requiring additional development

---

*Glidepath v2.17.0 — Enterprise architecture, built by an operator*
