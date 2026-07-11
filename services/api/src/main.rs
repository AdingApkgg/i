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
use axum::http::HeaderValue;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
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
        movie::list,
        movie::create,
        movie::update,
        movie::delete,
        touhou::list,
        touhou::create,
        touhou::update,
        touhou::delete,
        device::list,
        device::create,
        device::update,
        device::delete,
        anime::list,
        anime::create,
        anime::update,
        anime::delete,
        moments::list,
        moments::create,
        moments::update,
        moments::delete,
        gallery::list,
        gallery::create,
        gallery::update,
        gallery::delete,
        friends::list,
        friends::create,
        friends::update,
        friends::delete,
        monitor::list,
        monitor::create,
        monitor::update,
        monitor::delete,
        monitor::status,
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
        movie::Movie,
        movie::UpsertMovie,
        touhou::Work,
        touhou::UpsertWork,
        device::Device,
        device::UpsertDevice,
        anime::Anime,
        anime::UpsertAnime,
        moments::Moment,
        moments::UpsertMoment,
        gallery::Photo,
        gallery::UpsertPhoto,
        friends::Friend,
        friends::UpsertFriend,
        monitor::Target,
        monitor::UpsertTarget,
        monitor::StatusItem,
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

    // Background uptime monitor: probes enabled targets on a 30s schedule and
    // records each result in monitor_checks. GET /api/monitor/status reads the
    // latest check per target (no live probing on the request path).
    tokio::spawn(monitor::run_scheduler(state.clone()));

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
        .nest("/api/anime", anime::router())
        .nest("/api/moments", moments::router())
        .nest("/api/gallery", gallery::router())
        .nest("/api/friends", friends::router())
        .nest("/api/comments", comments::router())
        .nest("/api/monitor", monitor::router())
        .nest("/api/maimai", maimai::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("listening on http://{bind_addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

/// CORS policy. Same-origin deploys (web + api behind one nginx) don't need CORS
/// at all, so this only matters for cross-origin callers.
///
/// `CORS_ALLOWED_ORIGINS` — a comma-separated allow-list (e.g.
/// `https://i.example.com,https://www.example.com`) locks responses to those
/// origins. Left unset (dev) it stays permissive so `localhost:3000/3001` and
/// tooling can call `:8080` freely. Set it before going public.
fn cors_layer() -> CorsLayer {
    match std::env::var("CORS_ALLOWED_ORIGINS") {
        Ok(raw) if !raw.trim().is_empty() => {
            let origins: Vec<HeaderValue> = raw
                .split(',')
                .filter_map(|s| {
                    let s = s.trim();
                    match s.parse::<HeaderValue>() {
                        Ok(v) => Some(v),
                        Err(_) => {
                            tracing::warn!(origin = s, "CORS: ignoring invalid origin");
                            None
                        }
                    }
                })
                .collect();
            tracing::info!(count = origins.len(), "CORS: restricting to allow-list");
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods(Any)
                .allow_headers(Any)
        }
        _ => {
            tracing::info!("CORS: permissive (set CORS_ALLOWED_ORIGINS to restrict)");
            CorsLayer::permissive()
        }
    }
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
