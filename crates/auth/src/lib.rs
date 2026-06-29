//! Rust-owned authentication. The personal space is single-admin, so for now
//! "auth" is: log in with the admin password, get a JWT, present it as a
//! `Bearer` token on protected (admin) routes.
//!
//! `AdminClaims` is an extractor — adding it to a handler's arguments makes
//! that route require a valid admin token.

use appcore::{AppError, AppState};
use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use axum::routing::post;
use axum::{Json, Router};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

/// Marker extracted from a verified admin token.
pub struct AdminClaims(pub Claims);

impl FromRequestParts<AppState> for AdminClaims {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(AppError::Unauthorized)?;

        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Unauthorized)?;

        Ok(AdminClaims(data.claims))
    }
}

#[derive(Deserialize, ToSchema)]
pub struct LoginReq {
    pub password: String,
}

#[derive(Serialize, ToSchema)]
pub struct LoginResp {
    pub token: String,
}

#[utoipa::path(
    post, path = "/api/auth/login", request_body = LoginReq,
    responses((status = 200, body = LoginResp), (status = 401, description = "wrong password"))
)]
pub async fn login(
    state: axum::extract::State<AppState>,
    Json(req): Json<LoginReq>,
) -> Result<Json<LoginResp>, AppError> {
    if req.password != state.config.admin_password {
        return Err(AppError::Unauthorized);
    }
    let exp = (chrono::Utc::now() + chrono::Duration::days(7)).timestamp() as usize;
    let claims = Claims {
        sub: "admin".to_string(),
        exp,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(LoginResp { token }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/login", post(login))
}
