-- Custom Status Boards — user-configurable G/Y/R status panels on the dashboard
-- Examples: Arresting Systems, Comm Status, ARFF Equipment, etc.

CREATE TABLE IF NOT EXISTS custom_status_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  board_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, board_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_status_boards_base ON custom_status_boards(base_id);

CREATE TABLE IF NOT EXISTS custom_status_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES custom_status_boards(id) ON DELETE CASCADE,
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_status_items_board ON custom_status_items(board_id);
CREATE INDEX IF NOT EXISTS idx_custom_status_items_base ON custom_status_items(base_id);
