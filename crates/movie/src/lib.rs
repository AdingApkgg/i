//! Movie / TV / anime watching tracker (P2). Per-domain table with fields like
//! year, season/episode progress. Status e.g. 在看 / 看过 / 想看.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "movie", "status": "todo" })) }),
    )
}
