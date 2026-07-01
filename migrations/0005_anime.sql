-- Anime tracking. Per-domain table with anime-specific fields (progress/link).
-- Status e.g. 在看 / 看完 / 想看 / 搁置. link points at a bangumi page.
CREATE TABLE IF NOT EXISTS anime (
    id         UUID PRIMARY KEY,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL,
    rating     INT,
    progress   TEXT,
    cover_url  TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anime_status_idx ON anime (status);
