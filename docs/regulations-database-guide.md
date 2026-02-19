# Regulations Database Management Guide

All regulation data lives in the Supabase **`regulations`** table and the **`regulation-pdfs`** storage bucket. The application reads directly from the database, so any changes you make take effect immediately on the next page load.

---

## Verifying Accuracy & Currency

### Quick check via Supabase dashboard

1. Go to **Table Editor > regulations**
2. Sort by `reg_id` to find the regulation
3. Verify these fields are current:
   - **`title`** matches the latest published version
   - **`publication_date`** reflects the most recent edition
   - **`url`** still resolves (click it to test)
   - **`description`** accurately describes the regulation's relevance
   - **`storage_path`** points to a valid file in the `regulation-pdfs` bucket

### Verify a PDF is accessible

1. Go to **Storage > regulation-pdfs**
2. Find the file listed in the regulation's `storage_path`
3. Click it to confirm it opens and is the correct document

### Mark a regulation as verified

Update the verification timestamp so you can track when each regulation was last reviewed:

```sql
UPDATE regulations
SET last_verified_at = now(),
    verified_date = '19 Feb 2026'  -- human-readable date of the source document
WHERE reg_id = 'DAFMAN 13-204, Vol. 1';
```

### Bulk verification query

Find regulations that haven't been verified recently (or ever):

```sql
SELECT reg_id, title, publication_date, last_verified_at
FROM regulations
ORDER BY last_verified_at ASC NULLS FIRST;
```

---

## Adding a Regulation

### Step 1: Insert the database row

Run this in the Supabase **SQL Editor** (replace values with your regulation):

```sql
INSERT INTO regulations (
  reg_id,
  title,
  description,
  publication_date,
  url,
  source_section,
  source_volume,
  category,
  pub_type,
  is_core,
  is_cross_ref,
  is_scrubbed,
  tags
) VALUES (
  'AFI 10-2501',                          -- unique identifier
  'Full Spectrum Threat Response',         -- title
  'Emergency management program planning and operations for DAF installations.',
  'Current Ed.',                           -- publication date or 'Current Ed.'
  'https://example.com/afi10-2501.pdf',   -- direct PDF URL (or NULL)
  'VI-A',                                  -- source section (see Reference below)
  NULL,                                    -- source volume (NULL if not applicable)
  'emergency',                             -- category (see Reference below)
  'DAF',                                   -- pub type (see Reference below)
  false,                                   -- is_core
  true,                                    -- is_cross_ref
  false,                                   -- is_scrubbed
  ARRAY['emergency management', 'CBRN', 'force protection']  -- searchable tags
);
```

### Step 2 (optional): Upload a PDF to storage

1. Go to **Storage > regulation-pdfs**
2. Upload the PDF file (use lowercase with underscores, e.g., `afi_10-2501.pdf`)
3. Update the regulation row with the storage path:

```sql
UPDATE regulations
SET storage_path = 'afi_10-2501.pdf'
WHERE reg_id = 'AFI 10-2501';
```

When `storage_path` is set, the app will generate a signed URL and open the PDF in the built-in viewer. When only `url` is set, it opens the external link. When both are set, `storage_path` takes priority.

---

## Changing a Regulation

### Update fields via SQL Editor

```sql
UPDATE regulations
SET title = 'Updated Title Here',
    description = 'Updated description here.',
    publication_date = '15 Jan 2026',
    url = 'https://new-url.example.com/document.pdf',
    last_verified_at = now()
WHERE reg_id = 'DAFMAN 13-204, Vol. 1';
```

### Update fields via Table Editor

1. Go to **Table Editor > regulations**
2. Click the row you want to edit
3. Modify the fields directly in the editor
4. Click **Save**

### Replace a stored PDF

1. Go to **Storage > regulation-pdfs**
2. Delete the old file
3. Upload the new file (keep the same filename, or update `storage_path` if the name changes)
4. If the filename changed:

```sql
UPDATE regulations
SET storage_path = 'new_filename.pdf'
WHERE reg_id = 'DAFMAN 13-204, Vol. 1';
```

### Common update scenarios

**Regulation was republished with a new date:**
```sql
UPDATE regulations
SET publication_date = '01 Mar 2026',
    last_verified_at = now(),
    verified_date = '01 Mar 2026'
WHERE reg_id = 'DAFMAN 13-204, Vol. 1';
```

**External URL changed:**
```sql
UPDATE regulations
SET url = 'https://new-host.example.com/document.pdf'
WHERE reg_id = 'AFI 13-204, Vol. 3';
```

**Recategorize a regulation:**
```sql
UPDATE regulations
SET category = 'safety',
    tags = ARRAY['safety', 'SMS', 'risk management']
WHERE reg_id = '14 CFR Part 5';
```

---

## Deleting a Regulation

### Step 1: Remove from the database

```sql
DELETE FROM regulations
WHERE reg_id = 'AFI 10-2501';
```

### Step 2: Remove the stored PDF (if applicable)

