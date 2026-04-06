-- Prior Permission Required (PPR) — configurable columns + entry records
-- PPR numbers auto-generated as {julian_day}-{sequence}-{approver_OI}

CREATE TABLE IF NOT EXISTS ppr_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, column_name)
);

CREATE INDEX IF NOT EXISTS idx_ppr_columns_base ON ppr_columns(base_id);

CREATE TABLE IF NOT EXISTS ppr_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  ppr_number TEXT NOT NULL,
  arrival_date DATE NOT NULL,
  column_values JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  approver_oi TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppr_entries_base ON ppr_entries(base_id);
CREATE INDEX IF NOT EXISTS idx_ppr_entries_date ON ppr_entries(base_id, arrival_date);
