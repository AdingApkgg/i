//! Self-implemented uptime monitor. Admin-configured targets live in the shared
//! `monitors` table (from 0001_init.sql). CRUD is admin-guarded; a public
//! `/status` endpoint probes each enabled HTTP target on-demand.
//!
//! Follow-up: a tokio background scheduler that probes on `interval_sec` and
//! persists history (e.g. a `monitor_checks` table) is out of scope here.

use appcore::{AppError, AppResult, AppState};
use auth::AdminClaims;
use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Target {
    pub id: Uuid,
    pub name: String,
    pub target: String,
    pub kind: String,
    pub interval_sec: i32,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertTarget {
    pub name: String,
    pub target: String,
    pub kind: String,
    pub interval_sec: i32,
    pub enabled: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatusItem {
    pub id: Uuid,
    pub name: String,
    pub target: String,
    pub ok: bool,
    pub status_code: Option<i32>,
    pub latency_ms: Option<i64>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/monitor/items",
    params(("status" = Option<String>, Query, description = "filter by kind/status")),
    responses((status = 200, body = Vec<Target>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Target>>> {
    let rows = sqlx::query_as::<_, Target>(
        "SELECT * FROM monitors WHERE ($1::text IS NULL OR kind = $1) ORDER BY created_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/monitor/items", request_body = UpsertTarget,
    responses((status = 200, body = Target), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertTarget>,
) -> AppResult<Json<Target>> {
    let row = sqlx::query_as::<_, Target>(
        "INSERT INTO monitors (id, name, target, kind, interval_sec, enabled)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.name)
    .bind(b.target)
    .bind(b.kind)
    .bind(b.interval_sec)
    .bind(b.enabled)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/monitor/items/{id}", request_body = UpsertTarget,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Target), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertTarget>,
) -> AppResult<Json<Target>> {
    let row = sqlx::query_as::<_, Target>(
        "UPDATE monitors SET name = $2, target = $3, kind = $4, interval_sec = $5,
            enabled = $6
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.name)
    .bind(b.target)
    .bind(b.kind)
    .bind(b.interval_sec)
    .bind(b.enabled)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/monitor/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM monitors WHERE id = $1")
        .bind(id)
        .execute(&st.db)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/monitor/status",
    responses((status = 200, body = Vec<StatusItem>))
)]
pub async fn status(State(st): State<AppState>) -> AppResult<Json<Vec<StatusItem>>> {
    let targets = sqlx::query_as::<_, Target>(
        "SELECT * FROM monitors WHERE enabled = true AND kind = 'http' ORDER BY created_at DESC",
    )
    .fetch_all(&st.db)
    .await?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut items = Vec::with_capacity(targets.len());
    for t in targets {
        let started = std::time::Instant::now();
        let resp = client.get(&t.target).send().await;
        let latency_ms = started.elapsed().as_millis() as i64;
        let (ok, status_code) = match resp {
            Ok(r) => {
                let code = r.status().as_u16() as i32;
                let ok = r.status().is_success() || r.status().is_redirection();
                (ok, Some(code))
            }
            Err(_) => (false, None),
        };
        items.push(StatusItem {
            id: t.id,
            name: t.name,
            target: t.target,
            ok,
            status_code,
            latency_ms: Some(latency_ms),
        });
    }
    Ok(Json(items))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/items", get(list).post(create))
        .route("/items/{id}", axum::routing::put(update).delete(delete))
        .route("/status", get(status))
}
