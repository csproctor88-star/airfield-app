# Glidepath: One App to Run the Airfield

## The Runway is the Mission

On every Air Force installation — active duty, Guard, and Reserve — there is a team of Airfield Management professionals responsible for the most mission-critical piece of infrastructure on the base: the runway. When the runway closes, the mission stops. Fighters don't fly. Tankers don't refuel. Cargo doesn't move. The entire operational capability of an installation depends on a functioning runway and the people who manage it.

These are the 1C7X1 career field — Airfield Managers. They inspect the runway for foreign object debris. They monitor the pavement for cracks, the lights for outages, and the vegetation for encroachment. They track weather conditions and runway surface conditions. They issue advisories when conditions change. They coordinate with Civil Engineering when something breaks and with Safety when wildlife becomes a hazard. They manage waivers when things don't meet standards. They file NOTAMs with the FAA when the airfield status changes. And they document everything — every check, every inspection, every discrepancy, every status change — because regulations require it and because lives depend on it.

There are over 155 military installations across the United States with Airfield Management sections performing these duties. And in 2026, nearly every one of them does it the same way: with paper, clipboards, spreadsheets, and filing cabinets.

## The Problem Nobody Has Solved

Think about what happens during a routine shift at an Airfield Management desk. The Airfield Manager arrives, checks the weather on one website, checks NOTAMs on another, reviews yesterday's discrepancy spreadsheet that was emailed to them, writes today's inspection results on a printed checklist, calls the tower to confirm runway status, opens a separate application to check waiver expirations, and picks up a clipboard to go walk the runway for FOD.

Each of these tasks uses a different tool. None of them talk to each other. Nothing is connected.

Now think about what happens every two to four years when that Airfield Manager PCSes to a new installation. All the local knowledge — which areas flood when it rains, which lights have been problematic for years, which waivers are coming due, which CE shop is responsive and which one isn't — all of that walks out the door. The next person shows up, opens a filing cabinet full of someone else's notes, and starts from scratch.

There is no enterprise digital solution for Airfield Management. None. Across the entire Department of the Air Force. This is a career field that touches every flying installation on the planet, and the standard toolset is a pen and a clipboard.

## What Glidepath Is

Glidepath is a mobile-first web application built specifically for Airfield Managers. It was created by MSgt Chris Proctor, an active-duty Airfield Manager with 18 years of career field experience at the 127th Wing, Selfridge Air National Guard Base in Michigan. He built it because he was tired of the problem — and he had the technical skills to solve it.

The application consolidates every Airfield Management function defined in Department of the Air Force Manual 13-204, Volumes 1 through 3, into a single platform that runs on any phone, tablet, or computer. It is not a concept. It is not a prototype. It is not a PowerPoint deck. It is a working application with 14 complete modules, 53 pages, over 51,000 lines of code, and zero compilation errors.

When an Airfield Manager opens Glidepath, the first thing they see is the dashboard — a real-time operational snapshot of their installation. The runway status is there: open, suspended, or closed, color-coded in green, yellow, or red. The weather is there: temperature, wind speed and direction, visibility. Any active advisories are displayed prominently. The NAVAIDs — ILS, PAPI, REIL — are all shown with green, yellow, or red status indicators. The most recent checks and inspections are summarized. And critically, all of this updates live. When someone at the AM desk changes the runway status, every user on the team sees it within seconds. No page refresh. No phone call. Everyone is looking at the same picture.

## What It Actually Does

Glidepath has 14 modules that cover the full spectrum of Airfield Management duties:

**Discrepancy Tracking** replaces the emailed spreadsheet. When an Airfield Manager finds a pothole on the taxiway, they open the app, tap "New Discrepancy," select the type (pavement deficiency), snap a photo with their phone, pin the location on a satellite map, assign it to the Civil Engineering pavement shop, and submit. The discrepancy gets a tracking number, shows up on a map view that the team calls the "Common Operating Picture," and starts an aging counter. When CE responds, the status updates. When the work is complete, the record is closed with a full audit trail. Every step is tracked with who did what and when.

**Airfield Checks** covers seven different check types that Airfield Managers perform: FOD checks (walking the runway for debris), Runway Surface Condition checks, Runway Condition Reading checks with friction measurements, In-Flight Emergency response, Ground Emergency response, Heavy Aircraft operations, and Bird/Wildlife Aircraft Strike Hazard assessments. Each check type has its own specialized form, but they all share the same workflow: fill out the form, attach photos, pin locations on the map, and submit. Drafts save automatically to the cloud so you can start on your phone and finish on a desktop.

**Daily Inspections** digitizes the Combined Airfield Inspection Report — the bread-and-butter document that every Airfield Management section produces daily. The app presents every checklist item organized by section, and each item defaults to Pass. When something fails, the inspector can attach multiple discrepancies to that item, each with its own comment, GPS location, and photos. The completed inspection exports to a branded PDF that can be downloaded or emailed directly from the app.

**The Annual Compliance Inspection** — called the ACSI — is a comprehensive review required by DAFMAN 13-204, Volume 2. It covers 10 sections and approximately 100 checklist items spanning obstacle clearance, lighting, pavement, marking, signage, NAVAIDs, wildlife management, emergency response, administration, and security. In Glidepath, each item gets a Yes, No, or N/A response, and any failure generates a discrepancy with work order tracking, cost estimates, and photo documentation. The inspection team is documented, and risk management certification signatures from the Operations Group Commander, Mission Support Group Commander, and Wing Commander are captured. The entire report exports to a professionally formatted PDF or Excel workbook.

