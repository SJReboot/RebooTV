// Prevents a new console window from
// opening on Windows in release,
// DON'T REMOVE!!
#![cfg_attr(
not(debug_assertions),
windows_subsystem = "windows"
)]

use serde_json::{json, Value};
use tauri::api::path::app_data_dir;
use rusqlite::{Result, Row};
use std::collections::HashMap;
use tauri::api::process::Command;
use tokio;
use reqwest::Client;

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

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Category {
    id: i64,
    playlist_id: i64,
    name: String,
    is_hidden: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct EpgEntry {
    id: i64, // Based on TypeScript 'number'
    title: String,
    description: Option<String>,
    start_time: String, // ISO string
    end_time: String,   // ISO string
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Channel {
    id: i64,
    playlist_id: i64,
    name: String,
    logo_url: String,
    stream_url: String,
    epg: Vec<EpgEntry>, // This will be populated by our smart query
    category: String,
    category_id: i64,
    is_favorite: bool,
    is_hidden: bool,
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct FetchOptions {
    page: i64,
    page_size: i64,
    search_term: String,
    sort_by: String,
    sort_order: String, // "asc" | "desc"
    filter: serde_json::Value, // Will be complex JSON
    show_hidden: Option<bool>,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PaginatedResponse<T> {
    items: Vec<T>,
    has_more: bool,
    total: i64,
}

fn map_row_to_epg_entry(row: &Row) -> Result<EpgEntry> {
    Ok(EpgEntry {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        start_time: row.get(3)?,
        end_time: row.get(4)?,
    })
}

fn map_row_to_category(row: &Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        playlist_id: row.get(1)?,
        name: row.get(2)?,
        is_hidden: row.get(3)?,
    })
}

#[derive(serde::Deserialize, Debug)]
struct XtreamCategory {
    category_id: String,
    category_name: String,
}
#[derive(serde::Deserialize, Debug)]
struct XtreamLiveStream {
    stream_id: i64,
    name: String,
    stream_icon: String,
    category_id: String,
    // This field is often a string, but we'll parse it
    epg_channel_id: Option<String>,
}

fn update_playlist_status(conn: &rusqlite::Connection, playlist_id: i64, status: &str, error_message: Option<String>) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE playlists SET status = ?1, last_updated = ?2, error_message = ?3 WHERE id = ?4",
        rusqlite::params![status, now, error_message, playlist_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
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

    // --- ADD THIS ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id   INTEGER NOT NULL,
            name          TEXT NOT NULL,
            is_hidden     BOOLEAN NOT NULL DEFAULT false,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| e.to_string())?;
    // ---

    // --- ADD THIS ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS channels (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id   INTEGER NOT NULL,
            name          TEXT NOT NULL,
            logo_url      TEXT,
            stream_url    TEXT NOT NULL,
            category      TEXT,
            category_id   INTEGER,
            is_favorite   BOOLEAN NOT NULL DEFAULT false,
            is_hidden     BOOLEAN NOT NULL DEFAULT false,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS epg_entries (
            id            INTEGER PRIMARY KEY, -- From provider
            channel_id    INTEGER NOT NULL,
            title         TEXT NOT NULL,
            description   TEXT,
            start_time    TEXT NOT NULL, -- ISO 8601 string
            end_time      TEXT NOT NULL, -- ISO 8601 string
            FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
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
async fn refresh_all_playlists(app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    let playlist_ids: Vec<i64> = conn.prepare("SELECT id FROM playlists WHERE is_active = true").map_err(|e| e.to_string())?
        .query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
        .collect::<Result<Vec<i64>, _>>().map_err(|e| e.to_string())?;
    for id in playlist_ids {
        let app_clone = app.clone();
        // We spawn a new task for each refresh so they can run in parallel
        // We ignore the result, as the function updates the status in the DB
        tokio::spawn(async move {
            let _ = refresh_playlist(id, app_clone).await;
        });
    }
    Ok(())
}
#[tauri::command]
fn get_channels(options: FetchOptions, app: tauri::AppHandle) -> Result<PaginatedResponse<Channel>, String> {
    let conn = get_db_connection(&app)?;

    // For now, we will implement simple pagination.
    // We will ignore filter/search/sort for this task.
    let page = options.page.max(1);
    let page_size = options.page_size;
    let offset = (page - 1) * page_size;

    // 1. Get the total count of channels
    let total_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM channels",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // 2. Get the paginated list of channels
    let mut stmt = conn.prepare(
        "SELECT id, playlist_id, name, logo_url, stream_url, category, category_id, is_favorite, is_hidden
         FROM channels LIMIT ?1 OFFSET ?2"
    ).map_err(|e| e.to_string())?;

    let channel_ids: Vec<i64> = stmt.query_map(rusqlite::params![page_size, offset], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|e| e.to_string())?;

    if channel_ids.is_empty() {
        return Ok(PaginatedResponse {
            items: vec![],
            has_more: false,
            total: total_items,
        });
    }

    // 3. Get all EPG entries for *only* the channels on this page
    let ids_params: Vec<rusqlite::types::Value> = channel_ids.iter().map(|&id| id.into()).collect();
    let mut epg_map: HashMap<i64, Vec<EpgEntry>> = HashMap::new();

    let epg_sql = format!(
        "SELECT channel_id, id, title, description, start_time, end_time
         FROM epg_entries WHERE channel_id IN ({})",
        channel_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",")
    );

    let mut epg_stmt = conn.prepare(&epg_sql).map_err(|e| e.to_string())?;
    let epg_rows = epg_stmt.query_map(rusqlite::params_from_iter(ids_params.clone()), |row| {
        let channel_id: i64 = row.get(0)?;
        let epg_entry = EpgEntry {
            id: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
        };
        Ok((channel_id, epg_entry))
    }).map_err(|e| e.to_string())?;

    for row in epg_rows {
        let (channel_id, epg_entry) = row.map_err(|e| e.to_string())?;
        epg_map.entry(channel_id).or_default().push(epg_entry);
    }

    // 4. Re-fetch channels and combine them with their EPG data
    let channel_sql = format!(
        "SELECT id, playlist_id, name, logo_url, stream_url, category, category_id, is_favorite, is_hidden
         FROM channels WHERE id IN ({})",
        channel_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",")
    );
    let mut final_stmt = conn.prepare(&channel_sql).map_err(|e| e.to_string())?;

    let channels_with_epg = final_stmt.query_map(rusqlite::params_from_iter(ids_params), |row| {
        let channel_id: i64 = row.get(0)?;
        Ok(Channel {
            id: channel_id,
            playlist_id: row.get(1)?,
            name: row.get(2)?,
            logo_url: row.get(3)?,
            stream_url: row.get(4)?,
            epg: epg_map.remove(&channel_id).unwrap_or_default(), // Attach EPG data
            category: row.get(5)?,
            category_id: row.get(6)?,
            is_favorite: row.get(7)?,
            is_hidden: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<Channel>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(PaginatedResponse {
        items: channels_with_epg,
        has_more: (page * page_size) < total_items,
        total: total_items,
    })
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
fn get_categories(app: tauri::AppHandle) -> Result<Vec<Category>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT * FROM categories")
        .map_err(|e| e.to_string())?;

    let categories = stmt.query_map([], map_row_to_category)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Category>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
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
async fn refresh_playlist(playlist_id: i64, app: tauri::AppHandle) -> Result<(), String> {
    let mut conn = get_db_connection(&app)?;
    // 1. Get playlist credentials from DB
    let (base_url, username, password) = conn.query_row(
        "SELECT url, username, password FROM playlists WHERE id = ?1",
        [playlist_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, Option<String>>(2)?))
    ).map_err(|e| e.to_string())?;
    let (username, password) = match (username, password) {
        (Some(u), Some(p)) => (u, p),
        _ => return Err("Playlist is missing username or password".to_string()),
    };
    // Set status to "loading"
    update_playlist_status(&conn, playlist_id, "loading", None)?;
    let client = Client::new();
    let player_api_url = format!("{}player_api.php?username={}&password={}", base_url, username, password);
    // 2. Fetch Categories
    let categories_url = format!("{}&action=get_live_categories", player_api_url);
    let categories = match client.get(&categories_url).send().await {
        Ok(resp) => resp.json::<Vec<XtreamCategory>>().await.map_err(|e| e.to_string())?,
        Err(e) => {
            update_playlist_status(&conn, playlist_id, "error", Some(e.to_string()))?;
            return Err(e.to_string());
        }
    };
    // 3. Fetch Live Streams
    let streams_url = format!("{}&action=get_live_streams", player_api_url);
    let streams = match client.get(&streams_url).send().await {
        Ok(resp) => resp.json::<Vec<XtreamLiveStream>>().await.map_err(|e| e.to_string())?,
        Err(e) => {
            update_playlist_status(&conn, playlist_id, "error", Some(e.to_string()))?;
            return Err(e.to_string());
        }
    };
    // 4. Start a database transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 5. Clear old data for this playlist
    tx.execute("DELETE FROM categories WHERE playlist_id = ?1", [playlist_id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM channels WHERE playlist_id = ?1", [playlist_id]).map_err(|e| e.to_string())?;
    // 6. Insert new categories
    { // Block to limit scope of prepared statement
        let mut cat_stmt = tx.prepare("INSERT INTO categories (playlist_id, name, is_hidden) VALUES (?1, ?2, false)").map_err(|e| e.to_string())?;
        for cat in &categories {
            cat_stmt.execute(rusqlite::params![playlist_id, cat.category_name]).map_err(|e| e.to_string())?;
        }
    } // cat_stmt is dropped here
    // 7. Insert new channels
    {
        let mut chan_stmt = tx.prepare(
            "INSERT INTO channels (playlist_id, id, name, logo_url, stream_url, category_id, category, is_favorite, is_hidden)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, false, false)"
        ).map_err(|e| e.to_string())?;
        for stream in &streams {
            let category_id_num = stream.category_id.parse::<i64>().unwrap_or(-1);
            let category_name = categories.iter()
                .find(|c| c.category_id == stream.category_id)
                .map_or("Uncategorized", |c| &c.category_name);

            let stream_url = format!("{}{}/{}/{}", base_url, username, password, stream.stream_id);
            chan_stmt.execute(rusqlite::params![
                playlist_id,
                stream.stream_id,
                stream.name,
                stream.stream_icon,
                stream_url,
                category_id_num,
                category_name
            ]).map_err(|e| e.to_string())?;
        }
    } // chan_stmt is dropped here
    // 8. Commit the transaction
    tx.commit().map_err(|e| e.to_string())?;
    // 9. Set status to "active"
    update_playlist_status(&conn, playlist_id, "active", None)?;
    Ok(())
}
#[tauri::command]
fn toggle_category_visibility(id: i64, app: tauri::AppHandle) -> Result<Category, String> {
    let conn = get_db_connection(&app)?;

    // First, get the current hidden status
    let is_hidden: bool = conn.query_row(
        "SELECT is_hidden FROM categories WHERE id = ?1",
        [id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // Toggle it
    let new_is_hidden = !is_hidden;
    conn.execute(
        "UPDATE categories SET is_hidden = ?1 WHERE id = ?2",
        rusqlite::params![new_is_hidden, id],
    ).map_err(|e| e.to_string())?;

    // Fetch and return the updated category
    let mut stmt = conn.prepare("SELECT * FROM categories WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let updated_category = stmt.query_row(rusqlite::params![id], map_row_to_category)
        .map_err(|e| e.to_string())?;

    Ok(updated_category)
}
#[tauri::command]
fn batch_update_category_visibility(ids: Vec<i64>, is_hidden: bool, app: tauri::AppHandle) -> Result<Vec<Category>, String> {
    let conn = get_db_connection(&app)?;

    // Convert Vec<i64> to a format rusqlite can use in a query
    let ids_params: Vec<rusqlite::types::Value> = ids.iter().map(|&id| id.into()).collect();

    conn.execute(
        &format!(
            "UPDATE categories SET is_hidden = ?1 WHERE id IN ({})",
            ids.iter().map(|_| "?").collect::<Vec<_>>().join(",")
        ),
        rusqlite::params_from_iter(std::iter::once(is_hidden.into()).chain(ids_params)),
    ).map_err(|e| e.to_string())?;

    // Fetch and return all updated categories
    let mut stmt = conn.prepare(
        &format!(
            "SELECT * FROM categories WHERE id IN ({})",
            ids.iter().map(|_| "?").collect::<Vec<_>>().join(",")
        )
    ).map_err(|e| e.to_string())?;

    let categories = stmt.query_map(
            rusqlite::params_from_iter(ids.iter().map(|&id| id as i64)),
            map_row_to_category
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Category>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}
#[tauri::command]
fn toggle_channel_favorite(id: i64, app: tauri::AppHandle) -> Result<Channel, String> {
    // TODO: Implement real logic
    Err("Not implemented".to_string())
}
#[tauri::command]
fn add_to_recently_watched(channel_id: i64, app: tauri::AppHandle) -> Result<(), String> {
    // TODO: Implement real logic
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
fn toggle_channel_visibility(id: i64, app: tauri::AppHandle) -> Result<Channel, String> {
    // TODO: Implement real logic
    Err("Not implemented".to_string())
}
#[tauri::command]
fn batch_update_channel_visibility(ids: Vec<i64>, is_hidden: bool, app: tauri::AppHandle) -> Result<Vec<Channel>, String> {
    // TODO: Implement real logic
    Ok(vec![])
}
#[tauri::command]
fn batch_update_channel_favorite_status(ids: Vec<i64>, is_favorite: bool, app: tauri::AppHandle) -> Result<Vec<Channel>, String> {
    // TODO: Implement real logic
    Ok(vec![])
}

#[tauri::command]
fn play_stream(url: String, app: tauri::AppHandle) -> Result<(), String> {
    // "mpv" is the name of the binary *without* the .exe extension
    // Tauri's sidecar API finds it based on the `externalBin` config.
    let _child = Command::new_sidecar("mpv")
        .map_err(|e| e.to_string())?
        .args([url]) // Pass the URL as an argument to mpv
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
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
    batch_update_channel_favorite_status,
    play_stream
])
.run(tauri::generate_context!())
.expect("error while running tauri application");
}
