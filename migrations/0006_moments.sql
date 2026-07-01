-- Moments (说说/短状态) — short status updates.
CREATE TABLE IF NOT EXISTS moments (
    id         UUID PRIMARY KEY,
    content    TEXT NOT NULL,
    mood       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moments_created_at_idx ON moments (created_at DESC);
