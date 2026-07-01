//! Touhou tracking — its own table with Touhou-specific fields (category).
//! Category e.g. game / music / print / doujin. Per-domain table (not a shared `works`).

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
pub struct Work {
    pub id: Uuid,
    pub title: String,
    pub category: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertWork {
    pub title: String,
    pub category: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/touhou/items",
    params(("status" = Option<String>, Query, description = "filter by status")),
    responses((status = 200, body = Vec<Work>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Work>>> {
    let rows = sqlx::query_as::<_, Work>(
        "SELECT * FROM touhou WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/touhou/items", request_body = UpsertWork,
    responses((status = 200, body = Work), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertWork>,
) -> AppResult<Json<Work>> {
    let row = sqlx::query_as::<_, Work>(
        "INSERT INTO touhou (id, title, category, status, rating, cover_url, link, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.title)
    .bind(b.category)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/touhou/items/{id}", request_body = UpsertWork,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Work), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertWork>,
) -> AppResult<Json<Work>> {
    let row = sqlx::query_as::<_, Work>(
        "UPDATE touhou SET title = $2, category = $3, status = $4, rating = $5,
            cover_url = $6, link = $7, note = $8, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.title)
    .bind(b.category)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/touhou/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM touhou WHERE id = $1")
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
