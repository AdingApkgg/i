//! 东方 Project collection (P2+). Per-domain table for games / music / doujin
//! works, characters, etc. Shape TBD when this section is built.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "touhou", "status": "todo" })) }),
    )
}
