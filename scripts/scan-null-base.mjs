// Go/no-go gate for removing the user_has_base_access NULL escape hatch.
// Counts rows with base_id IS NULL across every base-scoped table, using the
// service-role client (bypasses RLS = ground truth across all tenants).
//
//   node scripts/scan-null-base.mjs
//
// Exit 0 + "CLEAN" => no NULL-base rows anywhere; the helper flip is safe.
// Exit 1 + a table list => those write paths still emit NULL base_id; fix them
// (route the insert through lib/supabase/resolve-base-id.ts) before flipping.
//
// Run it once BEFORE a demo-base write sweep (baseline, should be 0 after the
// 2026062011 backfill) and again AFTER (any new NULL = a path the sweep exercised
// that isn't populating base_id).
//
// TABLES regenerated from:
//   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
//   where n.nspname='public' and c.relkind='r'
//     and exists (select 1 from information_schema.columns col
//       where col.table_schema='public' and col.table_name=c.relname and col.column_name='base_id');

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2) }
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const TABLES = [
  'acsi_inspections','activity_log','aep_comms_checks','aep_drills','aep_plans','aep_response_agencies',
  'airfield_checks','airfield_contractors','airfield_status','amtr_1098_catalog','amtr_1098_progress',
  'amtr_1098_resources','amtr_1098_years','amtr_623a','amtr_623a_comment_templates','amtr_623a_entry_types',
  'amtr_797','amtr_803','amtr_803_catalog','amtr_audit_log','amtr_catalog_version','amtr_files',
  'amtr_formal_catalog','amtr_formal_progress','amtr_inspection_checklist','amtr_inspections','amtr_jqs_catalog',
  'amtr_jqs_progress','amtr_member_exclusions','amtr_members','amtr_milestone_catalog','amtr_milestone_progress',
  'amtr_notifications','amtr_qtp','amtr_qtp_lessons','amtr_qual_catalog','amtr_qual_progress','amtr_quals',
  'amtr_rat_catalog','amtr_rat_progress','amtr_reference_index','amtr_role_assignments','annual_review_digest_log',
  'arff_status_log','base_areas','base_arff_aircraft','base_facilities','base_inspection_templates',
  'base_kiosk_tokens','base_members','base_navaids','base_runways','base_taxiways','base_wildlife_species',
  'bwc_history','check_comments','custom_status_boards','custom_status_items','customer_feedback',
  'daily_review_slots','daily_reviews','discrepancies','field_condition_reports','infrastructure_features',
  'inspections','lighting_systems','navaid_statuses','notams','obstruction_evaluations','outage_events',
  'page_view_daily','parking_apron_boundaries','parking_obstacles','parking_plans','parking_spots',
  'parking_taxilanes','photos','ppr_agencies','ppr_agency_members','ppr_columns','ppr_entries',
  'ppr_number_sequence','ppr_remarks','qrc_executions','qrc_monthly_reviews','qrc_templates','runway_status_log',
  'scn_agencies','scn_checks','shift_checklist_items','shift_checklists','sms_audits','sms_communications',
  'sms_hazards','sms_management_of_change','sms_mitigations','sms_policies','sms_risk_assessments',
  'sms_safety_reports','sms_spi_measurements','sms_spis','status_updates','training_certificates',
  'training_digest_log','training_records','training_renewals','training_topics','user_documents','waivers',
  'wildlife_hazard_assessments','wildlife_sightings','wildlife_strikes',
]
// training_topics intentionally allows NULL base_id (global templates) — excluded.
const EXPECTED_NULL_OK = new Set(['training_topics'])

const offenders = []
for (const t of TABLES) {
  if (EXPECTED_NULL_OK.has(t)) continue
  const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true }).is('base_id', null)
  if (error) { console.error(`ERROR ${t}: ${error.message}`); continue }
  if (count > 0) offenders.push({ table: t, nulls: count })
}

if (offenders.length === 0) {
  console.log(`CLEAN — 0 NULL-base_id rows across ${TABLES.length - EXPECTED_NULL_OK.size} tables. Helper flip is safe.`)
  process.exit(0)
}
console.log('NULL base_id rows found — fix these write paths before flipping the helper:')
for (const o of offenders.sort((a, b) => b.nulls - a.nulls)) console.log(`  ${o.table}: ${o.nulls}`)
process.exit(1)
