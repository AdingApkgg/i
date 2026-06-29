//! The single backend binary. It owns nothing domain-specific itself — it
//! loads config, opens the shared resources (Postgres + Redis), then mounts
//! each domain crate's router under `/api/<domain>`.
//!
//! Adding a new content area is: new crate -> one `.nest(...)` line here +
//! (optionally) add its `#[utoipa::path]` handlers to `ApiDoc`.
//!
//! `cargo run -p api -- --openapi` prints the OpenAPI spec and exits (no DB
//! needed) — used to generate the typed front-end client.

use std::sync::Arc;

use appcore::{AppState, Config};
use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;

/// Aggregated OpenAPI document. New documented endpoints get added to
/// `paths(...)` and their DTOs to `components(schemas(...))`.
#[derive(OpenApi)]
#[openapi(
    info(title = "i API", version = "0.0.0", description = "Personal space API"),
    paths(
        auth::login,
        analytics::count,
        blog::list_published,
        blog::get_by_slug,
        blog::create,
        blog::update,
        blog::delete,
        music::list,
        music::create,
        music::update,
        music::delete,
        gal::list,
        gal::create,
        gal::update,
        gal::delete,
    ),
    components(schemas(
        auth::LoginReq,
        auth::LoginResp,
        analytics::CountResp,
        blog::Post,
        blog::UpsertPost,
        music::Track,
        music::UpsertTrack,
        gal::Vn,
        gal::UpsertVn,
    ))
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // `--openapi`: dump the spec and exit, without touching the DB.
    if std::env::args().any(|a| a == "--openapi") {
        println!("{}", ApiDoc::openapi().to_pretty_json()?);
        return Ok(());
    }

    appcore::init_tracing();
    let config = Config::from_env()?;

    let db = db::connect(&config.database_url).await?;
    db::migrate(&db).await?;
    tracing::info!("migrations applied");

    let redis_client = redis::Client::open(config.redis_url.as_str())?;
    let redis = redis::aio::ConnectionManager::new(redis_client).await?;

    let bind_addr = config.bind_addr.clone();
    let state = AppState {
        db,
        redis,
        config: Arc::new(config),
    };

    let openapi_spec = ApiDoc::openapi().to_json()?;

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route(
            "/openapi.json",
            get(move || {
                let spec = openapi_spec.clone();
                async move {
                    (
                        [(axum::http::header::CONTENT_TYPE, "application/json")],
                        spec,
                    )
                }
            }),
        )
        .nest("/api/auth", auth::router())
        .nest("/api/analytics", analytics::router())
        .nest("/api/blog", blog::router())
        .nest("/api/music", music::router())
        .nest("/api/gal", gal::router())
        .nest("/api/movie", movie::router())
        .nest("/api/touhou", touhou::router())
        .nest("/api/device", device::router())
        .nest("/api/comments", comments::router())
        .nest("/api/monitor", monitor::router())
        .nest("/api/maimai", maimai::router())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("listening on http://{bind_addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn root() -> Json<Value> {
    Json(json!({ "name": "i", "ok": true }))
}

async fn health(State(st): State<AppState>) -> Json<Value> {
    let db_ok = sqlx::query("SELECT 1").execute(&st.db).await.is_ok();

    let mut redis = st.redis.clone();
    let redis_ok = redis::cmd("PING")
        .query_async::<String>(&mut redis)
        .await
        .map(|p| p == "PONG")
        .unwrap_or(false);

    Json(json!({ "db": db_ok, "redis": redis_ok }))
}
