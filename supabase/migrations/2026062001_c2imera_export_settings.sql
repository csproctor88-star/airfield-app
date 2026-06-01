-- C2IMERA export settings (per-base).
--
-- The "Export for C2IMERA" tool (Settings -> Exports) stamps every exported row
-- with the reporting unit and pulls the PPR ETA from a per-base time column.
-- Both are stored here so the feature works fleet-wide (default unit is the
-- first consumer, 127 OSS/OSAB at Selfridge ANG Base).
--
-- Expand-only / additive: safe to apply against the live DB before the code
-- that reads these columns deploys.

alter table public.bases
  add column if not exists c2imera_unit text not null default '127 OSS/OSAB';

-- Logical reference to ppr_columns.id (the time column used for ETA). No hard
-- FK: PPR columns can be deleted/reconfigured, and a dangling/null value simply
-- yields a blank ETA in the export.
alter table public.bases
  add column if not exists c2imera_ppr_eta_column_id uuid;

comment on column public.bases.c2imera_unit is
  'Reporting unit stamped on the C2IMERA export (Settings -> Exports). Default 127 OSS/OSAB.';
comment on column public.bases.c2imera_ppr_eta_column_id is
  'ppr_columns.id of the time column used as ETA in the C2IMERA PPR Log export (converted to base-local). Null -> blank ETA.';
