// Part 139 certification-inspection readiness audit checklist.
// Faithful reproduction of FAA Form 5280-4 (FAA Order 5280.5D, Appendix G, pp.144-147).
// Section references = 14 CFR Part 139 Subpart D; per-item `citation` = the exact
// Form 5280-4 sub-paragraph. `guidance` (added in Phase 3-4) = Order 5280.5D Ch.4 / App.H.
// Do not edit item text without re-checking the source — no fabricated reg text.
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import type { AcsiChecklistSection } from '@/lib/constants'
import type { AirportType } from '@/lib/airport-mode'

export const PART139_CERT_SECTIONS: AcsiChecklistSection[] = [
  // ── Section 1: Methods & Procedures for Compliance ──
  {
    id: 'p139-mpc',
    number: 1,
    title: 'Methods & Procedures for Compliance',
    reference: '14 CFR §139.7',
    items: [
      { id: 'mpc.1', question: 'Compliance with Advisory Circulars', citation: '§139.7' },
    ],
  },
  // ── Section 2: Exemptions ──
  {
    id: 'p139-exempt',
    number: 2,
    title: 'Exemptions',
    reference: '14 CFR §139.111',
    items: [
      { id: 'exempt.1', question: 'Justification Still Valid — No. on record', citation: '§139.111' },
    ],
  },
  // ── Section 3: Airport Certification Manual ──
  {
    id: 'p139-acm',
    number: 3,
    title: 'Airport Certification Manual',
    reference: '14 CFR §139.201/.203',
    items: [
      { id: 'acm.1', question: 'Compliance with ACM', citation: '§139.201(a)' },
      { id: 'acm.2', question: 'Preparation', citation: '§139.201(a)' },
      { id: 'acm.3', question: 'Content', citation: '§139.203' },
      { id: 'acm.4', question: 'Maintenance', citation: '§139.201(b)' },
    ],
  },
  // ── Section 4: Records ──
  {
    id: 'p139-records',
    number: 4,
    title: 'Records',
    reference: '14 CFR §139.301',
    items: [
      { id: 'rec.1', question: 'Furnished upon Request', citation: '§139.301(a)' },
      { id: 'rec.2', question: 'Maintained for Specified Duration', citation: '§139.301(b)' },
    ],
  },
  // ── Section 5: Personnel ──
  {
    id: 'p139-personnel',
    number: 5,
    title: 'Personnel',
    reference: '14 CFR §139.303',
    items: [
      { id: 'pers.1', question: 'Sufficient Qualified Personnel', citation: '§139.303(a)' },
      { id: 'pers.2', question: 'Properly Equipped', citation: '§139.303(b)' },
      { id: 'pers.3', question: 'Trained', citation: '§139.303(c)' },
      { id: 'pers.4', question: 'Record of Training for 24 CCM', citation: '§139.303(d)' },
      { id: 'pers.5', question: 'Use of an Independent Organization or Designee', citation: '§139.303(f)' },
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
  {
    id: 'p139-snow',
    number: 9,
    title: 'Snow and Ice Control',
    reference: '14 CFR §139.313',
    items: [
      { id: 'snow.1', question: 'Prepare/Maint./Execute Plan', citation: '§139.313(a)' },
      { id: 'snow.2', question: 'Plan Addresses Prompt Removal or Control', citation: '§139.313(b)(1)' },
      { id: 'snow.3', question: 'Positioning Snow for Clearance', citation: '§139.313(b)(2)' },
      { id: 'snow.4', question: 'Use of Approved Materials', citation: '§139.313(b)(3)' },
      { id: 'snow.5', question: 'Timely Commencement', citation: '§139.313(b)(4)' },
      { id: 'snow.6', question: 'Prompt Notification to Users', citation: '§139.313(b)(5)' },
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
  {
    id: 'p139-hazmat',
    number: 11,
    title: 'Hazardous Materials',
    reference: '14 CFR §139.321',
    items: [
      { id: 'hazmat.1', question: 'Procedures for Hazardous Substances and Materials', citation: '§139.321(a)' },
      { id: 'hazmat.2', question: 'Acceptable Fire Safety Standards Established', citation: '§139.321(b)' },
      { id: 'hazmat.3', question: 'Compliance to Fire Safety Standards', citation: '§139.321(c)' },
      { id: 'hazmat.4', question: 'Inspection of Fuel Facilities every 3 CCM', citation: '§139.321(d)' },
      { id: 'hazmat.5', question: 'Record of Inspection for 12 CCM', citation: '§139.321(d)' },
      { id: 'hazmat.6', question: 'Fueling Agent Supervisor Training Every 24 CCM', citation: '§139.321(e)(1)' },
      { id: 'hazmat.7', question: 'Fueling Agent On-the-Job Training Every 24 CCM', citation: '§139.321(e)(2)' },
      { id: 'hazmat.8', question: 'Written Confirmation Every 12 CCM that Training Accomplished', citation: '§139.321(f)' },
      { id: 'hazmat.9', question: 'Require Immediate Corrective Action/Notify FAA of Noncompliance', citation: '§139.321(g)' },
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
  {
    id: 'p139-aep',
    number: 13,
    title: 'Airport Emergency Plan',
    reference: '14 CFR §139.325',
    items: [
      { id: 'aep.1', question: 'Develop/Maintain Plan for Prompt Response/Sufficient Detail', citation: '§139.325(a)' },
      { id: 'aep.2', question: 'Response Instructions — Aircraft/Bomb/Structure/Fuel/Natural/HazMat/Sabotage-Hijack/Power/Water', citation: '§139.325(b)' },
      { id: 'aep.3', question: 'Must Address Medical/Transport/Hospital/Ambulance/Inventory/Injured/Crowds/Disabled Aircraft', citation: '§139.325(c)' },
      { id: 'aep.4', question: 'Provide for Marshaling/Emergency Alarm/ATCT Coordination', citation: '§139.325(d)' },
      { id: 'aep.5', question: 'Procedures for Notifying Agencies of Accident Location', citation: '§139.325(e)' },
      { id: 'aep.6', question: 'Water Rescue to the Extent Practical', citation: '§139.325(f)' },
      { id: 'aep.7', question: 'Coordinate & Develop Plan with Participating Agencies', citation: '§139.325(g)(1),(2)' },
      { id: 'aep.8', question: 'Airport Personnel Properly Trained', citation: '§139.325(g)(3)' },
      { id: 'aep.9', question: 'Review Plan every 12 CCM', citation: '§139.325(g)(4)' },
      { id: 'aep.10', question: 'Full-Scale Exercise every 36 CCM for Class I', citation: '§139.325(h)' },
      { id: 'aep.11', question: 'Consistent with Approved Security Program', citation: '§139.325(i)' },
    ],
  },
  // ── Section 14: Self-Inspection Program ──
  {
    id: 'p139-selfinsp',
    number: 14,
    title: 'Self-Inspection Program',
    reference: '14 CFR §139.327',
    items: [
      { id: 'selfinsp.1', question: 'Inspect Daily or As Required', citation: '§139.327(a)(1)' },
      { id: 'selfinsp.2', question: 'Inspect when Required by Unusual Conditions/Accidents', citation: '§139.327(a)(2),(3)' },
      { id: 'selfinsp.3', question: 'Equipment Provided', citation: '§139.327(b)(1)' },
      { id: 'selfinsp.4', question: 'Procedures/Equipment for Dissemination of Information to Users', citation: '§139.327(b)(2)' },
      { id: 'selfinsp.5', question: 'Inspections Conducted by Qualified Personnel', citation: '§139.327(b)(3)' },
      { id: 'selfinsp.6', question: 'Personnel Properly Trained', citation: '§139.327(b)(3)' },
      { id: 'selfinsp.7', question: 'Reporting System for Prompt Correction incl. Wildlife Strikes', citation: '§139.327(b)(4)' },
      { id: 'selfinsp.8', question: '12 CCM of Records Showing Conditions Found + Corrective Actions', citation: '§139.327(c)(1)' },
      { id: 'selfinsp.9', question: 'Record of Training for 24 CCM', citation: '§139.327(c)(2)' },
    ],
  },
  // ── Section 15: Pedestrians & Ground Vehicles ──
  {
    id: 'p139-vehicles',
    number: 15,
    title: 'Pedestrians & Ground Vehicles',
    reference: '14 CFR §139.329',
    items: [
      { id: 'veh.1', question: 'Limit Access to Movement/Safety Areas', citation: '§139.329(a)' },
      { id: 'veh.2', question: 'Establish/Implement Safe-Ops Procedures', citation: '§139.329(b)' },
      { id: 'veh.3', question: 'Pedestrian/Vehicle Control with ATCT', citation: '§139.329(c)' },
      { id: 'veh.4', question: 'Control — No ATCT', citation: '§139.329(d)' },
      { id: 'veh.5', question: 'Operator Training on Procedures & Consequences', citation: '§139.329(e)' },
      { id: 'veh.6', question: 'Record of Training for 24 CCM', citation: '§139.329(f)(1)' },
      { id: 'veh.7', question: '12 CCM of Records for Accidents/Incidents', citation: '§139.329' },
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
  {
    id: 'p139-condrpt',
    number: 21,
    title: 'Airport Condition Reporting',
    reference: '14 CFR §139.339',
    items: [
      { id: 'condrpt.1', question: 'Collection/Dissemination of Airport Conditions', citation: '§139.339(a)' },
      { id: 'condrpt.2', question: 'Use of NOTAM/Other Systems', citation: '§139.339(b)' },
      { id: 'condrpt.3', question: 'Provide Information on Required Conditions', citation: '§139.339(c)' },
      { id: 'condrpt.4', question: '12 CCM of Records of Each Dissemination', citation: '§139.339(d)' },
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
