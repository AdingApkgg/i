-- Touhou tracking — per-domain table with a `category` field
-- (game / music / print / doujin).
CREATE TABLE IF NOT EXISTS touhou (
    id         UUID PRIMARY KEY,
    title      TEXT NOT NULL,
    category   TEXT,
    status     TEXT NOT NULL,
    rating     INT,
    cover_url  TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS touhou_status_idx ON touhou (status);
