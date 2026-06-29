//! Self-hosted visitor counter (the eventual home of imported `bsz` data).
//!
//! `GET /api/analytics/count?path=/foo` bumps the per-path and site totals and
//! returns both — a Busuanzi-compatible shape.

use appcore::{AppResult, AppState};
use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Deserialize)]
pub struct CountQuery {
    #[serde(default = "default_path")]
    path: String,
}

fn default_path() -> String {
    "/".to_string()
}

#[derive(Serialize, ToSchema)]
pub struct CountResp {
    pub site_pv: i64,
    pub page_pv: i64,
}

#[utoipa::path(
    get, path = "/api/analytics/count",
    params(("path" = Option<String>, Query, description = "page path to count")),
    responses((status = 200, body = CountResp))
)]
pub async fn count(
    State(st): State<AppState>,
    Query(q): Query<CountQuery>,
) -> AppResult<Json<CountResp>> {
    let page_pv: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO page_views (path, views) VALUES ($1, 1)
        ON CONFLICT (path) DO UPDATE SET views = page_views.views + 1
        RETURNING views
        "#,
    )
    .bind(&q.path)
    .fetch_one(&st.db)
    .await?;

    let site_pv: i64 =
        sqlx::query_scalar("UPDATE site_counter SET pv = pv + 1 WHERE id = 1 RETURNING pv")
            .fetch_one(&st.db)
            .await?;

    Ok(Json(CountResp { site_pv, page_pv }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/count", get(count))
}