1. Go to **Storage > regulation-pdfs**
2. Find and delete the file that was listed in the regulation's `storage_path`

> **Note:** User-uploaded PDFs (in the `user-uploads/` folder) reference regulations by `reg_id`. If users have uploaded personal copies for a deleted regulation, those files will become orphaned. They won't cause errors but will consume storage.

---

## Field Reference

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `reg_id` | text | Unique identifier (e.g., `DAFMAN 13-204, Vol. 1`). Must be unique. |
| `title` | text | Full title of the regulation. |
| `description` | text | Brief description of relevance to airfield operations. |
| `source_section` | text | Which section of the AOMS source matrix it belongs to. |
| `category` | text | Topical category for filtering. |
| `pub_type` | text | Publication type for filtering. |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `publication_date` | text | Date string (e.g., `22 Jul 2020`) or `Current Ed.` |
| `url` | text | Direct link to the external source (usually a PDF URL). |
| `source_volume` | text | Volume reference (e.g., `Vol. 1`, `UFC 3-260-01`). |
| `storage_path` | text | Filename in the `regulation-pdfs` bucket. |
| `is_core` | boolean | `true` for the 3 core DAFMAN 13-204 volumes. Default `false`. |
| `is_cross_ref` | boolean | `true` for cross-referenced regulations. Default `false`. |
| `is_scrubbed` | boolean | `true` for scrubbed/mentioned-only regulations. Default `false`. |
| `tags` | text[] | Array of searchable keywords. Default `{}`. |
| `file_size_bytes` | integer | PDF file size (set by the download script). |
| `last_verified_at` | timestamptz | When the regulation was last reviewed for accuracy. |
| `verified_date` | text | Human-readable date of the source document edition. |

### Valid `category` values

| Value | Label |
|-------|-------|
| `airfield_ops` | Airfield Operations |
| `airfield_mgmt` | Airfield Management |
| `atc` | Air Traffic Control |
| `airfield_design` | Airfield Design & Planning |
| `pavement` | Pavement & Surfaces |
| `lighting` | Lighting & NAVAIDs |
| `safety` | Safety & Mishap Prevention |
| `bash_wildlife` | BASH / Wildlife |
| `driving` | Airfield Driving |
| `emergency` | Emergency Management |
| `publications` | Publications & Records |
| `personnel` | Personnel & Training |
| `construction` | Construction & Facilities |
| `fueling` | Fueling & Hazmat |
| `security` | Security & Force Protection |
| `international` | International & Joint Use |
| `notams` | NOTAMs & Flight Info |
| `uas` | UAS Operations |
| `contingency` | Contingency Operations |
| `financial` | Financial & Manpower |

### Valid `pub_type` values

| Value | Label |
|-------|-------|
| `DAF` | DAF (AFI/DAFI/AFMAN/DAFMAN/AFH/AFPD) |
| `FAA` | FAA Orders & Advisory Circulars |
| `UFC` | UFC / Unified Facilities Criteria |
| `CFR` | Code of Federal Regulations |
| `DoD` | DoD Publications |
| `ICAO` | ICAO Standards |

### Valid `source_section` values

| Value | Label |
|-------|-------|
| `core` | Core Publications |
| `I` | I - Vol. 1 Refs |
| `II` | II - Vol. 2 Refs |
| `III` | III - Vol. 3 Refs |
| `IV` | IV - UFC 3-260-01 Refs |
| `V` | V - Additional UFC/FC |
| `VI-A` | VI-A - DAF Cross-Refs |
| `VI-B` | VI-B - FAA/DOT Cross-Refs |
| `VI-C` | VI-C - UFC/DoD Cross-Refs |
| `VII-A` | VII-A - Scrubbed (DAF) |
| `VII-B` | VII-B - Scrubbed (FAA) |
| `VII-C` | VII-C - Scrubbed (Vols 2-3) |

### Entry type logic

Each regulation should have exactly one of these set to `true`:

| Type | Flags | Description |
|------|-------|-------------|
| **CORE** | `is_core = true` | The 3 DAFMAN 13-204 volumes |
| **DIRECT** | all `false` | Directly referenced in the source material |
| **CROSS-REF** | `is_cross_ref = true` | Cross-referenced from other regulations |
| **SCRUBBED** | `is_scrubbed = true` | Mentioned within DAFMAN 13-204 but not in the formal reference list |

### Storage path naming convention

When uploading PDFs to the `regulation-pdfs` bucket, use this format:
- Lowercase
- Replace spaces with underscores
- Replace special characters (`:`, `*`, `?`, etc.) with hyphens
- Add `.pdf` extension

Examples:
| reg_id | storage_path |
|--------|-------------|
| `DAFMAN 13-204, Vol. 1` | `dafman_13-204-_vol._1.pdf` |
| `14 CFR Part 139` | `14_cfr_part_139.pdf` |
| `UFC 3-260-01` | `ufc_3-260-01.pdf` |
