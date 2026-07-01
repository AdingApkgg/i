// `sqlx::migrate!` embeds the migrations dir at COMPILE time. Without this,
// adding a new migration file does NOT recompile this crate, so the embedded
// set goes stale and new migrations silently never run. Tell cargo to rebuild
// this crate whenever the workspace `migrations/` directory changes.
fn main() {
    println!("cargo:rerun-if-changed=../../migrations");
}
