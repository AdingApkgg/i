//! Visual novel (gal) tracking — its own table with gal-specific fields
//! (brand/play_hours). Status e.g. 在玩 / 通关 / 搁置 / 想玩. Per-domain table.

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
pub struct Vn {
    pub id: Uuid,
    pub title: String,
    pub brand: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub play_hours: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertVn {
    pub title: String,
    pub brand: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub play_hours: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/gal/items",
    params(("status" = Option<String>, Query, description = "filter by status")),
    responses((status = 200, body = Vec<Vn>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Vn>>> {
    let rows = sqlx::query_as::<_, Vn>(
        "SELECT * FROM gal WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/gal/items", request_body = UpsertVn,
    responses((status = 200, body = Vn), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertVn>,
) -> AppResult<Json<Vn>> {
    let row = sqlx::query_as::<_, Vn>(
        "INSERT INTO gal (id, title, brand, status, rating, play_hours, cover_url, link, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.title)
    .bind(b.brand)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.play_hours)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/gal/items/{id}", request_body = UpsertVn,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Vn), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertVn>,
) -> AppResult<Json<Vn>> {
    let row = sqlx::query_as::<_, Vn>(
        "UPDATE gal SET title = $2, brand = $3, status = $4, rating = $5, play_hours = $6,
            cover_url = $7, link = $8, note = $9, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.title)
    .bind(b.brand)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.play_hours)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/gal/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM gal WHERE id = $1")
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
