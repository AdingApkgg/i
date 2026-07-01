//! Friends links (友链) — its own table with friend-link fields (url/avatar).
//! Status e.g. active / pending. Per-domain table (not a shared `works`).

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
pub struct Friend {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertFriend {
    pub name: String,
    pub url: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub status: String,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/friends/items",
    params(("status" = Option<String>, Query, description = "filter by status")),
    responses((status = 200, body = Vec<Friend>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Friend>>> {
    let rows = sqlx::query_as::<_, Friend>(
        "SELECT * FROM friends WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/friends/items", request_body = UpsertFriend,
    responses((status = 200, body = Friend), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertFriend>,
) -> AppResult<Json<Friend>> {
    let row = sqlx::query_as::<_, Friend>(
        "INSERT INTO friends (id, name, url, avatar_url, description, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.name)
    .bind(b.url)
    .bind(b.avatar_url)
    .bind(b.description)
    .bind(b.status)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/friends/items/{id}", request_body = UpsertFriend,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Friend), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertFriend>,
) -> AppResult<Json<Friend>> {
    let row = sqlx::query_as::<_, Friend>(
        "UPDATE friends SET name = $2, url = $3, avatar_url = $4, description = $5,
            status = $6, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.name)
    .bind(b.url)
    .bind(b.avatar_url)
    .bind(b.description)
    .bind(b.status)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/friends/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM friends WHERE id = $1")
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
