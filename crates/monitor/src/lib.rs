//! Self-implemented uptime monitor (P2). A tokio scheduler will probe
//! admin-configured targets (HTTP/TCP/ping), store results, and serve a
//! status page — replacing the old UptimeStatus site. Config lives in the DB.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "monitor", "status": "todo" })) }),
    )
}
