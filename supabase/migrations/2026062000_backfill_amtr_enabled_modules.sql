-- Backfill the AMTR module into existing USAF bases whose enabled_modules
-- array was frozen before AMTR was added to the module catalog.
--
-- AMTR is defaultEnabled for USAF airfields, but lib/installation-context.tsx
-- only falls back to "all modules" when enabled_modules is NULL. A non-null
-- array that simply predates AMTR silently hides Training Records from the
-- sidebar and the mobile More menu (isModuleEnabled() returns false). 35 of 41
-- USAF bases were in this state, so the v2.34 AMTR feature would be invisible
-- on them until each admin manually toggled it on.
--
-- This is additive and idempotent (the containment guard prevents duplicates),
-- touches only USAF bases, and leaves civilian (faa_part139) bases alone. An
-- admin who deliberately wants AMTR off can still toggle it in
-- Base Config -> Modules afterward.

update bases
set enabled_modules = array_append(enabled_modules, 'amtr')
where airport_type = 'usaf'
  and enabled_modules is not null
  and not (enabled_modules @> ARRAY['amtr']);
