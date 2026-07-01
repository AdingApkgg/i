//! Movie/TV tracking — its own table with movie-specific fields (category/year).
//! Status e.g. 在看 / 看过 / 想看. Per-domain table (not a shared `works`).

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
pub struct Movie {
    pub id: Uuid,
    pub title: String,
    pub category: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub year: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertMovie {
    pub title: String,
    pub category: Option<String>,
    pub status: String,
    pub rating: Option<i32>,
    pub year: Option<i32>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/movie/items",
    params(("status" = Option<String>, Query, description = "filter by status")),
    responses((status = 200, body = Vec<Movie>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Movie>>> {
    let rows = sqlx::query_as::<_, Movie>(
        "SELECT * FROM movie WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/movie/items", request_body = UpsertMovie,
    responses((status = 200, body = Movie), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertMovie>,
) -> AppResult<Json<Movie>> {
    let row = sqlx::query_as::<_, Movie>(
        "INSERT INTO movie (id, title, category, status, rating, year, cover_url, link, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.title)
    .bind(b.category)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.year)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/movie/items/{id}", request_body = UpsertMovie,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Movie), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertMovie>,
) -> AppResult<Json<Movie>> {
    let row = sqlx::query_as::<_, Movie>(
        "UPDATE movie SET title = $2, category = $3, status = $4, rating = $5, year = $6,
            cover_url = $7, link = $8, note = $9, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.title)
    .bind(b.category)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.year)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/movie/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM movie WHERE id = $1")
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
