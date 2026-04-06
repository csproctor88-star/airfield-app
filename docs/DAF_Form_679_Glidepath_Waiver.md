# DAF Form 679 — Waiver Request for Glidepath Digital Events Log

Use this content to fill out DAF Form 679, Department of the Air Force Publication Compliance Item Waiver Request/Approval.

---

## Block 1: Publication Title and Date

DAFMAN 13-204 Volume 2, Airfield Management, 20 September 2024 (Corrective Action, 17 December 2024)

## Block 2: Compliance Item(s) Requesting Waiver

**Paragraph 2.5.2.10.3 (T-3):**
"Each AMSL/AMOS will sign the AF Form 3616, or suitable substitute, in the appropriate block at the end of his or her shift. The AMSL/AMOS signature certifies the entries are correct and the form contains all required entries."

**Paragraph 2.5.2.10.4 (T-3):**
"The NAMO and either DAFM or AFM must sign after review of daily logs for trends on the airfield and/or in AM section (e.g., equipment outages and facility maintenance)."

**Note to both paragraphs:** "Systems that generate a CAC automated 'user signature' meets the intent of a 'signing or signature.'"

## Block 3: Rationale for Waiver

(Select reason that applies per Para 1.7.2.2)

**Reason (3): Expected cost of compliance outweighs the benefit.**

The [Unit] Airfield Management section uses Glidepath, a web-based airfield operations management application, as the authorized "suitable substitute (i.e., web-based program)" for AF Form 3616 per DAFMAN 13-204v2, Para 2.5.2.10.

Glidepath records all significant incidents/events on a continuous digital log with Zulu timestamps, operating initials, and full user attribution. The system requires individual user authentication (email and password) to access or create any entry. Every action — including shift acceptances, shift sign-offs, and supervisory reviews — is permanently recorded with the authenticated user's identity, operating initials, and exact Zulu time.

However, Glidepath does not currently integrate Common Access Card (CAC) authentication for automated digital signatures. CAC integration requires Department of Defense identity infrastructure (ADFS/certificate chain) that is not available on the application's current commercial hosting platform. The unit is pursuing DoD-authorized hosting through Platform One Party Bus to enable CAC authentication in a future release.

Implementing CAC authentication solely to satisfy the signature requirement would require migrating the entire application to DoD infrastructure — an effort that is already underway but not yet complete. In the interim, the authenticated user login with operating initials provides equivalent accountability to a CAC signature for the purpose of certifying events log entries.

Reverting to paper AF Form 3616 to obtain wet signatures while simultaneously maintaining the digital log would create a dual-entry burden, increase the risk of transcription errors, negate the operational benefits of the digital system (real-time visibility, searchability, PDF export, multi-shift continuity), and reduce overall data integrity.

## Block 4: Time Period or Circumstance the Waiver Is Needed

This waiver is requested for a period of **12 months** or until CAC authentication is integrated into the Glidepath application, whichever occurs first.

## Block 5: Risk Mitigation Measures

The following measures are in place to mitigate risk during the waiver period:

1. **Authenticated User Access:** Every user must authenticate with a unique email and password before accessing the system. No anonymous or shared access is permitted.

2. **Operating Initials on Every Entry:** All events log entries display the operating initials of the authenticated user who created the entry. Operating initials are assigned per DAFMAN 13-204v2, Para 2.5.2.6.

3. **Shift Sign-Off Entries:** At the end of each shift, the AMSL/AMOS creates a "Shift Change" entry in the events log certifying all entries for the shift are correct and complete. This entry is attributed to the authenticated user with OI and Zulu timestamp.

4. **Supervisory Review Entries:** The NAMO and/or AFM create a "Daily Log Review" entry after reviewing the events log for trends. This entry is attributed to the authenticated reviewer with OI and Zulu timestamp.

5. **Immutable Audit Trail:** All entries include user identity, operating initials, and Zulu timestamp. Edit and delete actions are logged with the original and modified content, the user who made the change, and the time of the change.

6. **PDF Export for Archival:** Daily events logs can be exported as PDF documents (Daily Operations Summary report) for filing in official records systems per AFI 33-322.

7. **Role-Based Access Control:** Five-tier role hierarchy (System Admin, Base Admin/AFM/NAMO, AMOPS, CES/Safety/ATC, Read Only) enforced at the database level via Row Level Security policies. Only authorized roles can create, edit, or delete events log entries.

8. **Multi-Factor Awareness:** The system tracks user presence (online/away/inactive), login activity, and last-seen timestamps. The Login Activity Dialog displays recent activity on first login each session.

## Block 6: Impact if Waiver Is Disapproved

If this waiver is disapproved, the unit will be required to maintain a paper AF Form 3616 alongside the Glidepath digital events log to satisfy the CAC signature requirement. This will result in:

- Dual-entry burden for all AMSL/AMOS personnel (every event logged twice)
- Increased risk of transcription errors and discrepancies between paper and digital records
- Loss of real-time operational visibility for personnel not physically present at the AM section
- Inability to leverage digital search, filtering, and reporting capabilities for the official record
- Reduced data integrity compared to the single-source digital system
- Additional administrative burden on NAMO/AFM for reviewing both paper and digital logs daily

The Airfield Management section will comply with the disapproval and maintain paper AF Form 3616 records until CAC authentication is integrated.

---

## Additional Information (Per Para 1.7.3)

### System Description

Glidepath is a mobile-first, responsive web application for managing airfield operations. It is currently deployed at [Installation Name] and is used as the primary "suitable substitute (i.e., web-based program)" for AF Form 3616 per DAFMAN 13-204v2, Para 2.5.2.10.

Key capabilities relevant to this waiver:
- Continuous events log with Zulu timestamps and operating initials (Para 2.5.2.10.1)
- Shift acceptance entries with authenticated user identity (Para 2.5.2.10.2)
- 19 minimum annotation items per Para 2.5.2.10.5 (inspections, checks, RSC/RCR, BWC, IFE/GE, NAVAID outages, runway changes, SCN activations, etc.)
- Daily Operations Summary PDF export for official records filing
- Real-time dashboard with airfield status, weather, and KPI tracking
- Full DAFMAN 13-204v2 Attachment 3 (Table A3.1) outage compliance engine for Visual NAVAIDs

### CAC Integration Roadmap

The unit has submitted a Platform One Party Bus onboarding request to migrate Glidepath to DoD-authorized infrastructure (IL4). Upon successful onboarding, CAC/PIV authentication will be integrated via the DoD Identity Provider (IdP), eliminating the need for this waiver.

---

## Routing

| Action | Name/Rank/Title | Date |
|--------|----------------|------|
| Requested By | [AFM Name, Rank, Duty Title] | |
| Recommended By | [AOF/CC Name, Rank] | |
| Recommended By | [OG/CC or Sq/CC Name, Rank] | |
| Approved/Disapproved By | [Wing/CC Name, Rank] (T-3 Approval Authority per DAFMAN 90-161, Table A10.1) | |

---

## Notes

- Per DAFMAN 13-204v2, Para 1.7.4: Provide an informational copy of this approved T-3 waiver to MAJCOM OPR for airfield operations. (T-2)
- Per DAFMAN 13-204v2, Para 1.7.2.3: T-3 waivers automatically expire 90 calendar days after a change in Wing/CC unless the new commander renews the waiver. Request 12-month period with commander continuity renewal clause.
- This waiver covers ONLY the CAC signature requirement. All other AF Form 3616 requirements (continuous log, minimum annotation items, shift changes, etc.) are fully met by the Glidepath application.
