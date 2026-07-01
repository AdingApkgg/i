-- Movie/TV/剧场版 tracking. Per-domain table (status 在看/看过/想看).

CREATE TABLE IF NOT EXISTS movie (
    id         UUID PRIMARY KEY,
    title      TEXT NOT NULL,
    category   TEXT,
    status     TEXT NOT NULL,
    rating     INT,
    year       INT,
    cover_url  TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movie_status_idx ON movie (status);
