// Prevents a new console window from
// opening on Windows in release,
// DON'T REMOVE!!
#![cfg_attr(
not(debug_assertions),
windows_subsystem = "windows"
)]

use serde_json::{json, Value};
use tauri::api::path::app_data_dir;
use rusqlite::Row;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    default_view: String,
    refresh_on_start: bool,
    minimize_to_tray: bool,
    exit_to_tray: bool,
    mpv_params: String,
    start_volume: u32,
    hw_accel: bool,
    buffer_size: String,
    epg_time_offset: i32,
    epg_refresh_frequency: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    id: i64,
    name: String,
    url: String,
    r#type: String, // "xtream", "m3u", "stalker"
    is_active: bool,
    status: String, // "active", "inactive", "loading", "error"
    error_message: Option<String>,
    username: Option<String>,
    password: Option<String>,
    mac_address: Option<String>,
    max_connections: Option<i64>,
    expiration_date: Option<String>,
    last_updated: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct NewPlaylistData {
    name: String,
    url: String,
    r#type: String,
    error_message: Option<String>,
    username: Option<String>,
    password: Option<String>,
    mac_address: Option<String>,
    max_connections: Option<i64>,
    expiration_date: Option<String>,
    last_updated: Option<String>,
}

fn map_row_to_playlist(row: &Row) -> rusqlite::Result<Playlist> {
    Ok(Playlist {
        id: row.get(0)?,
        name: row.get(1)?,
        url: row.get(2)?,
        r#type: row.get(3)?,
        is_active: row.get(4)?,
        status: row.get(5)?,
        error_message: row.get(6)?,
        username: row.get(7)?,
        password: row.get(8)?,
        mac_address: row.get(9)?,
        max_connections: row.get(10)?,
        expiration_date: row.get(11)?,
        last_updated: row.get(12)?,
    })
}

// (This function goes outside of `main`)
fn get_db_connection(app: &tauri::AppHandle) -> Result<rusqlite::Connection, String> {
    let config = app.config();
    let path = app_data_dir(&config)
        .ok_or_else(|| "Failed to get app data directory".to_string())?
        .join("rebootv.db");
    rusqlite::Connection::open(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn initialize_database(app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    // (Keep the settings table creation)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key     TEXT PRIMARY KEY,
            value   TEXT
        )",
        [],
    ).map_err(|e| e.to_string())?;

    // --- ADD THIS ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            name              TEXT NOT NULL,
            url               TEXT NOT NULL,
            type              TEXT NOT NULL,
            is_active         BOOLEAN NOT NULL DEFAULT true,
            status            TEXT NOT NULL DEFAULT 'inactive',
            error_message     TEXT,
            username          TEXT,
            password          TEXT,
            mac_address       TEXT,
            max_connections   INTEGER,
            expiration_date   TEXT,
            last_updated      TEXT
        )",
        [],
    ).map_err(|e| e.to_string())?;
    // ---
    Ok(())
}

// Learn more about Tauri commands at
// https://tauri.app/v1/guides/features/command
#[tauri::command]
fn get_playlists(app: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT * FROM playlists")
        .map_err(|e| e.to_string())?;

    let playlists = stmt.query_map([], map_row_to_playlist)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Playlist>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(playlists)
}

