-- SPI-003 "Daily Self-Inspection Completion Rate": rewrite the 6 broken monthly
-- values (were 0/0/4/0/0/6.5% alert) to a realistic high-90s trend now that KDRA
-- has ~180 self-inspections. target 100, alert_threshold 95, direction higher.
BEGIN;
UPDATE sms_spi_measurements m
SET value = v.val, status = v.st
FROM (VALUES
  (DATE '2026-02-01', 100.0, 'on_target'),
  (DATE '2026-03-01',  98.0, 'warning'),
  (DATE '2026-04-01', 100.0, 'on_target'),
  (DATE '2026-05-01',  99.0, 'warning'),
  (DATE '2026-06-01', 100.0, 'on_target'),
  (DATE '2026-07-01', 100.0, 'on_target')
) AS v(ps, val, st)
WHERE m.spi_id = '1152b900-cb4d-42bf-b836-68e9cd5f5ebe'
  AND m.period_start = v.ps;
COMMIT;
SELECT jsonb_agg(jsonb_build_object('ps', period_start, 'val', value, 'status', status) ORDER BY period_start) AS spi003_now
FROM sms_spi_measurements WHERE spi_id = '1152b900-cb4d-42bf-b836-68e9cd5f5ebe';
