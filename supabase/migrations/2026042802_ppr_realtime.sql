-- ============================================================
-- PPR realtime
--
-- Both /ppr (staff page) and the new useSidebarBadgeCounts hook
-- subscribe to ppr_entries and ppr_coordination via Supabase
-- realtime, but the tables were never added to the publication.
-- The /ppr page worked anyway because it also reloads on every
-- user action; the sidebar dot has no other refresh trigger and
-- got stuck after status changes (e.g. dot persisted after a PPR
-- was approved).
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE ppr_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE ppr_coordination;
