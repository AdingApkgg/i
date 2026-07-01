//! Moments (说说/短状态) — short status updates. Per-domain table.
//! No status: list ALL ordered by created_at DESC.

use appcore::{AppError, AppResult, AppState};
use auth::AdminClaims;
use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Moment {
    pub id: Uuid,
    pub content: String,
    pub mood: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertMoment {
    pub content: String,
    pub mood: Option<String>,
}

#[utoipa::path(
    get, path = "/api/moments/items",
    responses((status = 200, body = Vec<Moment>))
)]
pub async fn list(State(st): State<AppState>) -> AppResult<Json<Vec<Moment>>> {
    let rows = sqlx::query_as::<_, Moment>("SELECT * FROM moments ORDER BY created_at DESC")
        .fetch_all(&st.db)
        .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/moments/items", request_body = UpsertMoment,
    responses((status = 200, body = Moment), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertMoment>,
) -> AppResult<Json<Moment>> {
    let row = sqlx::query_as::<_, Moment>(
        "INSERT INTO moments (id, content, mood)
         VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.content)
    .bind(b.mood)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/moments/items/{id}", request_body = UpsertMoment,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Moment), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertMoment>,
) -> AppResult<Json<Moment>> {
    let row = sqlx::query_as::<_, Moment>(
        "UPDATE moments SET content = $2, mood = $3, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.content)
    .bind(b.mood)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/moments/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM moments WHERE id = $1")
        .bind(id)
        .execute(&st.db)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/items", get(list).post(create))
        .route("/items/{id}", axum::routing::put(update).delete(delete))
}