// From tauri.service.ts
#[tauri::command]
fn schedule_notification(payload: Value) -> Result<(), String> {
    Ok(())
}
// From settings.service.ts
#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<Option<AppSettings>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'app_settings'")
        .map_err(|e| e.to_string())?;

    match stmt.query_row([], |row| row.get::<_, String>(0)) {
        Ok(json_value) => {
            let settings: AppSettings = serde_json::from_str(&json_value)
                .map_err(|e| e.to_string())?;
            Ok(Some(settings))
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
fn save_settings(settings: AppSettings, app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    let json_value = serde_json::to_string(&settings)
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)",
        rusqlite::params![json_value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
// From iptv.service.ts
#[tauri::command]
fn refresh_all_playlists() -> Result<(), String> {
    Ok(())
}
#[tauri::command]
fn get_channels(options: Value) -> Result<Value, String> {
    Ok(json!({ "items": [], "hasMore": false, "total": 0 }))
}
#[tauri::command]
fn get_movies(options: Value) -> Result<Value, String> {
    Ok(json!({ "items": [], "hasMore": false, "total": 0 }))
}
#[tauri::command]
fn get_series(options: Value) -> Result<Value, String> {
    Ok(json!({ "items": [], "hasMore": false, "total": 0 }))
}
#[tauri::command]
fn get_seasons_for_series(series_id: Value) -> Result<Value, String> {
    Ok(json!([]))
}
#[tauri::command]
fn get_categories() -> Result<Value, String> {
    Ok(json!([]))
}
#[tauri::command]
fn add_playlist(playlist_data: NewPlaylistData, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT INTO playlists (name, url, type, error_message, username, password, mac_address, max_connections, expiration_date, last_updated, status, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'inactive', true)",
        rusqlite::params![
            playlist_data.name,
            playlist_data.url,
            playlist_data.r#type,
            playlist_data.error_message,
            playlist_data.username,
            playlist_data.password,
            playlist_data.mac_address,
            playlist_data.max_connections,
            playlist_data.expiration_date,
            playlist_data.last_updated
        ],
    ).map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();

    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let new_playlist = stmt.query_row(rusqlite::params![new_id], map_row_to_playlist)
        .map_err(|e| e.to_string())?;

    Ok(new_playlist)
}
#[tauri::command]
fn update_playlist(playlist: Playlist, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "UPDATE playlists SET
         name = ?1, url = ?2, type = ?3, is_active = ?4, status = ?5, error_message = ?6, username = ?7,
         password = ?8, mac_address = ?9, max_connections = ?10, expiration_date = ?11, last_updated = ?12
         WHERE id = ?13",
        rusqlite::params![
            playlist.name, playlist.url, playlist.r#type, playlist.is_active, playlist.status,
            playlist.error_message, playlist.username, playlist.password, playlist.mac_address,
            playlist.max_connections, playlist.expiration_date, playlist.last_updated, playlist.id
        ],
    ).map_err(|e| e.to_string())?;

    Ok(playlist) // Return the same playlist back
}
#[tauri::command]
fn delete_playlist(id: i64, app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn update_playlist_active_status(id: i64, is_active: bool, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "UPDATE playlists SET is_active = ?1 WHERE id = ?2",
        rusqlite::params![is_active, id],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let updated_playlist = stmt.query_row(rusqlite::params![id], map_row_to_playlist)
        .map_err(|e| e.to_string())?;

    Ok(updated_playlist)
}
#[tauri::command]
fn refresh_playlist(id: Value) -> Result<(), String> {
    Ok(())
}
#[tauri::command]
fn toggle_category_visibility(id: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn batch_update_category_visibility(ids: Value, is_hidden: Value) -> Result<Value, String> {
     Ok(json!([]))
}
#[tauri::command]
fn toggle_channel_favorite(id: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn add_to_recently_watched(channel_id: Value) -> Result<(), String> {
    Ok(())
}
#[tauri::command]
fn toggle_vod_watchlist(id: Value, r#type: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn toggle_vod_favorite(id: Value, r#type: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn toggle_channel_visibility(id: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn batch_update_channel_visibility(ids: Value, is_hidden: Value) -> Result<Value, String> {
    Ok(json!([]))
}
#[tauri::command]
fn batch_update_channel_favorite_status(ids: Value, is_favorite: Value) -> Result<Value, String> {
    Ok(json!([]))
}

fn main() {
tauri::Builder::default()
.invoke_handler(tauri::generate_handler![
    initialize_database,
    get_playlists,
    schedule_notification,
    get_settings,
    save_settings,
    refresh_all_playlists,
    get_channels,
    get_movies,
    get_series,
    get_seasons_for_series,
    get_categories,
    add_playlist,
    update_playlist,
    delete_playlist,
    update_playlist_active_status,
    refresh_playlist,
    toggle_category_visibility,
    batch_update_category_visibility,
    toggle_channel_favorite,
    add_to_recently_watched,
    toggle_vod_watchlist,
    toggle_vod_favorite,
    toggle_channel_visibility,
    batch_update_channel_visibility,
    batch_update_channel_favorite_status
])
.run(tauri::generate_context!())
.expect("error while running tauri application");
}
