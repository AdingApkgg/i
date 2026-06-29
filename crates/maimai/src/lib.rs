//! 舞萌 DX scores / 牌子 / rating (P4). Distinct from `library` because it
//! has a real scoring model (records imported from a 查分器 or entered by hand),
//! not just a status tag.

use appcore::AppState;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(|| async { Json(json!({ "module": "maimai", "status": "todo" })) }),
    )
}
