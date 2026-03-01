# RLS Verification Test Checklist

Verifies role-based row-level security policies deployed in migrations `2026030100`–`2026030103`.

## Setup

You need test accounts at a single base (Base A), plus a second base (Base B) to verify cross-base isolation. Each non-sys_admin role should have a `base_members` row for Base A only.

| Test Account | Role              | Base Membership |
|--------------|-------------------|-----------------|
| User 1       | `sys_admin`       | None needed (bypasses via helper) |
| User 2       | `airfield_manager`| Base A |
| User 3       | `amops`           | Base A |
| User 4       | `ces`             | Base A |
| User 5       | `read_only`       | Base A |

---

## 1. Cross-Base Isolation

| #   | Action | Expected |
|-----|--------|----------|
| 1.1 | As `airfield_manager` (Base A), view discrepancies list | Only Base A records shown |
| 1.2 | As `airfield_manager` (Base A), try to insert a discrepancy with `base_id` = Base B | Rejected |
| 1.3 | As `sys_admin`, view discrepancies list for Base B | Base B records visible |
| 1.4 | As `sys_admin`, create a discrepancy at Base B | Succeeds (no base_members row needed) |

## 2. Writable Roles (sys_admin, base_admin, airfield_manager, namo, amops)

Test with `amops` at Base A. Repeat one spot-check with `airfield_manager` to confirm admin tier works too.

| #    | Table                      | Action                  | Expected |
|------|----------------------------|-------------------------|----------|
| 2.1  | `discrepancies`            | Create                  | Succeeds |
| 2.2  | `discrepancies`            | Edit                    | Succeeds |
| 2.3  | `discrepancies`            | Delete                  | Succeeds |
| 2.4  | `inspections`              | Create                  | Succeeds |
| 2.5  | `airfield_checks`          | Create                  | Succeeds |
| 2.6  | `notams`                   | Create / Edit / Delete  | Succeeds |
| 2.7  | `obstruction_evaluations`  | Create / Edit / Delete  | Succeeds |
| 2.8  | `waivers`                  | Create                  | Succeeds |
| 2.9  | `photos`                   | Upload (insert)         | Succeeds |
| 2.10 | `photos`                   | Delete                  | Succeeds |
| 2.11 | `status_updates`           | Create                  | Succeeds |
| 2.12 | `navaid_statuses`          | Create / Update         | Succeeds |
| 2.13 | `airfield_status`          | Update (runway status)  | Succeeds |

## 3. Read-Only Roles (ces, safety, atc, read_only)

Test with `ces` at Base A.

| #    | Table                      | Action  | Expected |
|------|----------------------------|---------|----------|
| 3.1  | `discrepancies`            | View    | Succeeds (Base A only) |
| 3.2  | `discrepancies`            | Create  | Rejected |
| 3.3  | `discrepancies`            | Edit    | Rejected |
| 3.4  | `discrepancies`            | Delete  | Rejected |
| 3.5  | `inspections`              | View    | Succeeds |
| 3.6  | `inspections`              | Create  | Rejected |
| 3.7  | `airfield_checks`          | View    | Succeeds |
| 3.8  | `airfield_checks`          | Create  | Rejected |
| 3.9  | `notams`                   | View    | Succeeds |
| 3.10 | `notams`                   | Create  | Rejected |
| 3.11 | `waivers`                  | View    | Succeeds |
| 3.12 | `waivers`                  | Create  | Rejected |
| 3.13 | `photos`                   | Upload  | Rejected |
| 3.14 | `airfield_status`          | Update  | Rejected |

Repeat 3.2 with `read_only` to confirm same behavior.

## 4. Special Case: check_comments (All Base Members Can Comment)

| #   | Role        | Action                   | Expected |
|-----|-------------|--------------------------|----------|
| 4.1 | `ces`       | Insert comment on a check | Succeeds |
| 4.2 | `read_only` | Insert comment on a check | Succeeds |
| 4.3 | `ces`       | Delete a comment          | Rejected |
| 4.4 | `amops`     | Delete a comment          | Succeeds |

## 5. Special Case: activity_log (All Can Insert, Restricted Update/Delete)

| #   | Role               | Action                                 | Expected |
|-----|--------------------|----------------------------------------|----------|
| 5.1 | `ces`              | Trigger action that logs activity      | Log insert succeeds |
| 5.2 | `read_only`        | Trigger activity logging               | Log insert succeeds |
| 5.3 | `ces`              | Delete someone else's activity entry   | Rejected |
| 5.4 | `ces`              | Update own activity log entry          | Succeeds |
| 5.5 | `airfield_manager` | Delete any activity log entry          | Succeeds (admin) |

## 6. Config Tables (sys_admin Write Only)

