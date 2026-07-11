//! Gallery (相册) — URL-based photo entries plus MinIO-backed image upload.
//! URL-based CRUD stores remote image/thumb URLs in a per-domain table.
//! Upload/serve endpoints stream binary objects to/from MinIO (S3).

use appcore::{AppError, AppResult, AppState};
use auth::AdminClaims;
use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client as S3Client;
use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// Default bucket when `MINIO_BUCKET` is unset.
const DEFAULT_BUCKET: &str = "gallery";

/// Read the target bucket name from the environment.
fn bucket_name() -> String {
    std::env::var("MINIO_BUCKET").unwrap_or_else(|_| DEFAULT_BUCKET.to_string())
}

/// Build an S3 client pointed at MinIO from environment configuration and
/// ensure the target bucket exists (creating it if necessary).
///
/// Reads: `MINIO_ENDPOINT` (e.g. `http://minio:9000`), `MINIO_ROOT_USER`,
/// `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET` (default `gallery`). Region is fixed
/// to `us-east-1`, which MinIO accepts. Uses path-style addressing so the
/// bucket is a URL path segment rather than a virtual host, as MinIO requires.
async fn s3_client() -> AppResult<(S3Client, String)> {
    let endpoint = std::env::var("MINIO_ENDPOINT")
        .map_err(|_| AppError::Internal("MINIO_ENDPOINT not set".into()))?;
    let access_key = std::env::var("MINIO_ROOT_USER")
        .map_err(|_| AppError::Internal("MINIO_ROOT_USER not set".into()))?;
    let secret_key = std::env::var("MINIO_ROOT_PASSWORD")
        .map_err(|_| AppError::Internal("MINIO_ROOT_PASSWORD not set".into()))?;
    let bucket = bucket_name();

    let creds = Credentials::new(access_key, secret_key, None, None, "minio");
    let conf = S3ConfigBuilder::new()
        .behavior_version(BehaviorVersion::latest())
        .region(Region::new("us-east-1"))
        .endpoint_url(endpoint)
        .credentials_provider(creds)
        .force_path_style(true)
        .build();
    let client = S3Client::from_conf(conf);

    ensure_bucket(&client, &bucket).await?;
    Ok((client, bucket))
}

/// Create the bucket if it does not already exist; a pre-existing bucket
/// (BucketAlreadyOwnedByYou / BucketAlreadyExists) is treated as success.
async fn ensure_bucket(client: &S3Client, bucket: &str) -> AppResult<()> {
    match client.create_bucket().bucket(bucket).send().await {
        Ok(_) => Ok(()),
        Err(e) => {
            let se = e.into_service_error();
            if se.is_bucket_already_owned_by_you() || se.is_bucket_already_exists() {
                Ok(())
            } else {
                Err(AppError::Internal(format!("create_bucket failed: {se}")))
            }
        }
    }
}

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

/// POST /api/gallery/upload — admin-only. Accepts `multipart/form-data` with a
/// `file` part, stores it in MinIO under a random UUID key (preserving the
/// original extension), and returns `{ "image_url": "/api/gallery/files/<key>" }`
/// — a relative path the front-end prefixes with its API base.
///
/// Intentionally omitted from the OpenAPI doc (multipart/binary body).
pub async fn upload(
    _admin: AdminClaims,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let (client, bucket) = s3_client().await?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("invalid multipart: {e}")))?
    {
        if field.name() != Some("file") {
            continue;
        }

        // Derive an extension from the uploaded filename, falling back to the
        // content-type, then to "bin".
        let content_type = field
            .content_type()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let ext = field
            .file_name()
            .and_then(|n| n.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase()))
            .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_alphanumeric()))
            .or_else(|| ext_from_content_type(&content_type).map(str::to_string))
            .unwrap_or_else(|| "bin".to_string());

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("failed to read file: {e}")))?;
        if data.is_empty() {
            return Err(AppError::BadRequest("empty file".into()));
        }

        let key = format!("{}.{ext}", Uuid::new_v4());
        client
            .put_object()
            .bucket(&bucket)
            .key(&key)
            .content_type(&content_type)
            .body(ByteStream::from(data))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("put_object failed: {e}")))?;

        return Ok(Json(json!({ "image_url": format!("/api/gallery/files/{key}") })));
    }

    Err(AppError::BadRequest("missing \"file\" part".into()))
}

/// GET /api/gallery/files/{key} — public. Streams the stored object back with
/// its recorded Content-Type. Returns 404 if the key is absent.
///
/// Intentionally omitted from the OpenAPI doc (binary body).
pub async fn serve_file(Path(key): Path<String>) -> AppResult<Response> {
    let (client, bucket) = s3_client().await?;

    let out = client
        .get_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| {
            let se = e.into_service_error();
            if se.is_no_such_key() {
                AppError::NotFound
            } else {
                AppError::Internal(format!("get_object failed: {se}"))
            }
        })?;

    let content_type = out
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = out
        .body
        .collect()
        .await
        .map_err(|e| AppError::Internal(format!("read object failed: {e}")))?
        .into_bytes();

    Ok(([(header::CONTENT_TYPE, content_type)], bytes).into_response())
}

/// Map a MIME type to a file extension for the common image formats.
fn ext_from_content_type(ct: &str) -> Option<&'static str> {
    match ct.split(';').next().unwrap_or(ct).trim() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        "image/avif" => Some("avif"),
        "image/svg+xml" => Some("svg"),
        _ => None,
    }
}

/// Max accepted upload size. axum's default request body limit is 2 MB, which
/// is too small for photos; raise it to 32 MB for the upload route so 5-25 MB
/// files go through.
const MAX_UPLOAD_BYTES: usize = 32 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/items", get(list).post(create))
        .route("/items/{id}", axum::routing::put(update).delete(delete))
        .route(
            "/upload",
            axum::routing::post(upload)
                .layer(axum::extract::DefaultBodyLimit::max(MAX_UPLOAD_BYTES)),
        )
        .route("/files/{key}", get(serve_file))
}
