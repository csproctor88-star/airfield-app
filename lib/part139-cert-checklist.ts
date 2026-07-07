// Part 139 certification-inspection readiness audit checklist.
// Faithful reproduction of FAA Form 5280-4 (FAA Order 5280.5D, Appendix G, pp.144-147).
// Section references = 14 CFR Part 139 Subpart D; per-item `citation` = the exact
// Form 5280-4 sub-paragraph. `guidance` (added in Phase 3-4) = transcribed from FAA
// Order 5280.5D — source chapter/paragraph noted in a `// src:` comment per section.
// Do not edit item text without re-checking the source — no fabricated reg text.
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import type { AcsiChecklistSection } from '@/lib/constants'
import type { AirportType } from '@/lib/airport-mode'

export const PART139_CERT_SECTIONS: AcsiChecklistSection[] = [
  // ── Section 1: Methods & Procedures for Compliance ──
  // src: 5280.5D §2.6
  {
    id: 'p139-mpc',
    number: 1,
    title: 'Methods & Procedures for Compliance',
    reference: '14 CFR §139.7',
    items: [
      {
        id: 'mpc.1',
        question: 'Compliance with Advisory Circulars',
        citation: '§139.7',
        guidance: 'Certificate holders must comply with the requirements of Part 139 Subparts C and D in a manner authorized by the Administrator. FAA Advisory Circulars contain acceptable methods and procedures for complying with Part 139; in some instances an AC is the only applicable guidance, and that level of guidance meets the intent of being acceptable to the Administrator. Each AC specifies its own applicability and intent, so ACSIs should consult the applicability section of the AC before relying on it.',
      },
    ],
  },
  // ── Section 2: Exemptions ──
  // src: 5280.5D §2.12
  {
    id: 'p139-exempt',
    number: 2,
    title: 'Exemptions',
    reference: '14 CFR §139.111',
    items: [
      {
        id: 'exempt.1',
        question: 'Justification Still Valid — No. on record',
        citation: '§139.111',
        guidance: 'Under 14 CFR Part 11, a certificate holder may petition for an exemption from any Part 139 requirement; petitions must meet the criteria in §139.111(b) and Part 11. Exemptions are time-limited and may not exceed 3 years, and each must be reviewed annually for currency, extension, or renewal. An exemption is not a Modification of Standards. Exemptions for ARFF requirements under §139.111(b) must be coordinated with AAS-300. A current Exemptions List must be kept with the approved ACM.',
      },
    ],
  },
  // ── Section 3: Airport Certification Manual ──
  // src: 5280.5D §3.2 (§139.201), §3.3 (§139.203)
  {
    id: 'p139-acm',
    number: 3,
    title: 'Airport Certification Manual',
    reference: '14 CFR §139.201/.203',
    items: [
      {
        id: 'acm.1',
        question: 'Compliance with ACM',
        citation: '§139.201(a)',
        guidance: 'Part 139 requires each certificated airport to be operated according to its ACM, which must contain only those items authorized by the Regional Airports Division or AAS-300.',
      },
      {
        id: 'acm.2',
        question: 'Preparation',
        citation: '§139.201(a)',
        guidance: 'The ACM must be approved by the Regional Airports Division Manager (or the Lead or assigned ACSI); submitted in print, in duplicate, with one complete approved copy kept at the airport and one at the Regional Airports Division (an electronic version is acceptable if it meets the same criteria); in a format easy to revise, with a revision log; signed by the certificate holder acknowledging its responsibility to operate in compliance with the approved ACM; and distributed, in full or by applicable section, to the personnel responsible for its implementation, with the most current version always provided regardless of distribution method.',
      },
      {
        id: 'acm.3',
        question: 'Content',
        citation: '§139.203',
        guidance: 'The ACM must address all parts of Part 139 that apply to the airport and be comprehensive, though it need not be an all-inclusive list of instructions — all text in an approved ACM is enforceable under the Federal Aviation Regulations. It must contain a description of operating procedures, facilities and equipment, and responsibility assignments; contain the required elements specified in §139.203(b) for the airport certificate class; reflect current conditions, operations, and procedures; display the date of initial approval or latest revision on each page; include a current revision log; and, where non-standard procedures or Modifications of Standards are in effect, include documentation supporting a level of safety comparable to that described in FAA ACs.',
      },
      {
        id: 'acm.4',
        question: 'Maintenance',
        citation: '§139.201(b)',
        guidance: 'The ACM must be kept current at all times and must include any modification-of-standards approval letters.',
      },
    ],
  },
  // ── Section 4: Records ──
  // src: 5280.5D §4.9.1, §4.9.2
  {
    id: 'p139-records',
    number: 4,
    title: 'Records',
    reference: '14 CFR §139.301',
    items: [
      {
        id: 'rec.1',
        question: 'Furnished upon Request',
        citation: '§139.301(a)',
        guidance: 'The certificate holder must furnish, upon request by the Administrator, all records required to be maintained under §139.301.',
      },
      {
        id: 'rec.2',
        question: 'Maintained for Specified Duration',
        citation: '§139.301(b)',
        guidance: 'Retention periods are record-specific: airport personnel training records (§139.303, §139.327) and emergency-personnel training records (ARFF/medical service, §139.319) — 24 consecutive calendar months; fueling agent training records — 24 consecutive calendar months; fueling-truck and fuel-storage-area inspection records — 12 consecutive calendar months; self-inspection records (§139.327) — 12 consecutive calendar months; ground-vehicle-operator and movement/safety-area-access training records (§139.329) — 24 consecutive calendar months, reflecting training within the prior 12 consecutive calendar months; movement- or safety-area accident/incident records (§139.329) — 12 consecutive calendar months; airport condition records (§139.339) — 12 consecutive calendar months, to be compared with NOTAMs issued; and any other records the Administrator determines necessary, such as work orders for self-inspection discrepancies.',
      },
    ],
  },
  // ── Section 5: Personnel ──
  // src: 5280.5D §4.10.1-4.10.4.5
  {
    id: 'p139-personnel',
    number: 5,
    title: 'Personnel',
    reference: '14 CFR §139.303',
    items: [
      {
        id: 'pers.1',
        question: 'Sufficient Qualified Personnel',
        citation: '§139.303(a)',
        guidance: 'The certificate holder must provide sufficient and qualified personnel to comply with its approved ACM and the requirements of Part 139. Per FAA policy at least one qualified employee or designee must be onsite during air carrier operations; the number needed depends on the airport size and layout and the volume and complexity of its operations. The ACSI cannot specify an exact staffing number but determines sufficiency from inspection findings — e.g. a high rate of non-compliance, observation of employees performing their duties, and staffing rosters or position descriptions — and may administer oral or written tests or request practical demonstrations.',
      },
      {
        id: 'pers.2',
        question: 'Properly Equipped',
        citation: '§139.303(b)',
        guidance: 'The certificate holder must equip personnel with the resources needed to comply with the requirements of Part 139.',
      },
      {
        id: 'pers.3',
        question: 'Trained',
        citation: '§139.303(c)',
        guidance: 'The certificate holder must train all persons who access movement areas and safety areas and perform duties, in compliance with the ACM and Part 139, and must develop a training program covering the areas subject to Part 139. Work that is completed but performed improperly can indicate a training deficiency even where staffing numbers are sufficient.',
      },
      {
        id: 'pers.4',
        question: 'Record of Training for 24 CCM',
        citation: '§139.303(d)',
        guidance: 'The certificate holder must record all training completed under §139.303 by each individual, including at minimum a description and date of the training received; records must be maintained for 24 consecutive calendar months after completion of training.',
      },
      {
        id: 'pers.5',
        question: 'Use of an Independent Organization or Designee',
        citation: '§139.303(f)',
        guidance: 'The certificate holder may use an independent organization or designee to comply with its ACM and the requirements of Part 139 only if the arrangement is authorized by the Administrator.',
      },
    ],
  },
  // ── Section 6: Paved Areas ──
  // src: 5280.5D §4.11.1, §4.11.2.2, §4.11.2.4-4.11.2.8
  {
    id: 'p139-paved',
    number: 6,
    title: 'Paved Areas',
    reference: '14 CFR §139.305',
    items: [
      {
        id: 'paved.1',
        question: 'Lips',
        citation: '§139.305(a)(1)',
        guidance: 'The Order provides no lips-specific test; the certificate holder must maintain and promptly repair the pavement of each runway, taxiway, loading ramp, and parking area available for air carrier use (§139.305(a)(1)-(6)).',
      },
      {
        id: 'paved.2',
        question: 'Holes',
        citation: '§139.305(a)(2)',
        guidance: 'A hole 3 inches or less in depth is not a discrepancy under §139.305(a)(2). If deeper than 3 inches, it is not a deficiency when the entire hole can be covered by a 5 inch diameter circle, or when it cannot be covered by a 5 inch circle but the sideslope is less than 45 degrees at every point. It IS a deficiency when it cannot be covered by a 5 inch circle and the sideslope is 45 degrees or greater at any point.',
      },
      {
        id: 'paved.3',
        question: 'Cracks/Surface Variations',
        citation: '§139.305(a)(3)',
        guidance: 'Longitudinal cracks are more likely to affect directional control of an air carrier aircraft than transverse cracks. A hole that passes the §139.305(a)(2) hole test may still be a discrepancy under (a)(3) if the surface variation could impair directional control.',
      },
      {
        id: 'paved.4',
        question: 'Debris/Contaminants',
        citation: '§139.305(a)(4)',
        guidance: 'Loose aggregate, foreign objects, rubber deposits, snow and ice clumps, and other contaminants that could be ingested into aircraft engines must be removed from paved areas promptly and completely.',
      },
      {
        id: 'paved.5',
        question: 'Chemical Solvent Removed',
        citation: '§139.305(a)(5)',
        guidance: 'Chemical solvents used on pavement must be removed from paved areas promptly and completely.',
      },
      {
        id: 'paved.6',
        question: 'Drainage/Ponding',
        citation: '§139.305(a)(6)',
        guidance: 'Pavement must be sufficiently drained and free from depressions.',
      },
    ],
  },
  // ── Section 7: Safety Areas ──
  // src: 5280.5D §4.13.1, §4.13.4, §4.13.6, §4.13.6.2.2
  {
    id: 'p139-safety',
    number: 7,
    title: 'Safety Areas',
    reference: '14 CFR §139.309',
    items: [
      {
        id: 'safety.1',
        question: 'Dimensions Maintained',
        citation: '§139.309(a)',
        guidance: 'Safety-area dimensions and the design standards applicable to the associated runway must be entered in the approved ACM. The ACSI must be able to accurately check dimensions that do not appear correct and should note any significant discrepancy in the measurements.',
      },
      {
        id: 'safety.2',
        question: 'Ruts/Surface Variations',
        citation: '§139.309(b)(1)',
        guidance: 'Safety areas must be cleared and graded and have no potentially hazardous humps, ruts, depressions, or other surface variations.',
      },
      {
        id: 'safety.3',
        question: 'Drainage',
        citation: '§139.309(b)(2)',
        guidance: 'Safety areas must be drained by grading or by storm sewers to prevent water accumulation.',
      },
      {
        id: 'safety.4',
        question: 'Support Aircraft/Equipment',
        citation: '§139.309(b)(3)',
        guidance: 'Safety areas should support a vehicle or ARFF equipment during dry conditions and the inadvertent excursion of an aircraft without causing major damage.',
      },
      {
        id: 'safety.5',
        question: 'Objects in Safety Area/Frangible Mounting',
        citation: '§139.309(b)(4)',
        guidance: 'Unless fixed by function, no object is permitted within the safety area (RSA). Objects fixed by function and located in the RSA must be on frangible mounts and no higher than 3 inches above grade.',
      },
    ],
  },
  // ── Section 8: Marking, Signs, and Lighting ──
  // src: 5280.5D §4.14.1, §4.14.2 (numbered items 1-25)
  {
    id: 'p139-msl',
    number: 8,
    title: 'Marking, Signs, and Lighting',
    reference: '14 CFR §139.311',
    items: [
      {
        id: 'msl.1',
        question: 'Runway Marking Meets Specs',
        citation: '§139.311(a)(1)',
        guidance: 'Runways are marked as appropriate for the approach with the lowest authorized minimums, meeting the standards in AC 150/5340-1, Standards for Airport Markings.',
      },
      {
        id: 'msl.2',
        question: 'Taxiway Centerline',
        citation: '§139.311(a)(2)',
        guidance: 'Taxiways are equipped with required centerline markings.',
      },
      {
        id: 'msl.3',
        question: 'Taxiway Edge Markings',
        citation: '§139.311(a)(3)',
        guidance: 'Taxiway edge markings are required where the full-strength pavement of the taxiway is not readily discernible or where the taxiway is outlined in a large paved area such as an apron. Continuous markings indicate aircraft must not cross; dashed markings indicate a need for aircraft to cross a contiguous area.',
      },
      {
        id: 'msl.4',
        question: 'Holding Position Markings',
        citation: '§139.311(a)(4)',
        guidance: 'Runway hold position markings and surface painted hold position signs must be inspected for proper placement, reflectivity, and paint scheme.',
      },
      {
        id: 'msl.5',
        question: 'ILS Critical Area Markings',
        citation: '§139.311(a)(5)',
        guidance: 'No 5280.5D subsection gives ILS critical area markings item-specific criteria; they fall under the general duty to provide and maintain markings authorized by the Administrator, installed and maintained to FAA standards and specifications.',
      },
      {
        id: 'msl.6',
        question: 'Signs Identifying Taxiing Routes',
        citation: '§139.311(b)(1)(i)',
        guidance: 'Guidance signs are installed in accordance with the approved airport signs and marking plan (specifications in ACs 150/5340-18 and 150/5345-44). Section 139.311(b)(1)(i) applies to Class I, II, and IV airports.',
      },
      {
        id: 'msl.7',
        question: 'Holding Position Signs',
        citation: '§139.311(b)(1)(ii)',
        guidance: 'Section 139.311(b)(1)(ii) applies to all airport classes. Holding position signs, and any co-located location or runway exit signs, must be lighted if the runway for which they are installed is lighted, even if the taxiway on which they sit is unlighted.',
      },
      {
        id: 'msl.8',
        question: 'ILS Critical Area Signs',
        citation: '§139.311(b)(1)(iii)',
        guidance: 'Section 139.311(b)(1)(iii) applies to all airport classes, like holding position signs, and must be lighted if the runway for which it is installed is lighted, even if the taxiway on which it sits is unlighted.',
      },
      {
        id: 'msl.9',
        question: 'Signs Internally Illuminated',
        citation: '§139.311(b)(2)',
        guidance: 'No 5280.5D subsection specifically addresses internal illumination; signs generally must be lighted if the runway or taxiway on which they are located is lighted.',
      },
      {
        id: 'msl.10',
        question: 'Runway Lighting Meets Specifications',
        citation: '§139.311(c)(1)',
        guidance: 'Runways are lighted for the approach with the lowest authorized minimums per AC 150/5340-30, with proper alignment in both directions and on the centerline and uniform brightness, alignment, and color at all cycled intensity levels. Instrument runways require yellow edge (caution zone) lights on the runway end opposite the threshold when operations occur at night or below VFR/IMC minimums. Two or more consecutive missing edge lights at a runway/runway or runway/taxiway intersection compromises safety and generally warrants an additional fixture.',
      },
      {
        id: 'msl.11',
        question: 'Taxiway Lighting/Reflectors',
        citation: '§139.311(c)(2)',
        guidance: 'If the airport is open at night or during IMC conditions, taxiways must have at least one of the following: centerline lights, enhanced centerline lights, centerline reflectors, edge lights, or edge reflectors.',
      },
      {
        id: 'msl.12',
        question: 'Airport Beacon',
        citation: '§139.311(c)(3)',
        guidance: 'The airport must be equipped with an operable airport rotating beacon if open during hours of darkness or during Instrument Meteorological Conditions (IMC); standards are in ACs 150/5300-13 and 150/5340-30.',
      },
      {
        id: 'msl.13',
        question: 'Airport-owned Approach Lighting',
        citation: '§139.311(c)(4)',
        guidance: 'Airport-owned approach lighting systems (ALSs), including VGSI and REIL systems, must be properly maintained, with required procedures for checking calibration where the airport operator owns the REIL/VGSI systems. Approach lighting not owned by the airport must still be inspected by the certificate holder for accuracy, with outages reported to the owner.',
      },
      {
        id: 'msl.14',
        question: 'Obstruction Marking/Lighting',
        citation: '§139.311(c)(5)',
        guidance: 'Obstruction lights must be operable; the ACM should contain a list of lighted obstructions.',
      },
      {
        id: 'msl.15',
        question: 'Markings/Signs/Lighting Properly Maintained',
        citation: '§139.311(d)',
        guidance: 'Properly maintained means cleaning, replacing, or repairing any faded, missing, or non-functional item of the marking or lighting system; keeping each item unobscured and clearly visible; and ensuring each item provides an accurate reference and is in alignment when viewed by the user.',
      },
      {
        id: 'msl.16',
        question: 'Other Lighting Shielded/Adjusted',
        citation: '§139.311(e)',
        guidance: 'Other airport lighting for aprons, roadways, buildings, and other areas must be adequately adjusted or shielded to prevent interference with ATCT and aircraft operations.',
      },
    ],
  },
  // ── Section 9: Snow and Ice Control ──
  // src: 5280.5D §4.15
  {
    id: 'p139-snow',
    number: 9,
    title: 'Snow and Ice Control',
    reference: '14 CFR §139.313',
    items: [
      {
        id: 'snow.1',
        question: 'Prepare/Maint./Execute Plan',
        citation: '§139.313(a)',
        guidance: 'The certificate holder of an airport where snow and icing conditions occur is responsible for preparing, maintaining, and executing a Snow and Ice Control Plan (SICP) approved by the Administrator; the SICP is incorporated into the approved ACM, and compliance is contingent upon the prompt execution of the plan. The ACSI also considers the training and record-keeping procedures for the snow crew, and should take advantage of any opportunity to inspect during winter months, since the best way to evaluate an SICP is by observing actual snow and ice removal operations.',
      },
      {
        id: 'snow.2',
        question: 'Plan Addresses Prompt Removal or Control',
        citation: '§139.313(b)(1)',
        guidance: 'Specific requirements for the plan are detailed in §139.313(b)(1) through (5), with additional guidance in AC 150/5200-30, Airport Winter Safety and Operations. For prompt removal or control, the ACSI checks whether the airport is operating in accordance with the SICP, whether staffing is adequate to successfully support the SICP, and looks for adequate snow crew response to deteriorating conditions or braking action reports of POOR or NIL.',
      },
      {
        id: 'snow.3',
        question: 'Positioning Snow for Clearance',
        citation: '§139.313(b)(2)',
        guidance: "The ACSI checks whether the airport's clearing priorities are defined, whether the airport has sufficient equipment to meet those clearing priorities per the ACM, and whether the equipment is operational and properly maintained.",
      },
      {
        id: 'snow.4',
        question: 'Use of Approved Materials',
        citation: '§139.313(b)(3)',
        guidance: 'The ACSI checks whether the airport has a sufficient stock supply and the correct types of de-icing agents, whether they are stored properly, and whether the airport is appropriately applying the agents according to wind, precipitation, temperature, and weather forecasts.',
      },
      {
        id: 'snow.5',
        question: 'Timely Commencement',
        citation: '§139.313(b)(4)',
        guidance: "The Order gives no test specific to timely commencement distinct from (b)(1); compliance is contingent upon the prompt execution of the plan, and the ACSI's evidence remains adequate snow crew response to deteriorating conditions or braking action reports of POOR or NIL.",
      },
      {
        id: 'snow.6',
        question: 'Prompt Notification to Users',
        citation: '§139.313(b)(5)',
        guidance: 'The ACSI checks whether condition reporting is adequate, reviewing the reporting from the most recent snow event; the airport must also have provisions for a Snow Control Committee and Snow Control Desk, with good communication among the snow crews, the snow desk, and Air Traffic Control.',
      },
    ],
  },
  // ── Section 10: ARFF Operations ──
  {
    id: 'p139-arff',
    number: 10,
    title: 'ARFF Operations',
    reference: '14 CFR §139.315/.317/.319',
    items: [
      { id: 'arff.1', question: 'ARFF Capability Meeting Index Provided During ACR OPNS', citation: '§139.319(a)' },
      { id: 'arff.2', question: 'Requirements Met for Increase in Index', citation: '§139.319(b)' },
      { id: 'arff.3', question: 'Reduction in ARFF Index Meets Conditions', citation: '§139.319(d)' },
      { id: 'arff.4', question: 'Vehicle Communications in Required Vehicles', citation: '§139.319(e)' },
      { id: 'arff.5', question: 'Vehicle Marking & Lighting', citation: '§139.319(f)' },
      { id: 'arff.6', question: 'Vehicle Readiness', citation: '§139.319(g)' },
      { id: 'arff.7', question: 'Response Drill — No. Vehicles', citation: '§139.319(h)' },
      { id: 'arff.8', question: 'Personnel Properly Equipped', citation: '§139.319(i)(1)' },
      { id: 'arff.9', question: 'Personnel Properly Trained', citation: '§139.319(i)(2)' },
      { id: 'arff.10', question: 'Live-Fire Drill Every 12 CCM for all Personnel', citation: '§139.319(i)(3)' },
      { id: 'arff.11', question: 'Personnel Trained/Current in Basic Emergency Medical Care for ACR OPNS', citation: '§139.319(i)(4)' },
      { id: 'arff.12', question: 'Record of Training for 24 CCM', citation: '§139.319(i)(5)' },
      { id: 'arff.13', question: 'Sufficient Personnel to Meet Requirements', citation: '§139.319(i)(6)' },
      { id: 'arff.14', question: 'Alerting Procedures/Equipment Established', citation: '§139.319(i)(7)' },
      { id: 'arff.15', question: 'Hazardous Materials Guidance Available', citation: '§139.319(j)' },
      { id: 'arff.16', question: 'Emergency Access Roads Maintained', citation: '§139.319(k)' },
    ],
  },
  // ── Section 11: Hazardous Materials ──
  // src: 5280.5D §4.19 (+ §4.7.5 Fuel Inspections procedure for (b)-(d) detail;
  // Appendix F Inspection Confirmation Letter for (f)/(g) records)
  {
    id: 'p139-hazmat',
    number: 11,
    title: 'Hazardous Materials',
    reference: '14 CFR §139.321',
    items: [
      {
        id: 'hazmat.1',
        question: 'Procedures for Hazardous Substances and Materials',
        citation: '§139.321(a)',
        guidance: 'Each certificate holder who acts as a cargo handling agent must establish and maintain procedures for the protection of persons and property on the airport during the handling and storing of any material regulated by the Hazardous Material Regulations (49 CFR parts 171 through 180) that is, or is intended to be, transported by air.',
      },
      {
        id: 'hazmat.2',
        question: 'Acceptable Fire Safety Standards Established',
        citation: '§139.321(b)',
        guidance: "The ACSI checks the certificate holder's standards for protecting against fire and explosions in storing, dispensing, and otherwise handling fuel on the airport (or its adopted fire code); these standards must address facilities, procedures, and personnel training according to the seven items listed in §139.321(b).",
      },
      {
        id: 'hazmat.3',
        question: 'Compliance to Fire Safety Standards',
        citation: '§139.321(c)',
        guidance: "Section 139.321(c) requires the certificate holder to exercise reasonable surveillance on all fueling activities on the airport, including GA self-fuelers such as corporate or large-aircraft operators and private small-aircraft owners who perform their own refueling. The ACSI checks agents who handle fuel and fuel storage material for compliance with the applicable fire code (NFPA 407 or other code as adopted), inspecting a random sampling — or, at the ACSI's discretion, all — vehicles and hydrant carts, plus the safety and operation of designated fuel storage areas; fuel storage facilities off airport property and outside the airport operating area are not inspected.",
      },
      {
        id: 'hazmat.4',
        question: 'Inspection of Fuel Facilities every 3 CCM',
        citation: '§139.321(d)',
        guidance: "The ACSI checks the certificate holder's inspection records of fueling agents for timeliness, accuracy, and completeness, confirming the inspections are completed at a minimum every 3 consecutive calendar months.",
      },
      {
        id: 'hazmat.5',
        question: 'Record of Inspection for 12 CCM',
        citation: '§139.321(d)',
        guidance: 'Fueling-truck and fuel-storage-area inspection records must be maintained for 12 consecutive calendar months (§139.301(b)); the ACSI reviews these records for timeliness, accuracy, and completeness as part of its fuel-facility oversight.',
      },
      {
        id: 'hazmat.6',
        question: 'Fueling Agent Supervisor Training Every 24 CCM',
        citation: '§139.321(e)(1)',
        guidance: 'The ACSI must ensure at least one supervisor with each fueling agent has completed an acceptable fire safety course within the previous 24 consecutive calendar months, conducted by the airport with the local fire facility or drawn from the nationally acceptable training courses reviewed by AAS-300 and listed in the Addendum to AC 150/5230-4 (a locally developed course must be reviewed by the ACSI for acceptability). Prior to assuming a supervisory position, an individual must have completed initial training or be enrolled in an authorized supervisory aviation fuel-training course to be completed within 90 days, with recurrent training required at a minimum of every 24 consecutive calendar months.',
      },
      {
        id: 'hazmat.7',
        question: 'Fueling Agent On-the-Job Training Every 24 CCM',
        citation: '§139.321(e)(2)',
        guidance: 'Training records must document that all other employees who fuel aircraft, accept fuel shipments, or otherwise handle fuel have received at least initial on-the-job training in safe handling and, thereafter, recurrent training every 24 consecutive calendar months from the supervisor responsible for their fire safety training.',
      },
      {
        id: 'hazmat.8',
        question: 'Written Confirmation Every 12 CCM that Training Accomplished',
        citation: '§139.321(f)',
        guidance: 'Among the records the ACSI reviews at inspection is written confirmation from each fueling agent not operated by the airport that the required fuel training has been accomplished, along with documentation from each fueling agent that at least one supervisor has completed an Aviation Fuel Training Course in Fire Safety, including hands-on fire extinguisher training.',
      },
      {
        id: 'hazmat.9',
        question: 'Require Immediate Corrective Action/Notify FAA of Noncompliance',
        citation: '§139.321(g)',
        guidance: "The Order's Chapter 4 discussion of §139.321 concentrates on the ACSI's fueling-agent surveillance, inspection, and training oversight rather than detailing this sub-paragraph separately; the underlying requirement is that the certificate holder require immediate corrective action and notify the FAA when a fueling agent is found out of compliance with the fire safety standards.",
      },
    ],
  },
  // ── Section 12: Traffic/Wind Indicators ──
  // src: 5280.5D §4.20.1-4.20.3
  {
    id: 'p139-wind',
    number: 12,
    title: 'Traffic/Wind Indicators',
    reference: '14 CFR §139.323',
    items: [
      {
        id: 'wind.1',
        question: 'Wind Cones Provided/Lighted',
        citation: '§139.323(a)',
        guidance: 'A primary wind cone providing surface wind direction to all pilots is required, plus a supplemental wind cone for each runway available to air carrier use, installed at the runway end or at least at a point visible during takeoffs and landings; indicators must be lighted if the airport operates during hours of darkness. Wind cone fabric (white, yellow, or orange) must be serviceable, not faded or frayed, swing freely, and carry no lettering.',
      },
      {
        id: 'wind.2',
        question: 'Segmented Circle, Landing Strip, and Traffic Pattern Indicators Provided When No ATCT',
        citation: '§139.323(b)',
        guidance: 'For airports serving any air carrier operation with no control tower operating, a segmented circle, landing strip indicator, and traffic pattern indicator must be installed around a wind cone for each runway with a right-hand traffic pattern. Where a right traffic pattern exists, the segmented circle must provide correct information and be properly maintained.',
      },
    ],
  },
  // ── Section 13: Airport Emergency Plan ──
  // src: 5280.5D §4.21 (+ Appendix F Inspection Confirmation Letter for (g)(4) annual-review record)
  {
    id: 'p139-aep',
    number: 13,
    title: 'Airport Emergency Plan',
    reference: '14 CFR §139.325',
    items: [
      {
        id: 'aep.1',
        question: 'Develop/Maintain Plan for Prompt Response/Sufficient Detail',
        citation: '§139.325(a)',
        guidance: 'The certificate holder is responsible for developing and maintaining a written document entitled the Airport Emergency Plan (AEP), intended to minimize the possibility and extent of personal injury and property damage on the airport in an emergency. The AEP should address and describe procedures for prompt response to the emergencies listed in §139.325(b).',
      },
      {
        id: 'aep.2',
        question: 'Response Instructions — Aircraft/Bomb/Structure/Fuel/Natural/HazMat/Sabotage-Hijack/Power/Water',
        citation: '§139.325(b)',
        guidance: 'The ACSI is responsible for determining whether the AEP addresses each of the emergencies and associated actions listed in §139.325(b), through a careful and thorough review of the plan against the specifics of the section; this review can be conducted administratively before the on-site inspection, with any questions or concerns addressed with the certificate holder once on site.',
      },
      {
        id: 'aep.3',
        question: 'Must Address Medical/Transport/Hospital/Ambulance/Inventory/Injured/Crowds/Disabled Aircraft',
        citation: '§139.325(c)',
        guidance: "The same review standard applies to §139.325(c): the ACSI determines whether the AEP addresses each of the required medical-response elements, again through careful review of the plan against the section's specifics to identify deficiencies or areas needing greater detail.",
      },
      {
        id: 'aep.4',
        question: 'Provide for Marshaling/Emergency Alarm/ATCT Coordination',
        citation: '§139.325(d)',
        guidance: 'The same review standard applies to §139.325(d): the ACSI determines whether the AEP addresses the required marshaling, emergency alarm, and ATCT-coordination provisions, following up with airport personnel on site on any questions the review raises.',
      },
      {
        id: 'aep.5',
        question: 'Procedures for Notifying Agencies of Accident Location',
        citation: '§139.325(e)',
        guidance: "The same review standard applies to §139.325(e): the ACSI determines whether the AEP addresses the required procedures for notifying agencies of the accident location, comparing the plan against the section's specifics for completeness.",
      },
      {
        id: 'aep.6',
        question: 'Water Rescue to the Extent Practical',
        citation: '§139.325(f)',
        guidance: "When addressing water rescue, if applicable, the certificate holder must identify any significant bodies of water or marsh lands adjacent to the airport under the approach/departure flight paths, out to the final approach fix on runways with published approaches and out to 2 miles on runways with visual approaches; a river counts as significant if it is one-quarter-mile wide and cannot be traversed by conventional land rescue vehicles, and detention ponds on airport property are included. All such bodies of water must be documented in the AEP. A certificate holder who cannot obtain cooperation from other jurisdictions for water rescue operations 'to the extent practicable' must document a reasonable attempt to obtain that cooperation, with the statement included in the AEP.",
      },
      {
        id: 'aep.7',
        question: 'Coordinate & Develop Plan with Participating Agencies',
        citation: '§139.325(g)(1),(2)',
        guidance: 'ACSIs should consider reviewing any Letters of Agreement, Memorandums of Understanding, and Memorandums of Agreement associated with the AEP to confirm they are current and still in effect, as evidence the plan was coordinated and developed with the participating agencies.',
      },
      {
        id: 'aep.8',
        question: 'Airport Personnel Properly Trained',
        citation: '§139.325(g)(3)',
        guidance: "ACSIs are encouraged to speak with airport personnel who maintain duties and responsibilities within the AEP to confirm training has been accomplished on the plan's details; personnel with plan responsibilities must be properly trained, with the training documented, to ensure they understand their role during an airport emergency.",
      },
      {
        id: 'aep.9',
        question: 'Review Plan every 12 CCM',
        citation: '§139.325(g)(4)',
        guidance: "The Order's Chapter 4 discussion of §139.325 does not break out the review cadence separately from the general AEP-compliance review; the Inspection Confirmation Letter (Appendix F) lists documentation of the annual review of the AEP among the records the certificate holder must have available for the inspection.",
      },
      {
        id: 'aep.10',
        question: 'Full-Scale Exercise every 36 CCM for Class I',
        citation: '§139.325(h)',
        guidance: 'Class I AOC certificate holders must hold a full-scale airport emergency plan exercise at least triennially, conducted within the calendar month it is due — e.g., a triennial held August 4, 2015 is next due by August 31, 2018. Special circumstances might necessitate schedule adjustments, but the certificate holder must notify the Regional Airports Division of any need to vary the schedule, supported by an acceptable justification. As funding and schedules allow, ACSIs should consider observing the triennial exercise for a hands-on confirmation of how effectively the AEP is executed and that responsible parties respond according to their duties.',
      },
      {
        id: 'aep.11',
        question: 'Consistent with Approved Security Program',
        citation: '§139.325(i)',
        guidance: "The Order's Chapter 4 discussion of §139.325 does not provide a separate test for consistency with the approved Airport Security Program beyond the general ACSI duty to ensure the certificate holder complies with each requirement outlined in the section, which includes keeping the AEP consistent with the airport's approved security program under §139.325(i).",
      },
    ],
  },
  // ── Section 14: Self-Inspection Program ──
  // src: 5280.5D §4.22.1-4.22.3; record-retention items cross-ref §4.9.2 (the Records section)
  {
    id: 'p139-selfinsp',
    number: 14,
    title: 'Self-Inspection Program',
    reference: '14 CFR §139.327',
    items: [
      {
        id: 'selfinsp.1',
        question: 'Inspect Daily or As Required',
        citation: '§139.327(a)(1)',
        guidance: "The Order's Chapter 4 discussion of §139.327 does not restate the daily-or-other-interval inspection frequency itself; instead it frames the self-inspection program as 'the strategic element' of the airport's certification program, required by regulation. The certificate holder must establish, implement, and maintain an appropriate self-inspection system and inspection schedule, with the specifics described in the approved ACM; the ACSI verifies that schedule is actually being executed by observing an airport representative conduct a self-inspection to confirm procedures are being followed and are effective.",
      },
      {
        id: 'selfinsp.2',
        question: 'Inspect when Required by Unusual Conditions/Accidents',
        citation: '§139.327(a)(2),(3)',
        guidance: "As with the routine inspection frequency, Chapter 4 does not separately break out the immediate/supplemental-inspection triggers; the ACM-described self-inspection system the ACSI verifies must also address inspections following unusual conditions and accidents or incidents, and the ACSI's oversight approach is the same — confirming through observation that the certificate holder's procedures are being followed and are effective.",
      },
      {
        id: 'selfinsp.3',
        question: 'Equipment Provided',
        citation: '§139.327(b)(1)',
        guidance: "The Order's Chapter 4 discussion of §139.327 does not provide equipment-specific criteria; the underlying requirement is that the certificate holder provide the equipment necessary to carry out the self-inspection system it has established, implemented, and maintains under the approved ACM.",
      },
      {
        id: 'selfinsp.4',
        question: 'Procedures/Equipment for Dissemination of Information to Users',
        citation: '§139.327(b)(2)',
        guidance: 'Chapter 4 does not elaborate on dissemination-specific criteria beyond the general self-inspection system requirement; disseminating airport-condition information discovered during self-inspection to airport users overlaps with the airport condition reporting requirements of §139.339 (Section 21 of this checklist).',
      },
      {
        id: 'selfinsp.5',
        question: 'Inspections Conducted by Qualified Personnel',
        citation: '§139.327(b)(3)',
        guidance: 'The ACSI ascertains whether the self-inspection program is effective by observing an airport representative of the certificate holder conduct a self-inspection, to determine if procedures are being followed and are effective. Where the number and significance of problems found is notable, the ACSI may need to conduct a more detailed review of airport staff qualifications to determine the underlying causes of the deficiencies cited on self-inspection records.',
      },
      {
        id: 'selfinsp.6',
        question: 'Personnel Properly Trained',
        citation: '§139.327(b)(3)',
        guidance: "Chapter 4's self-inspection discussion does not add a training-content test beyond the ACSI's general effectiveness observation; training adequacy is verified largely through the record — airport personnel training required under §139.303 and §139.327 together must be maintained for 24 consecutive calendar months (Order §4.9.2, the Records section).",
      },
      {
        id: 'selfinsp.7',
        question: 'Reporting System for Prompt Correction incl. Wildlife Strikes',
        citation: '§139.327(b)(4)',
        guidance: "The Order lists indications that the reporting-and-correction system may not be working: a pattern of self-inspection reports/records showing zero discrepancies; indications of falsification of reports/records or incomplete inspection records; the number and significance of problems found (which might point to maintenance or equipment problems warranting a closer review of staff qualifications); the number and type of discrepancies found during the FAA certification inspection as compared to those the self-inspection program actually reported; reports received from ATCT, air carriers, or others about airport issues; and an excessive time lapse between when a discrepancy is identified and when it is corrected, which can indicate an issue with the airport's internal reporting (work-order) system or an indication of personnel who are insufficient in number or inadequately qualified. Chapter 4 does not separately address wildlife-strike reporting under this item; wildlife hazards are addressed under §139.337 (Section 19 of this checklist).",
      },
      {
        id: 'selfinsp.8',
        question: '12 CCM of Records Showing Conditions Found + Corrective Actions',
        citation: '§139.327(c)(1)',
        guidance: 'Records for self-inspections, as required under §139.327, must be maintained for 12 consecutive calendar months (Order §4.9.2, the Records section).',
      },
      {
        id: 'selfinsp.9',
        question: 'Record of Training for 24 CCM',
        citation: '§139.327(c)(2)',
        guidance: 'Records for airport personnel training, as required under §139.303 and §139.327 together, must be maintained for 24 consecutive calendar months (Order §4.9.2, the Records section).',
      },
    ],
  },
  // ── Section 15: Pedestrians & Ground Vehicles ──
  // src: 5280.5D §4.23.1-4.23.4.3; record-retention item cross-refs §4.9.2 (the Records section)
  {
    id: 'p139-vehicles',
    number: 15,
    title: 'Pedestrians & Ground Vehicles',
    reference: '14 CFR §139.329',
    items: [
      {
        id: 'veh.1',
        question: 'Limit Access to Movement/Safety Areas',
        citation: '§139.329(a)',
        guidance: 'The certificate holder is responsible for limiting access to movement areas and safety areas to only those pedestrians and ground vehicles necessary for airport operations. The airport should have a process for periodic review of the vehicles and persons authorized to access these areas, to confirm continued need and authorization. Unauthorized entry by a pedestrian or ground vehicle onto the movement area may constitute a runway incursion — personnel or equipment found in the runway safety area without ATCT authorization are reported as incursions, though not every incursion is necessarily a Part 139 violation; an alleged incursion requires a Letter of Investigation and a fact-finding investigation, which may include interviewing those involved, taking witness statements, and examining the location.',
      },
      {
        id: 'veh.2',
        question: 'Establish/Implement Safe-Ops Procedures',
        citation: '§139.329(b)',
        guidance: 'Certificate holders must establish and implement procedures for the safe and orderly access to, and operation in, the movement and safety areas by pedestrians and ground vehicles. In assessing these procedures, the ACSI observes that the only ground vehicles operating on the airport are those necessary for airport operations — including rescue, maintenance, and inspection activities, airfield maintenance, ARFF equipment, snow-removal equipment, and mowers — with fuel trucks allowed in movement areas only where there is no alternative way to transport fuel across the airport (the ACSI may work with the certificate holder on mitigating measures, such as marking vehicle paths or constructing service/perimeter roads, where fuel trucks must access these areas). Other vehicles, including federal vehicles such as those used by FAA Tech Ops, are allowed as necessary and as the approved ACM permits, with the ACSI observing their operation for compliance with ACM procedures; construction vehicles are authorized per the construction safety phasing plan using authorized access routes, and construction/maintenance activity is not authorized in safety areas during aircraft operations.',
      },
      {
        id: 'veh.3',
        question: 'Pedestrian/Vehicle Control with ATCT',
        citation: '§139.329(c)',
        guidance: 'Procedures must be established for fuel vehicles to cross movement areas, including two-way communication with the ATCT (or with an escort, if no alternative route is available); the approved ACM should clearly address these crossing procedures, including training on them. As a best safety practice, all runway crossings should be conducted at the runway ends rather than at the middle of the runway.',
      },
      {
        id: 'veh.4',
        question: 'Control — No ATCT',
        citation: '§139.329(d)',
        guidance: 'At airports without an ATCT, or during periods when the ATCT is not operating, the ACSI observes the procedures used for pedestrian and vehicle control — for example, notification over the Common Traffic Advisory Frequency (CTAF) of intent to enter a movement area, or notification to an on-field Flight Service Station of position and intentions.',
      },
      {
        id: 'veh.5',
        question: 'Operator Training on Procedures & Consequences',
        citation: '§139.329(e)',
        guidance: 'The ACSI examines and evaluates the driver training program for comprehensiveness and effectiveness — which might include a permit system and testing — and which should include a schedule of consequences for pedestrians or ground-vehicle operators who violate the rules. At minimum, driver training programs should include: review of rules and regulations, including consequences of non-compliance; vehicle operating requirements (use of perimeter roads, parking on the airport, and accident reporting); airport familiarization; communication rules, including phraseology, frequencies, and procedures for contacting the ATCT; runway safety and incursion-prevention techniques; and review of records of accidents or incidents involving air carrier aircraft and/or ground vehicles or pedestrians.',
      },
      {
        id: 'veh.6',
        question: 'Record of Training for 24 CCM',
        citation: '§139.329(f)(1)',
        guidance: 'Records for training ground-vehicle operators and personnel with access to the movement area and safety areas, as required under §139.329, must be maintained for 24 consecutive calendar months, and the records must reflect that personnel were trained within the prior 12 consecutive calendar months (Order §4.9.2, the Records section).',
      },
      {
        id: 'veh.7',
        question: '12 CCM of Records for Accidents/Incidents',
        citation: '§139.329',
        guidance: '§139.329(f)(2) requires the certificate holder to provide a description and date of any accident or incident involving an air carrier aircraft, pedestrian, or ground vehicle in the movement or safety areas. Certificate holders are highly encouraged to critique each such air-carrier-involved accident to analyze their emergency response, and the FAA recommends completing this self-critique within 60 days after the accident with a written report. These accident/incident records must be maintained for 12 consecutive calendar months (Order §4.9.2, the Records section).',
      },
    ],
  },
  // ── Section 16: Obstructions ──
  {
    id: 'p139-obstruct',
    number: 16,
    title: 'Obstructions',
    reference: '14 CFR §139.331',
    items: [
      { id: 'obstruct.1', question: 'Objects Determined to be an Obstruction Removed, Marked, or Lighted', citation: '§139.331' },
    ],
  },
  // ── Section 17: Protection of NAVAIDs ──
  {
    id: 'p139-navaids',
    number: 17,
    title: 'Protection of NAVAIDs',
    reference: '14 CFR §139.333',
    items: [
      { id: 'navaids.1', question: 'Prevent Construction that Would Derogate NAVAIDs/AT Facilities', citation: '§139.333(a)' },
      { id: 'navaids.2', question: 'Protect from Vandalism and Theft', citation: '§139.333(b)' },
      { id: 'navaids.3', question: 'Prevent Signal Interruption', citation: '§139.333(c)' },
    ],
  },
  // ── Section 18: Public Protection ──
  {
    id: 'p139-public',
    number: 18,
    title: 'Public Protection',
    reference: '14 CFR §139.335',
    items: [
      { id: 'public.1', question: 'Prevent Inadvertent Entry to Movement Area by Unauthorized Persons/Vehicles', citation: '§139.335(a)(1)' },
      { id: 'public.2', question: 'Reasonable Protection from ACFT Blast', citation: '§139.335(a)(2)' },
    ],
  },
  // ── Section 19: Wildlife Hazard Management ──
  {
    id: 'p139-wildlife',
    number: 19,
    title: 'Wildlife Hazard Management',
    reference: '14 CFR §139.337',
    items: [
      { id: 'wildlife.1', question: 'Immediate Measures when Detected', citation: '§139.337(a)' },
      { id: 'wildlife.2', question: 'Provide for WHA when Required', citation: '§139.337(b)' },
      { id: 'wildlife.3', question: 'WHA Conducted by Qualified Personnel', citation: '§139.337(c)' },
      { id: 'wildlife.4', question: 'WHA Contents', citation: '§139.337(c)' },
      { id: 'wildlife.5', question: 'WHA Submitted to FAA', citation: '§139.337(d)' },
      { id: 'wildlife.6', question: 'WHMP Formulated and Implemented when Required', citation: '§139.337(e)' },
      { id: 'wildlife.7', question: 'Plan Addresses Required Contents', citation: '§139.337(f)' },
      { id: 'wildlife.8', question: 'Plan Addresses Permits — local/State/Federal', citation: '§139.337(f)(3)' },
      { id: 'wildlife.9', question: 'Review/Evaluate Plan every 12 CCM', citation: '§139.337(f)(6)' },
      { id: 'wildlife.10', question: 'Personnel Training Program by a Qualified Wildlife Biologist', citation: '§139.337(f)(7)' },
    ],
  },
  // ── Section 20: Identifying, Marking & Lighting Construction / Unserviceable Areas ──
  {
    id: 'p139-construction',
    number: 20,
    title: 'Identifying, Marking & Lighting Construction / Unserviceable Areas',
    reference: '14 CFR §139.341',
    items: [
      { id: 'constr.1', question: 'Mark/Light Construction/Unserviceable Areas & Equipment', citation: '§139.341(a)(1)' },
      { id: 'constr.2', question: 'Pre-Construction Review of Utilities', citation: '§139.341(a)(2)' },
    ],
  },
  // ── Section 21: Airport Condition Reporting ──
  // src: 5280.5D §4.28.1-4.28.5; record-retention item cross-refs §4.9.2 (the Records section)
  {
    id: 'p139-condrpt',
    number: 21,
    title: 'Airport Condition Reporting',
    reference: '14 CFR §139.339',
    items: [
      {
        id: 'condrpt.1',
        question: 'Collection/Dissemination of Airport Conditions',
        citation: '§139.339(a)',
        guidance: 'The certificate holder is responsible for providing, in a manner authorized by the Administrator and as stated in the approved ACM, information about airport conditions, and for collecting and disseminating that information to air carriers.',
      },
      {
        id: 'condrpt.2',
        question: 'Use of NOTAM/Other Systems',
        citation: '§139.339(b)',
        guidance: "To comply with the condition-reporting requirement, the certificate holder must use the NOTAM system, as appropriate, along with other systems and authorized procedures. The ACSI checks current NOTAMs as part of inspection preparation and also checks the airport's NOTAM logs on site; ACSIs should consider comparing the NOTAM logs against the daily self-inspection reports to determine whether NOTAMs were issued appropriately and in a timely manner for identified discrepancies requiring one.",
      },
      {
        id: 'condrpt.3',
        question: 'Provide Information on Required Conditions',
        citation: '§139.339(c)',
        guidance: "There are nine airport conditions identified in §139.339(c) that must be reported, along with any other condition specified in the approved ACM or that might otherwise affect the safe operations of air carriers; AC 150/5200-28 and JO 7930.2 provide further guidance. The ACSI should also remain alert to conditions that may fall under the 'any other condition that may otherwise adversely affect the safe operation of air carriers' catch-all, addressing each such item directly with the airport operator to determine, as appropriate, a course of action, including whether it must be reported.",
      },
      {
        id: 'condrpt.4',
        question: '12 CCM of Records of Each Dissemination',
        citation: '§139.339(d)',
        guidance: 'The certificate holder must prepare and keep, for at least 12 consecutive calendar months, a record of every disseminated airport condition report; electronic storage is allowable provided the records remain readily available to the ACSI for review. Records of airport conditions required under §139.339 must be maintained for 12 consecutive calendar months (Order §4.9.2, the Records section), and the ACSI verifies that appropriate and timely NOTAMs were issued for any discrepancies requiring one by reviewing and comparing NOTAM logs against self-inspection records.',
      },
    ],
  },
  // ── Section 22: Noncomplying Conditions ──
  {
    id: 'p139-noncomply',
    number: 22,
    title: 'Noncomplying Conditions',
    reference: '14 CFR §139.343',
    items: [
      { id: 'noncomply.1', question: 'Limit ACR OPNS to Safe Areas when Uncorrected Unsafe Conditions Exist', citation: '§139.343' },
    ],
  },
]

export function sectionsForAirportType(t: AirportType): AcsiChecklistSection[] {
  return t === 'faa_part139' ? PART139_CERT_SECTIONS : ACSI_CHECKLIST_SECTIONS
}

export function sectionMetaById(sectionId: string): AcsiChecklistSection | undefined {
  return [...ACSI_CHECKLIST_SECTIONS, ...PART139_CERT_SECTIONS].find(s => s.id === sectionId)
}
