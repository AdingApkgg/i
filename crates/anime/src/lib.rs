//! Anime tracking — its own table with anime-specific fields (progress/link).
//! Status e.g. 在看 / 看完 / 想看 / 搁置. Per-domain table (not a shared `works`).

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
pub struct Anime {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub rating: Option<i32>,
    pub progress: Option<String>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertAnime {
    pub title: String,
    pub status: String,
    pub rating: Option<i32>,
    pub progress: Option<String>,
    pub cover_url: Option<String>,
    pub link: Option<String>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/anime/items",
    params(("status" = Option<String>, Query, description = "filter by status")),
    responses((status = 200, body = Vec<Anime>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Anime>>> {
    let rows = sqlx::query_as::<_, Anime>(
        "SELECT * FROM anime WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/anime/items", request_body = UpsertAnime,
    responses((status = 200, body = Anime), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertAnime>,
) -> AppResult<Json<Anime>> {
    let row = sqlx::query_as::<_, Anime>(
        "INSERT INTO anime (id, title, status, rating, progress, cover_url, link, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.title)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.progress)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/anime/items/{id}", request_body = UpsertAnime,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Anime), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertAnime>,
) -> AppResult<Json<Anime>> {
    let row = sqlx::query_as::<_, Anime>(
        "UPDATE anime SET title = $2, status = $3, rating = $4, progress = $5,
            cover_url = $6, link = $7, note = $8, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.title)
    .bind(b.status)
    .bind(b.rating)
    .bind(b.progress)
    .bind(b.cover_url)
    .bind(b.link)
    .bind(b.note)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/anime/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM anime WHERE id = $1")
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
