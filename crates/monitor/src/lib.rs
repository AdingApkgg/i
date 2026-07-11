//! Self-implemented uptime monitor. Admin-configured targets live in the shared
//! `monitors` table (from 0001_init.sql). CRUD is admin-guarded.
//!
//! A tokio background scheduler ([`run_scheduler`]) probes every enabled target
//! on a fixed tick (~30s) and persists one row per check into `monitor_checks`
//! (0009). The public `/status` endpoint reads the LATEST check per target
//! instead of live-probing.

use appcore::{AppError, AppResult, AppState};
use auth::AdminClaims;
use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::time::Duration;
use utoipa::ToSchema;
use uuid::Uuid;

/// How often the scheduler probes all enabled targets.
const TICK: Duration = Duration::from_secs(30);
/// Per-probe timeout for both HTTP and TCP checks.
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Target {
    pub id: Uuid,
    pub name: String,
    pub target: String,
    pub kind: String,
    pub interval_sec: i32,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertTarget {
    pub name: String,
    pub target: String,
    pub kind: String,
    pub interval_sec: i32,
    pub enabled: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatusItem {
    pub id: Uuid,
    pub name: String,
    pub target: String,
    pub ok: bool,
    pub status_code: Option<i32>,
    pub latency_ms: Option<i32>,
    pub checked_at: Option<DateTime<Utc>>,
}

/// Row shape for the latest-check-per-target query backing `/status`.
#[derive(FromRow)]
struct StatusRow {
    id: Uuid,
    name: String,
    target: String,
    ok: Option<bool>,
    status_code: Option<i32>,
    latency_ms: Option<i32>,
    checked_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    status: Option<String>,
}

#[utoipa::path(
    get, path = "/api/monitor/items",
    params(("status" = Option<String>, Query, description = "filter by kind/status")),
    responses((status = 200, body = Vec<Target>))
)]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Target>>> {
    let rows = sqlx::query_as::<_, Target>(
        "SELECT * FROM monitors WHERE ($1::text IS NULL OR kind = $1) ORDER BY created_at DESC",
    )
    .bind(q.status)
    .fetch_all(&st.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post, path = "/api/monitor/items", request_body = UpsertTarget,
    responses((status = 200, body = Target), (status = 401))
)]
pub async fn create(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Json(b): Json<UpsertTarget>,
) -> AppResult<Json<Target>> {
    let row = sqlx::query_as::<_, Target>(
        "INSERT INTO monitors (id, name, target, kind, interval_sec, enabled)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(b.name)
    .bind(b.target)
    .bind(b.kind)
    .bind(b.interval_sec)
    .bind(b.enabled)
    .fetch_one(&st.db)
    .await?;
    Ok(Json(row))
}

#[utoipa::path(
    put, path = "/api/monitor/items/{id}", request_body = UpsertTarget,
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Target), (status = 401), (status = 404))
)]
pub async fn update(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(b): Json<UpsertTarget>,
) -> AppResult<Json<Target>> {
    let row = sqlx::query_as::<_, Target>(
        "UPDATE monitors SET name = $2, target = $3, kind = $4, interval_sec = $5,
            enabled = $6
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(b.name)
    .bind(b.target)
    .bind(b.kind)
    .bind(b.interval_sec)
    .bind(b.enabled)
    .fetch_optional(&st.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

#[utoipa::path(
    delete, path = "/api/monitor/items/{id}", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 401), (status = 404))
)]
pub async fn delete(
    _admin: AdminClaims,
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    let r = sqlx::query("DELETE FROM monitors WHERE id = $1")
        .bind(id)
        .execute(&st.db)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/monitor/status",
    responses((status = 200, body = Vec<StatusItem>))
)]
pub async fn status(State(st): State<AppState>) -> AppResult<Json<Vec<StatusItem>>> {
    // Latest check per enabled target via LEFT JOIN LATERAL. Targets with no
    // check yet come back with NULL check columns -> ok=false / nulls.
    let rows = sqlx::query_as::<_, StatusRow>(
        "SELECT m.id, m.name, m.target,
                c.ok, c.status_code, c.latency_ms, c.checked_at
           FROM monitors m
           LEFT JOIN LATERAL (
                SELECT ok, status_code, latency_ms, checked_at
                  FROM monitor_checks
                 WHERE monitor_id = m.id
                 ORDER BY checked_at DESC
                 LIMIT 1
           ) c ON true
          WHERE m.enabled = true
          ORDER BY m.created_at DESC",
    )
    .fetch_all(&st.db)
    .await?;

    let items = rows
        .into_iter()
        .map(|r| StatusItem {
            id: r.id,
            name: r.name,
            target: r.target,
            ok: r.ok.unwrap_or(false),
            status_code: r.status_code,
            latency_ms: r.latency_ms,
            checked_at: r.checked_at,
        })
        .collect();
    Ok(Json(items))
}

