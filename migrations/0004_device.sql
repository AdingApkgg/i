CREATE TABLE IF NOT EXISTS device (
    id         UUID PRIMARY KEY,
    name       TEXT NOT NULL,
    category   TEXT,
    spec       TEXT,
    status     TEXT NOT NULL,
    acquired   TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_status_idx ON device (status);
