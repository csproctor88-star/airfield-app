# 17 — Customer Feedback

**Path:** Sidebar → Customer Feedback · Public form `/feedback/[baseId]` · URL (staff) `/feedback`

The Customer Feedback module collects structured feedback from base customers — transient aircrew, contractors, visiting units — via a public-facing form accessible by QR code. Staff see aggregate stats and individual entries through the authenticated sidebar module.

---

## Overview

Customers (pilots transiting, TDY crews, contractors, etc.) scan a QR code posted at the FBO or Base Ops counter. This opens a public form — **no authentication required**. They fill the form; entries are captured into Glidepath where staff can review, aggregate stats, and feed data into reports.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Public form** | Accessible via a direct URL without login, at `/feedback/[baseId]`. |
| **QR code** | Printable, base-scoped QR code that opens the public form. Generated in Base Setup. |
| **Form config** | The fields shown on the public form, stored on `bases.feedback_form_config` JSONB. |
| **Field types** | Text, textarea, rating (1–5 stars), yes/no, dropdown (with custom options). |
| **Entries** | Customer submissions. Stored in the `customer_feedback` table. |

---

## How to collect customer feedback (the workflow)

1. Customer sees QR code at the counter.
2. Customer scans QR with phone camera.
3. Phone browser opens `https://your-app.example.com/feedback/[baseId]`.
4. Customer fills the form — optionally leaves fields blank.
5. Customer taps **Submit**.
6. Submission saved; customer sees a thank-you page.

No account needed on the customer side. Rate limiting protects against spam.

---

## How to view feedback entries (staff)

1. Sidebar → **Customer Feedback**.
2. The list shows every submission with date and a preview.
3. Aggregate stats at the top:
   - Total count
   - Average rating (if rating fields configured)
   - Rating distribution histogram
4. Tap an entry to see all field responses.

## How to filter entries

- Date range
- Rating (only X stars)
- Specific field contents (search by keyword)

---

## How to configure the feedback form (admin)

1. Base Setup → **Customer Feedback** step (step 15).
2. Click **+ Add Field**.
3. Choose field type:
   - **Text** — single-line
   - **Text Area** — multi-line
   - **Rating** — 1–5 star rating
   - **Yes/No** — toggle
   - **Dropdown** — select from a custom list
4. Enter field label.
5. For dropdown, enter option values.
6. Toggle **Required** if the field must be filled.
7. Reorder fields via drag.
8. Save.

## How to generate or regenerate the QR code

1. Base Setup → step 15 → **Generate QR Code**.
2. QR renders on screen.
3. **Download PNG** — save to print.
4. **Download PDF** — includes QR code plus instruction text for posting.

The QR encodes the URL `https://your-app.example.com/feedback/[baseId]`. Regenerating does not change the URL — it produces the same QR — unless the installation ID changed (very rare).

## How to post the QR code

Print and post at:
- FBO counter (transient aircrew)
- Base Ops reception
- Vehicle staging area
- Visiting unit coordinator desk

Include a short instruction like "Scan to share feedback — 2 minutes, no login needed."

---

## How to export feedback to PDF

1. Feedback list → set the time filter (7 days / 30 days / All).
2. Click **Export PDF** for an immediate download.
3. Or click **Email PDF** to send through the email modal.
4. The PDF includes the aggregate stats (submission count, average rating), a rating-distribution bar chart, and a table of every individual entry in the window with name, organization, rating, and comments (including any custom field responses).

---

## Analytics integration

Customer Feedback stats appear:
- On the Reports & Analytics page as a KPI card (count, avg rating, distribution).
- See [18_reports_analytics.md](18_reports_analytics.md).

---

## Keyboard shortcuts

None specific to Customer Feedback.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Customer can't access the form | Network offline, or app URL changed | Verify the URL in a browser; regenerate QR if needed. |
| No submissions appearing | Customers aren't scanning, or rate-limited spam blocking | Post the QR more visibly; ask a customer to test-submit. |
| Dropdown options changed mid-year; old entries show old values | By design — entries preserve what was submitted | Export and analyze with awareness of the change. |
| Average rating skewed by one-off submissions | Low volume | Filter by date range or exclude outliers manually. |
| QR doesn't match installation | Was generated for a different base | Regenerate from the current installation's Base Setup. |

---

## Related manual files

- [18_reports_analytics.md](18_reports_analytics.md) — Customer feedback KPI.
- [21_base_setup.md](21_base_setup.md) — Form configuration (step 15).
