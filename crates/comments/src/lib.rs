//! Self-implemented comment system (P3). Design reference: Artalk
//! (threads, moderation, notifications). Importers will ingest existing
//! Artalk / Twikoo / Waline exports. Schema already seeded in migrations.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "comments", "status": "todo" })) }),
    )
}
