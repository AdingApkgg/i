-- Initial schema for the personal space.

-- Key/value site configuration (admin-editable).
CREATE TABLE IF NOT EXISTS site_config (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Blog posts (CMS lives entirely in the DB).
CREATE TABLE IF NOT EXISTS posts (
    id         UUID PRIMARY KEY,
    slug       TEXT UNIQUE NOT NULL,
    title      TEXT NOT NULL,
    content_md TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_status_idx ON posts (status, created_at DESC);

-- Per-domain media tracking. Each domain gets its own table with fields that
-- fit it (music: artist/album; gal: brand/play_hours). movie/touhou/device
-- tables are added when those modules are built (P2).
CREATE TABLE IF NOT EXISTS music (
    id         UUID PRIMARY KEY,
    title      TEXT NOT NULL,
    artist     TEXT,
    album      TEXT,
    status     TEXT NOT NULL,
    rating     INT,
    cover_url  TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS music_status_idx ON music (status);

CREATE TABLE IF NOT EXISTS gal (
    id         UUID PRIMARY KEY,
    title      TEXT NOT NULL,
    brand      TEXT,
    status     TEXT NOT NULL,
    rating     INT,
    play_hours INT,
    cover_url  TEXT,
    link       TEXT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gal_status_idx ON gal (status);

-- Visitor counter (Busuanzi-compatible; eventual import target for bsz data).
CREATE TABLE IF NOT EXISTS page_views (
    path  TEXT PRIMARY KEY,
    views BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS site_counter (
    id INT PRIMARY KEY,
    pv BIGINT NOT NULL DEFAULT 0,
    uv BIGINT NOT NULL DEFAULT 0
);
INSERT INTO site_counter (id, pv, uv) VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Comments (schema seeded now; module implemented in P3, Artalk-style).
CREATE TABLE IF NOT EXISTS comments (
    id         UUID PRIMARY KEY,
    page       TEXT NOT NULL,
    parent_id  UUID REFERENCES comments (id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    email      TEXT,
    content    TEXT NOT NULL,
    approved   BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_page_idx ON comments (page, created_at);

-- Monitor targets (schema seeded now; scheduler implemented in P2).
CREATE TABLE IF NOT EXISTS monitors (
    id           UUID PRIMARY KEY,
    name         TEXT NOT NULL,
    target       TEXT NOT NULL,
    kind         TEXT NOT NULL DEFAULT 'http',
    interval_sec INT NOT NULL DEFAULT 60,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