/// A probe outcome for one target.
struct Probe {
    ok: bool,
    status_code: Option<i32>,
    latency_ms: i32,
}

/// Probe a single target. HTTP: GET, ok on 2xx/3xx. TCP: connect to host:port,
/// ok if the connection succeeds. Any error / timeout -> ok=false.
async fn probe(client: &reqwest::Client, t: &Target) -> Probe {
    let started = std::time::Instant::now();
    let (ok, status_code) = match t.kind.as_str() {
        "http" => match client.get(&t.target).send().await {
            Ok(r) => {
                let code = r.status().as_u16() as i32;
                let ok = r.status().is_success() || r.status().is_redirection();
                (ok, Some(code))
            }
            Err(_) => (false, None),
        },
        "tcp" => {
            // Expect host:port; strip an optional scheme prefix for tolerance.
            let addr = t
                .target
                .trim()
                .rsplit("://")
                .next()
                .unwrap_or(t.target.as_str());
            let connected =
                match tokio::time::timeout(PROBE_TIMEOUT, tokio::net::TcpStream::connect(addr))
                    .await
                {
                    Ok(Ok(_)) => true,
                    _ => false,
                };
            (connected, None)
        }
        other => {
            tracing::warn!(kind = other, target = %t.target, "monitor: unknown kind, marking down");
            (false, None)
        }
    };
    let latency_ms = started.elapsed().as_millis().min(i32::MAX as u128) as i32;
    Probe {
        ok,
        status_code,
        latency_ms,
    }
}

/// Background uptime scheduler: every [`TICK`], probe all enabled targets and
/// persist one `monitor_checks` row each. Never panics or exits the loop;
/// per-tick and per-target errors are logged and swallowed.
pub async fn run_scheduler(state: AppState) {
    let client = match reqwest::Client::builder().timeout(PROBE_TIMEOUT).build() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, "monitor: failed to build reqwest client; scheduler disabled");
            return;
        }
    };

    let mut ticker = tokio::time::interval(TICK);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        ticker.tick().await;

        let targets = match sqlx::query_as::<_, Target>(
            "SELECT * FROM monitors WHERE enabled = true",
        )
        .fetch_all(&state.db)
        .await
        {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(error = %e, "monitor: failed to load targets this tick");
                continue;
            }
        };

        for t in &targets {
            let p = probe(&client, t).await;
            if let Err(e) = sqlx::query(
                "INSERT INTO monitor_checks (id, monitor_id, ok, status_code, latency_ms)
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(Uuid::new_v4())
            .bind(t.id)
            .bind(p.ok)
            .bind(p.status_code)
            .bind(p.latency_ms)
            .execute(&state.db)
            .await
            {
                tracing::error!(error = %e, target = %t.target, "monitor: failed to persist check");
            }
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/items", get(list).post(create))
        .route("/items/{id}", axum::routing::put(update).delete(delete))
        .route("/status", get(status))
}
