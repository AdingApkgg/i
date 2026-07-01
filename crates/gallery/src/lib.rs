//! Gallery (相册) — URL-based photo entries, no uploads.
//! Each photo references remote image/thumb URLs. Per-domain table.

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
pub struct Photo {
    pub id: Uuid,
    pub title: String,
    pub image_url: String,
    pub thumb_url: Option<String>,
    pub description: Option<String>,
    pub taken_at: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertPhoto {
    pub title: String,
    pub image_url: String,
    pub thumb_url: Option<String>,
    pub description: Option<String>,
    pub taken_at: Option<String>,
}

#[utoipa::path(
    get, path = "/api/gallery/items",
    responses((status = 200, body = Vec<Photo>))
)]
pub async fn list(State(st): State<AppState>) -> AppResult<Json<Vec<Photo>>> {
    let rows = sqlx::query_as::<_, Photo>("SELECT * FROM gallery ORDER BY created_at DESC")
        .fetch_all(&st.db)
        .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/gallery/items", request_body = UpsertPhoto,
    responses((status = 200, body = Photo), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertPhoto>,
) -> AppResult<Json<Photo>> {
    let row = sqlx::query_as::<_, Photo>(
        "INSERT INTO gallery (id, title, image_url, thumb_url, description, taken_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.title)
    .bind(b.image_url)
    .bind(b.thumb_url)
    .bind(b.description)
    .bind(b.taken_at)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/gallery/items/{id}", request_body = UpsertPhoto,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Photo), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertPhoto>,
) -> AppResult<Json<Photo>> {
    let row = sqlx::query_as::<_, Photo>(
        "UPDATE gallery SET title = $2, image_url = $3, thumb_url = $4, description = $5,
            taken_at = $6, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.title)
    .bind(b.image_url)
    .bind(b.thumb_url)
    .bind(b.description)
    .bind(b.taken_at)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/gallery/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM gallery WHERE id = $1")
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
