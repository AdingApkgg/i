-- Gallery (相册) — URL-based photo entries (no uploads). Per-domain table.

CREATE TABLE IF NOT EXISTS gallery (
    id          UUID PRIMARY KEY,
    title       TEXT NOT NULL,
    image_url   TEXT NOT NULL,
    thumb_url   TEXT,
    description TEXT,
    taken_at    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_created_at_idx ON gallery (created_at DESC);
