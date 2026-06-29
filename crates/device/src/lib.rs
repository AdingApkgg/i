//! Device list / status (P2). Per-domain table for hardware I own (specs,
//! acquired date, in-use/retired); ties into the `monitor` module's status.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "device", "status": "todo" })) }),
    )
}
