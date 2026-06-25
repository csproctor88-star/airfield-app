# Nav Search (inline filter) — Design

**Date:** 2026-06-25
**Status:** Approved for planning
**Module touched:** navigation (desktop sidebar + mobile `/more`)

## Problem

The navigation is getting long. As modules have accumulated (FLIP, Read File,
AMTR, SMS, AEP, Training, …) the grouped sidebar and the `/more` page require
scrolling and group-expanding to reach a destination. The user wants a search
box at the top of the panel/page to jump straight to a page by name.

## Decisions (locked during brainstorming)

1. **Interaction model:** inline filter box — a text input pinned at the top of
   the sidebar (and the top of `/more`). Not a Ctrl/Cmd-K command-palette
   overlay.
2. **Results display:** flat ranked list. While typing, the grouped tree is
   replaced by a single flat list of matching destinations, best matches first.
   Clearing the box restores the normal grouped navigation.
3. **Match scope:** name + curated keyword aliases (acronyms, regs, common
   synonyms) — e.g. `BASH` → Wildlife, `lights` → Visual NAVAIDs, `AMTR` →
   Training Records, `TALPA` → Field Conditions.

## Non-goals (explicit scope guard)

- No searching *inside* modules (no records/content/row search — destinations
  only).
- No Ctrl/Cmd-K floating command-palette overlay.
- No fuzzy / typo-tolerant matching (substring + alias only).
- No change to the existing "Customize Navigation" edit mode.
- No new persisted user state (search is ephemeral; nothing saved to
  `profiles.sidebar_config`).

## Architecture

### Single source of truth for matching

The only matching/ranking logic lives in one new pure module so the two
surfaces cannot diverge.

**`lib/sidebar-config.ts` — extend the registry**

- Add an optional field to `NavItemDef`:
  ```ts
  export type NavItemDef = {
    name: string
    href: string
    iconName: string
    keywords?: string[]   // NEW — aliases for search (acronyms, regs, synonyms)
  }
  ```
- Author `keywords` on items where the visible name alone would miss common
  queries. Items whose name already contains the obvious term get none. Initial
  alias set (extend as needed during implementation):

  | href | name | keywords |
  |---|---|---|
  | `/wildlife` | Wildlife / BASH | `bird`, `strike`, `hazard`, `BASH` |
  | `/wildlife/whmp` | Wildlife / WHMP | `wildlife hazard management plan` |
  | `/infrastructure` | Visual NAVAIDs | `lights`, `lighting`, `PAPI`, `VASI`, `navaid`, `outage` |
  | `/amtr` | Training Records | `AMTR`, `currency`, `qualification` |
  | `/field-conditions` | Field Conditions | `TALPA`, `RCR`, `runway condition`, `snow` |
  | `/flip` | FLIP Management | `continuity binder`, `publications` |
  | `/scn` | Secondary Crash Net | `SCN`, `crash net` |
  | `/qrc` | QRC | `emergency`, `checklist`, `contingency` |
  | `/obstructions` | Obstruction Eval Tool | `OET`, `UFC`, `imaginary surface` |
  | `/ppr` | PPR Log | `prior permission`, `transient` |
  | `/contractors` | Personnel on Airfield | `contractor`, `escort`, `AF Form 483` |
  | `/notams` | NOTAMs | `notice to airmen` |
  | `/acsi` | (if present) | `airfield certification`, `compliance` |
  | `/sms` | Safety Management | `SMS`, `safety` |
  | `/aep` | Emergency Plan | `AEP`, `emergency` |
  | `/regulations` | Reference Library | `regs`, `AFI`, `DAFMAN`, `UFC` |
  | `/reports` | Reports & Analytics | `analytics`, `trends`, `aging` |

  This is a hand-curated starter list; the implementer may add a few more where
  obvious. Do **not** fabricate regulation paragraph numbers — only well-known
  reg/form names.

- Add (or confirm) registry entries for any `/more`-only destination not
  currently in `ALL_NAV_ITEMS` so the one registry covers every searchable page
  on both surfaces — currently `/sms/policy` ("Safety Policy"). Adding an entry
  to `ALL_NAV_ITEMS` does **not** change the sidebar layout: the sidebar renders
  from the config `sections` arrays, not from the full registry. `NAV_ITEM_MAP`
  picks the new entry up automatically.

**`lib/nav-search.ts` — new, pure, unit-tested**

```ts
// Returns a match score; 0 means "no match". Higher = better.
export function scoreNavMatch(query: string, name: string, keywords?: string[]): number
```

Ranking tiers (highest to lowest), case-insensitive, query trimmed:

1. Exact name match
2. Name starts with query
3. Any word in name starts with query
4. Name contains query (substring)
5. Any keyword starts with query
6. Any keyword contains query
7. (none) → `0`

Implementation note: assign descending integer weights per tier (e.g.
`100/80/60/40/30/20`). Stable-sort callers by score desc; ties keep registry
order. Empty/whitespace query is handled by the *caller* (it shows the normal
nav and never calls the scorer).

Optional convenience export for the sidebar:
```ts
export function searchRegistry(query: string): NavItemDef[]
// = ALL_NAV_ITEMS mapped to {item, score}, filtered score>0, sorted desc.
```

### Desktop sidebar — `components/layout/sidebar-nav.tsx`

