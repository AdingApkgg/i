//! Blog CMS. Posts live entirely in Postgres and are authored from `apps/admin`.
//! Public routes serve published posts; mutating routes require an admin token.

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
pub struct Post {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub content_md: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertPost {
    pub slug: String,
    pub title: String,
    pub content_md: String,
    #[serde(default = "draft")]
    pub status: String,
}

fn draft() -> String {
    "draft".to_string()
}

#[utoipa::path(get, path = "/api/blog/posts", responses((status = 200, body = Vec<Post>)))]
pub async fn list_published(State(st): State<AppState>) -> AppResult<Json<Vec<Post>>> {
    let posts = sqlx::query_as::<_, Post>(
        "SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC",
    )
    .fetch_all(&st.db)
    .await?;
    Ok(Json(posts))
}

#[utoipa::path(
    get, path = "/api/blog/posts/{slug}", params(("slug" = String, Path)),
    responses((status = 200, body = Post), (status = 404))
)]
pub async fn get_by_slug(
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Post>> {
    let post = sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE slug = $1")
        .bind(slug)
        .fetch_optional(&st.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(post))
}

#[utoipa::path(
    post, path = "/api/blog/posts", request_body = UpsertPost,
    responses((status = 200, body = Post), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(body): Json<UpsertPost>,
) -> AppResult<Json<Post>> {
    let post = sqlx::query_as::<_, Post>(
        "INSERT INTO posts (id, slug, title, content_md, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(body.slug)
    .bind(body.title)
    .bind(body.content_md)
    .bind(body.status)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(post))
}

#[utoipa::path(
    put, path = "/api/blog/posts/{slug}", request_body = UpsertPost,
    params(("slug" = String, Path)),
    responses((status = 200, body = Post), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<UpsertPost>,
) -> AppResult<Json<Post>> {
    let post = sqlx::query_as::<_, Post>(
        "UPDATE posts SET slug = $2, title = $3, content_md = $4, status = $5, updated_at = now()
         WHERE slug = $1 RETURNING *",
    )
    .bind(slug)
    .bind(body.slug)
    .bind(body.title)
    .bind(body.content_md)
    .bind(body.status)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(post))
}

#[utoipa::path(
    delete, path = "/api/blog/posts/{slug}", params(("slug" = String, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<axum::http::StatusCode> {
    let res = sqlx::query("DELETE FROM posts WHERE slug = $1")
        .bind(slug)
        .execute(&st.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/posts", get(list_published).post(create))
        .route("/posts/{slug}", get(get_by_slug).put(update).delete(delete))
}
