//! Shared foundation: configuration, application state, error type, tracing.

use std::sync::Arc;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// Process-wide configuration, read from the environment once at startup.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub bind_addr: String,
    pub jwt_secret: String,
    pub admin_password: String,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        let get = |k: &str| std::env::var(k).map_err(|_| AppError::Config(k.to_string()));
        Ok(Self {
            database_url: get("DATABASE_URL")?,
            redis_url: get("REDIS_URL")?,
            bind_addr: std::env::var("API_BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            jwt_secret: get("JWT_SECRET")?,
            admin_password: get("ADMIN_PASSWORD")?,
        })
    }
}

/// Cloneable state injected into every handler via `Router<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub redis: redis::aio::ConnectionManager,
    pub config: Arc<Config>,
}

/// Initialise structured logging from the `RUST_LOG` env filter.
pub fn init_tracing() {
    use tracing_subscriber::{fmt, prelude::*, EnvFilter};
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer())
        .init();
}

/// One error type for the whole backend; renders as a JSON body.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("missing configuration: {0}")]
    Config(String),
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("not found")]
    NotFound,
    #[error("unauthorized")]
    Unauthorized,
    #[error("{0}")]
    BadRequest(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Db(sqlx::Error::RowNotFound) => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(error = %self, "request failed");
        }
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}

/// Convenience alias used by handlers.
pub type AppResult<T> = Result<T, AppError>;
