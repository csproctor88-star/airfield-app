/**
 * Aircraft Characteristics Database Schema
 * Source: USACE Transportation Systems Center Reports
 *   - TSC 13-2: Military Aircraft (Dec 2013, Rev 2)
 *   - TSC 13-3: Commercial Aircraft (Dec 2013)
 *
 * Data files:
 *   - commercial_aircraft.json (84 aircraft)
 *   - military_aircraft.json (127 aircraft)
 *
 * All weights in 1,000 lbs (klbs) unless noted.
 * All dimensions in feet unless noted.
 * Pressures in PSI. Areas in square inches.
 */

export interface AircraftClassificationNumbers {
  /** Weight at which min ACN values apply (klbs) */
  min_wt?: string;
  /** Rigid pavement ACN - High strength subgrade (K=500) */
  min_rigid_A?: string;
  /** Rigid pavement ACN - Medium strength subgrade (K=300) */
  min_rigid_B?: string;
  /** Rigid pavement ACN - Low strength subgrade (K=150) */
  min_rigid_C?: string;
  /** Rigid pavement ACN - Ultra-low strength subgrade (K=75) */
  min_rigid_D?: string;
  /** Flexible pavement ACN - High strength subgrade (CBR=15) */
  min_flex_A?: string;
  /** Flexible pavement ACN - Medium strength subgrade (CBR=10) */
  min_flex_B?: string;
  /** Flexible pavement ACN - Low strength subgrade (CBR=6) */
  min_flex_C?: string;
  /** Flexible pavement ACN - Ultra-low strength subgrade (CBR=3) */
  min_flex_D?: string;
  /** Weight at which max ACN values apply (klbs) */
  max_wt?: string;
  max_rigid_A?: string;
  max_rigid_B?: string;
  max_rigid_C?: string;
  max_rigid_D?: string;
  max_flex_A?: string;
  max_flex_B?: string;
  max_flex_C?: string;
  max_flex_D?: string;
}

export interface AircraftCharacteristics {
  /** Aircraft designation/model (e.g., "C-17A Globemaster III", "737-800") */
  aircraft: string;
  /** Aircraft manufacturer */
  manufacturer?: string;
  /** Air Logistics Center manager (military only) */
  alc_manager?: string;
  /** AFMAN 32-1121V1 group index (military only) */
  group_index?: string;
  /** "commercial" or "military" */
  category: string;

  // === DIMENSIONS (feet unless noted) ===
  /** Wing span or rotor diameter (ft) */
  wing_span_ft?: string;
  /** Overall length (ft) */
  length_ft?: string;
  /** Overall height (ft) */
  height_ft?: string;
  /** Min vertical clearance from ground to fuselage (inches) */
  vertical_clearance_in?: string;

  // === TURN DATA ===
  /** Distance from nose to pivot point (ft) */
  pivot_point_ft?: string;
  /** Minimum turn radius (ft) */
  turn_radius_ft?: string;
  /** 180-degree turn diameter (ft) */
  turn_diameter_180_ft?: string;
  /** Gear controlling turn diameter (Nose/Main) */
  controlling_gear?: string;

  // === WEIGHTS (1,000 lbs) ===
  /** Basic empty weight (klbs) */
  basic_empty_wt_klbs?: string;
  /** Basic mission takeoff weight (klbs) */
  basic_mission_to_wt_klbs?: string;
  /** Maximum takeoff weight (klbs) */
  max_to_wt_klbs?: string;
  /** Basic mission landing weight (klbs) */
  basic_mission_ldg_wt_klbs?: string;
  /** Maximum landing weight (klbs) */
  max_ldg_wt_klbs?: string;

  // === PERFORMANCE ===
  /** Takeoff distance (ft) */
  to_dist?: string;
  /** Landing distance (ft) */
  ldg_dist?: string;

  // === LANDING GEAR ===
  /** FAA gear configuration description */
  gear_config?: string;
  /** Nose gear: assemblies-tires format (e.g., "1-2") */
  nose_assemblies_tires?: string;
  /** Main gear: assemblies-tires format (e.g., "2-4") */
  main_assemblies_tires?: string;

  // === MAIN GEAR DATA ===
  /** Percent of gross weight on main gear assembly */
  main_pct_gross_load?: string;
  /** Max load per main gear assembly (klbs) */
  main_max_assembly_load_klbs?: string;
  /** Max single wheel load - main gear (klbs) */
  main_max_single_wheel_load_klbs?: string;
  /** Tire contact pressure - main gear (PSI) */
  main_contact_pressure_psi?: string;
  /** Tire contact area - main gear (sq in) */
  main_contact_area_sqin?: string;
  /** Footprint width - main gear (inches) */
  main_footprint_width_in?: string;

  // === NOSE GEAR DATA ===
  /** Percent of gross weight on nose gear assembly */
  nose_pct_gross_load?: string;
  /** Max load per nose gear assembly (klbs) */
  nose_max_assembly_load_klbs?: string;
  /** Max single wheel load - nose gear (klbs) */
  nose_max_single_wheel_load_klbs?: string;
  /** Tire contact pressure - nose gear (PSI) */
  nose_contact_pressure_psi?: string;
  /** Tire contact area - nose gear (sq in) */
  nose_contact_area_sqin?: string;
  /** Footprint width - nose gear (inches) */
  nose_footprint_width_in?: string;

  // === ACN VALUES ===
  /** Aircraft Classification Numbers for pavement evaluation */
  acn?: AircraftClassificationNumbers;

  // === METADATA ===
  /** Source PDF page number */
  source_page?: number;
  /** Additional notes (helicopter type, UAS, etc.) */
  notes?: string;
}