| #   | Table           | Role               | Action       | Expected |
|-----|-----------------|--------------------|--------------| ---------|
| 6.1 | `bases`         | `airfield_manager` | View         | Succeeds |
| 6.2 | `bases`         | `airfield_manager` | Create/Edit  | Rejected |
| 6.3 | `bases`         | `sys_admin`        | Create/Edit  | Succeeds |
| 6.4 | `base_runways`  | `amops`            | Edit         | Rejected |
| 6.5 | `regulations`   | `ces`              | View         | Succeeds |
| 6.6 | `regulations`   | `ces`              | Edit         | Rejected |
| 6.7 | `regulations`   | `sys_admin`        | Edit         | Succeeds |

## 7. Profiles

| #   | Role               | Action                          | Expected |
|-----|--------------------|-------------------------------- |----------|
| 7.1 | `ces`              | View all profiles               | Succeeds |
| 7.2 | `ces`              | Update own profile              | Succeeds |
| 7.3 | `ces`              | Update another user's profile   | Rejected |
| 7.4 | `airfield_manager` | Update another user's profile   | Succeeds (admin) |
| 7.5 | `airfield_manager` | Delete a profile                | Rejected (not sys_admin) |
| 7.6 | `sys_admin`        | Delete a profile                | Succeeds |

## 8. Base Members (Admin Write Only)

| #   | Role               | Action                | Expected |
|-----|--------------------|---------------------- |----------|
| 8.1 | `ces`              | View own base members | Succeeds |
| 8.2 | `ces`              | Add a user to base    | Rejected |
| 8.3 | `airfield_manager` | Add a user to base    | Succeeds |
| 8.4 | `airfield_manager` | Remove user from base | Succeeds |
| 8.5 | `amops`            | Add a user to base    | Rejected (writable but not admin) |

## 9. Waiver Child Tables (FK-Based Access)

| #   | Role              | Action                                       | Expected |
|-----|-------------------|----------------------------------------------|----------|
| 9.1 | `ces` (Base A)    | View waiver_criteria for Base A waiver        | Succeeds |
| 9.2 | `ces` (Base A)    | View waiver_criteria for Base B waiver        | Empty (no access) |
| 9.3 | `amops` (Base A)  | Insert waiver_criteria for Base A waiver      | Succeeds |
| 9.4 | `ces` (Base A)    | Insert waiver_criteria                        | Rejected |
| 9.5 | `amops`           | Insert waiver_attachment, review, coordination | Succeeds |

## 10. Inspection Templates (Admin Write Only)

| #    | Role               | Action               | Expected |
|------|--------------------|-----------------------|----------|
| 10.1 | `ces` (Base A)    | View templates        | Succeeds |
| 10.2 | `ces` (Base A)    | Edit template section | Rejected |
| 10.3 | `airfield_manager` | Edit template section | Succeeds |
| 10.4 | `amops` (Base A)  | Edit template item    | Rejected (writable but not admin) |

## 11. User Regulation PDFs (Own User Only)

| #    | Action                              | Expected |
|------|-------------------------------------|----------|
| 11.1 | User A uploads a regulation PDF     | Succeeds |
| 11.2 | User A views own regulation PDFs    | Succeeds |
| 11.3 | User A views User B's regulation PDFs | Empty |

## 12. Demo Mode

| #    | Action                                    | Expected |
|------|-------------------------------------------|----------|
| 12.1 | Run app without Supabase env vars configured | All pages load with demo data, no DB errors |

---

## Quick Smoke Test (Minimum 6)

If short on time, these cover the critical paths:

1. **3.2** — `ces` cannot create a discrepancy (write restriction works)
2. **2.1** — `amops` can create a discrepancy (write permission works)
3. **1.1** — `airfield_manager` only sees own base data (isolation works)
4. **1.3** — `sys_admin` sees all bases (bypass works)
5. **4.1** — `ces` can add a check comment (special case works)
6. **8.5** — `amops` cannot add base members (admin vs writable distinction works)

---

## Automated Smoke Test Results (2026-03-01)

All 7 automated checks passed:

```
✅ Test 1: CES cannot create discrepancy (write restriction) — Correctly rejected: 42501
✅ Test 2: AMOPS can create discrepancy (write permission) — Created successfully
✅ Test 3: Base A user cannot see Base B data (isolation) — Correctly returned empty
✅ Test 4: sys_admin bypass — user_has_base_access returns TRUE for any base
✅ Test 4b: CES user — user_has_base_access returns FALSE for non-member base
✅ Test 5: CES can add check comment (special case) — Created successfully
✅ Test 6: AMOPS cannot add base members (admin vs writable) — Correctly rejected: 42501
```