**The Obstruction Evaluation Tool** automates what is arguably the most tedious manual process in Airfield Management. UFC 3-260-01 defines imaginary surfaces around military runways — invisible boundaries that protect aircraft approach and departure corridors. When someone wants to build a tower, plant a tree, or erect a crane near a runway, the Airfield Manager must evaluate whether that object penetrates any of these surfaces. Doing this by hand requires printed manuals, hand-drawn diagrams, and hours of trigonometric calculations. Glidepath does it in seconds. An Airfield Manager places a point on the satellite map, enters the object's height, and the system evaluates the object against all 10 surfaces across all base runways simultaneously. It identifies which surfaces are violated, calculates the penetration depth in feet, and provides the exact regulatory references. This turns a multi-hour process into a 30-second task — and eliminates calculation errors entirely.

**The Aircraft Database** contains over 200 military and civilian aircraft with detailed specifications — weights, dimensions, wheel geometry, and pavement loading numbers. The ACN/PCN Comparison Panel lets Airfield Managers instantly determine whether a particular aircraft is safe to operate on a specific runway based on pavement capacity. This is critical for Heavy Aircraft operations and airfield planning.

**The Regulations Library** provides instant access to 70 regulatory references from DAFMAN 13-204, UFC 3-260-01, and related publications. Every document can be viewed in-app with a built-in PDF viewer, and the entire library can be cached offline for use in the field where connectivity is unreliable. Airfield Managers can also upload their own personal documents.

**Waiver Management** replaces the filing cabinet. The application tracks every airfield waiver through its full lifecycle: draft, pending, approved, active, expired, closed. It captures all AF Form 505 fields, tracks office-by-office coordination signatures, stores photo attachments, and manages the annual review process. Seventeen real waivers from Selfridge Air National Guard Base are included as demonstration data. The waiver register exports to Excel with the same format as the AFCEC Playbook Appendix B — ready for a compliance review.

**The NOTAM module** pulls live Notices to Air Missions directly from the FAA's feed. When the page loads, it automatically fetches the current NOTAMs for the installation's ICAO code. The feed is searchable, filterable, and always current. Local NOTAMs can be drafted within the app.

**Reports and Analytics** generates four operational report types: a Daily Operations Summary that captures everything that happened during a shift or a date range, an Open Discrepancies snapshot for command briefings, a Discrepancy Trends analysis showing opened vs. closed over time, and an Aging Discrepancies report that highlights the oldest unresolved issues. Every report exports to a branded PDF and can be emailed directly from the app.

**The Activity Log** captures every action taken by every user — a complete audit trail with timestamps, user identification, and entity references. It also supports manual text entries for events that happen outside the app, like shift turnovers or phone calls from the tower.

**User Management** allows administrators to invite new users, assign roles, reset passwords, and manage the full account lifecycle. Nine roles across three tiers provide granular access control: system administrators have full cross-base access, base administrators and airfield managers have full access within their installation, and operational roles like AM Operations, Civil Engineering, Safety, and ATC have permissions tailored to their responsibilities.

## How It's Built

Glidepath uses an entirely open-source technology stack: Next.js for the web framework, TypeScript for type-safe code, PostgreSQL for the database (via Supabase), Tailwind CSS for styling, and Mapbox for interactive maps. There are no proprietary dependencies. No vendor lock-in. Any competent web developer can read, maintain, and extend the codebase.

The database has 28 tables and 61 migrations. Row-Level Security policies enforce data isolation at the database level — users can only see data from their assigned installation. Supabase Realtime subscriptions push live updates to all connected clients.

The application supports 155 U.S. military installations out of the box. Any new base can onboard through the admin interface without writing a single line of code. Configure the runways, set up the NAVAIDs and areas, customize the inspection templates, invite the users, and go.

## What It Costs

The total development cost to date is approximately twelve dollars — the price of the domain name. The developer labor was donated. The hosting, database, maps, weather data, NOTAM feed, and elevation API are all on free tiers. Production operation on commercial cloud infrastructure costs roughly $45 per month per installation. On Platform One, the DoD's enterprise hosting platform, the marginal cost per installation approaches zero.

## Why It Matters

Glidepath was built in 25 days by one person — an active-duty Airfield Manager — using AI-assisted development. It does not require a contract, a program office, or a multi-year development timeline. It is ready now.

The 1C7X1 career field has over 155 installations performing the same duties with the same paper-based processes. Every base faces the same problems: lost knowledge during PCS cycles, no real-time visibility for leadership, compliance risks from manual tracking, and hours wasted on redundant data entry. Glidepath solves all of them.

The application is architecturally ready for Platform One's Party Bus — the DoD's enterprise hosting platform that provides continuous authorization to operate. The stack is open-source and containerizable. The data classification is CUI at maximum. The path from "working application" to "enterprise capability" is a Platform One onboarding process, not a development effort.

The Air Force does not have an enterprise digital solution for Airfield Management. Glidepath is that solution. It is built, it is tested, and it is ready for deployment.

---

*Glidepath — "Guiding You to Mission Success"*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB*
*March 2026 — Version 2.14.0*