- New local state: `const [query, setQuery] = useState('')`.
- **Render the search input** at the top of the scrollable nav area (after the
  logo/header block, before the pinned `<div data-tour="sidebar-pinned">`), and
  **only when `isOpen`** — the collapsed icon rail has no horizontal room, so it
  shows no box. Use existing theme tokens (`--color-bg-inset` for the field,
  `--color-border`, `--color-text-*`); a leading `Search` lucide icon and a
  trailing clear (`X`) button when `query` is non-empty.
- **Branch the body render** inside the existing
  `<div style={{ flex: 1, ... overflowY: 'auto' }}>`:
  - `query.trim() === ''` → existing render unchanged (pinned + grouped
    sections + flat Settings at bottom).
  - non-empty → flat results:
    ```
    searchRegistry(query)
      .filter(def => def.href !== '/settings')   // settings still pinned below
      .filter(def => isItemVisible(def.href))
      .map(def => renderNavItem(def.href))        // no `indented` arg → flat
    ```
    Render "No matches" (`--color-text-4`, small, italic) when the list is
    empty. The flat list reuses `renderNavItem`, so icons, pending/expiring
    badges, and active-route highlighting keep working. Keep the flat Settings
    row + divider at the bottom regardless (or include `/settings` in results —
    implementer's call; default: keep it pinned at bottom and exclude it from
    results, matching current behavior).
- **Keyboard:** `Esc` clears the query (and the box stays focused);
  `Enter` navigates (`router.push`) to the first visible result, if any.
- **Edit mode** (`editMode === true`) is unaffected — the search box renders
  only in the normal (non-edit) sidebar. Do not show it in the edit UI.
- The auto-expand-group effects and tour event listeners are untouched; they
  only matter when the grouped tree is shown (empty query).

### Mobile `/more` — `app/(app)/more/page.tsx`

- New local state `const [query, setQuery] = useState('')` in `MorePage`.
- **Render the search input** at the top of the white card (after the "More"
  title, before `data-tour="more-pinned"`). Same styling approach as the
  sidebar box.
- **Branch the card body:**
  - empty query → existing pinned + `CollapsibleGroup` render, unchanged.
  - non-empty → flat results. Build a flat searchable set from the existing
    module arrays (so each result keeps its `ModuleItem` icon + color + badge):
    ```
    const ALL_MORE_ITEMS = [...opsItems, ...mgmtItems, ...smsItems,
      ...training139Items, ...aepItems, ...refItems, ...adminItems,
      ...settingsItems, ...pinnedItems]
    ```
    Score each via `scoreNavMatch(query, item.name, NAV_ITEM_MAP.get(item.href)?.keywords)`,
    keep score>0, sort desc, then run the result list through the **existing**
    `filterItems(...)` gate so permission/module/airport-type rules apply
    exactly as today. Render each surviving item with the existing `<NavItem>`
    (passing `badgeFor(item.href)`). "No matches" line when empty.
  - The CES-simplified branch (`has(CES_VIEW) && !has(INSPECTIONS_VIEW)`) gets
    the same search box over its small `cesItems` set, for consistency. (Low
    cost; same pattern.)
- Import `NAV_ITEM_MAP` from `@/lib/sidebar-config` and a `Search` / `X` icon
  from `lucide-react`.

## Visibility / security guarantee

Search never widens access. On both surfaces the scored candidates are passed
through the *existing* gate before render:

- sidebar: `isItemVisible(href)` (`HREF_TO_VIEW_PERM` + `isModuleEnabled` +
  airport-type).
- `/more`: `filterItems(...)` (`HREF_PERMISSION` + `isModuleEnabled` +
  airport-type).

A page the user cannot currently reach in the nav can never appear in search
results. No new RLS or permission surface is introduced.

## Testing

- **`tests/nav-search.test.ts`** (new) — unit tests for `scoreNavMatch`:
  - exact name match outranks prefix outranks substring outranks alias.
  - alias hit: `scoreNavMatch('BASH', 'Wildlife / BASH', ['bird','BASH'])` > 0;
    `scoreNavMatch('lights', 'Visual NAVAIDs', ['lights'])` > 0.
  - case-insensitivity: `amtr` and `AMTR` score identically.
  - no-match returns `0`.
  - whitespace-only / empty handled (scorer may return 0; callers short-circuit
    — assert the contract chosen).
  - ranking order of a small fixture list is as expected.
- Manual smoke (not automated): type in sidebar (expanded) and `/more`; confirm
  flat list, clear restores groups, Esc/Enter on sidebar, gating respected for a
  read-only role, collapsed sidebar shows no box.
- Gate on `npx tsc --noEmit` + `npm run build` RC 0 + `npx vitest run` green.

## Files

**New**
- `lib/nav-search.ts`
- `tests/nav-search.test.ts`

**Modified**
- `lib/sidebar-config.ts` — `keywords?` on `NavItemDef`; author alias set; add
  `/sms/policy` (and any other `/more`-only) registry entry.
- `components/layout/sidebar-nav.tsx` — search box + flat-result branch +
  keyboard handlers.
- `app/(app)/more/page.tsx` — search box + flat-result branch (full + CES
  variants).

## Rollout

Pure additive UI; no migration, no schema, no permission change. Ships behind no
flag — it's an always-on convenience. `defaultEnabled`/module gating is N/A
(it's navigation chrome, not a module).
