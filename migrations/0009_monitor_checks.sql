-- 0009_monitor_checks.sql
--
-- Uptime monitor history. Targets live in the shared `monitors` table (created
-- in 0001_init.sql). A tokio background scheduler (crate `i-monitor`,
-- `run_scheduler`) probes every enabled target on a fixed tick and persists one
-- row per check here. GET /api/monitor/status reads the LATEST row per target.

CREATE TABLE IF NOT EXISTS monitor_checks (
    id          UUID PRIMARY KEY,
    monitor_id  UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    ok          BOOLEAN NOT NULL,
    status_code INT,
    latency_ms  INT,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id_checked_at
    ON monitor_checks (monitor_id, checked_at DESC);

-- Helpful index for the scheduler's enabled-target scan.
CREATE INDEX IF NOT EXISTS idx_monitors_enabled_kind ON monitors (enabled, kind);
