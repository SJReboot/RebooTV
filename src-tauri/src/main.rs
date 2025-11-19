// Prevents a new console window from
// opening on Windows in release,
// DON'T REMOVE!!
#![cfg_attr(
    not(debug_assertions),
    windows_subsystem = "windows"
)]

use serde_json::{json, Value};
use rusqlite::{Result, Row};
use std::collections::HashMap;
use tauri::{Manager, Emitter};  
use tokio;
use reqwest::Client;
use quick_xml::de::from_reader;
use crc32fast;

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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    id: i64,
    name: String,
    url: String,
    r#type: String, 
    is_active: bool,
    status: String, 
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
    id: i64,
    title: String,
    description: Option<String>,
    start_time: String, 
    end_time: String,   
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Channel {
    id: i64,
    playlist_id: i64,
    name: String,
    logo_url: String,
    stream_url: String,
    epg: Vec<EpgEntry>, 
    category: String,
    category_id: Option<i64>,
    is_favorite: bool,
    is_hidden: bool,
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct FetchOptions {
    page: i64,
    page_size: i64,
    search_term: String,
    sort_by: String,
    sort_order: String, 
    filter: serde_json::Value, 
    show_hidden: Option<bool>,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PaginatedResponse<T> {
    items: Vec<T>,
    has_more: bool,
    total: i64,
}

// --- XMLTV STRUCTS (Updated for Fallback Support) ---
#[derive(serde::Deserialize, Debug)]
struct Tv {
    #[serde(rename = "channel", default)]
    channels: Vec<XmlChannelDef>, 
    #[serde(rename = "programme", default)]
    programmes: Vec<Programme>,
}

#[derive(serde::Deserialize, Debug)]
struct XmlChannelDef {
    #[serde(rename = "@id")]
    id: String,
    #[serde(rename = "display-name", default)]
    display_names: Vec<DisplayName>,
}

#[derive(serde::Deserialize, Debug)]
struct DisplayName {
    #[serde(rename = "$value", default)]
    value: String,
}

#[derive(serde::Deserialize, Debug)]
struct Programme {
    #[serde(rename = "@start")]
    start: String,
    #[serde(rename = "@stop")]
    stop: String,
    #[serde(rename = "@channel")]
    channel: String, 
    title: Title,
    desc: Option<Desc>,
}
#[derive(serde::Deserialize, Debug)]
struct Title {
    #[serde(rename = "$value", default)]
    value: String,
}
#[derive(serde::Deserialize, Debug)]
struct Desc {
    #[serde(rename = "$value", default)]
    value: String,
}

// --- Helper to sanitize names for fuzzy matching ---
fn sanitize_name(name: &str) -> String {
    let mut clean = name.to_lowercase();
    
    // 1. Remove content inside parens () and brackets []
    // Logic: Iterative removal of anything between ( and ) or [ and ]
    while let Some(start) = clean.find('(') {
        if let Some(end) = clean[start..].find(')') {
            clean.replace_range(start..start+end+1, "");
        } else { break; }
    }
    while let Some(start) = clean.find('[') {
        if let Some(end) = clean[start..].find(']') {
            clean.replace_range(start..start+end+1, "");
        } else { break; }
    }

    // 2. Remove specific quality suffixes
    // Note: Order matters (remove longer strings first)
    let removal_list = [
        "fhd", "uhd", "hevc", "h.265", "h265", "4k", "8k", 
        "hd", "sd", "50fps", "60fps", "vip", "ca:", "us:", "uk:"
    ];

    for keyword in removal_list {
        // We replace " fhd " with " " to avoid accidentally killing "thdr" -> "tr"
        // But simple approach: just remove occurrences.
        clean = clean.replace(keyword, "");
    }

    // 3. Keep only alphanumeric
    clean.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
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
    stream_id: serde_json::Value, 
    #[serde(default)] name: String,
    #[serde(default)] stream_icon: Option<String>,
    #[serde(default)] category_id: Option<String>,
    #[serde(default)] epg_channel_id: Option<String>,
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

fn get_playlist_by_id(conn: &rusqlite::Connection, id: i64) -> Option<Playlist> {
    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1").ok()?;
    stmt.query_row([id], map_row_to_playlist).ok()
}

fn get_db_connection(app: &tauri::AppHandle) -> Result<rusqlite::Connection, String> {
    let path = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())? 
        .join("rebootv.db");
    rusqlite::Connection::open(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn initialize_database(app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)", []).map_err(|e| e.to_string())?;

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

    let _ = conn.execute("ALTER TABLE channels ADD COLUMN sort_order INTEGER DEFAULT 0", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS channels (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id   INTEGER NOT NULL,
            name          TEXT NOT NULL,
            logo_url      TEXT,
            stream_url    TEXT NOT NULL,
            category      TEXT,
            category_id   INTEGER,
            epg_channel_id TEXT,
            is_favorite   BOOLEAN NOT NULL DEFAULT false,
            is_hidden     BOOLEAN NOT NULL DEFAULT false,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS epg_entries (
            id            INTEGER PRIMARY KEY, 
            channel_id    INTEGER NOT NULL,
            title         TEXT NOT NULL,
            description   TEXT,
            start_time    TEXT NOT NULL, 
            end_time      TEXT NOT NULL, 
            FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS recently_watched (
            channel_id    INTEGER PRIMARY KEY,
            last_watched  TEXT NOT NULL,
            FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| e.to_string())?;

    // --- NEW: INDICES FOR PERFORMANCE ---
    // This drastically speeds up 'DELETE FROM channels' because SQLite 
    // doesn't have to scan the whole epg table for every channel deletion.
    conn.execute("CREATE INDEX IF NOT EXISTS idx_epg_channel_id ON epg_entries(channel_id)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_epg_time ON epg_entries(start_time, end_time)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_channels_playlist_id ON channels(playlist_id)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_channels_category_id ON channels(category_id)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_categories_playlist_id ON categories(playlist_id)", []).map_err(|e| e.to_string())?;

    Ok(())
}


#[tauri::command]
fn get_playlists(app: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT * FROM playlists").map_err(|e| e.to_string())?;
    let playlists = stmt.query_map([], map_row_to_playlist)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Playlist>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(playlists)
}

#[tauri::command]
fn schedule_notification(_payload: Value) -> Result<(), String> { Ok(()) }

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<Option<AppSettings>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'app_settings'").map_err(|e| e.to_string())?;
    match stmt.query_row([], |row| row.get::<_, String>(0)) {
        Ok(json_value) => {
            let settings: AppSettings = serde_json::from_str(&json_value).map_err(|e| e.to_string())?;
            Ok(Some(settings))
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
fn save_settings(settings: AppSettings, app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    let json_value = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)", rusqlite::params![json_value]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn refresh_all_playlists(app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    let playlist_ids: Vec<i64> = conn.prepare("SELECT id FROM playlists WHERE is_active = true")
        .map_err(|e| e.to_string())?
        .query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
        .collect::<Result<Vec<i64>, _>>().map_err(|e| e.to_string())?;
    let mut handles = vec![];
    for id in playlist_ids {
        let app_clone = app.clone();
        handles.push(tokio::spawn(async move {
            let _ = refresh_playlist(id, app_clone).await;
        }));
    }
    for handle in handles { let _ = handle.await; }
    app.emit("refresh-complete", ()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_channels(options: FetchOptions, app: tauri::AppHandle) -> Result<PaginatedResponse<Channel>, String> {
    let conn = get_db_connection(&app)?;
    let page = options.page.max(1);
    let page_size = options.page_size;
    let offset = (page - 1) * page_size;
    
    // 1. Determine Filter Mode
    let mut is_favorites = false;
    let mut is_recently_watched = false;
    if let Some(obj) = options.filter.as_object() {
        if let Some(type_val) = obj.get("type") {
            match type_val.as_str() {
                Some("favorites") => is_favorites = true,
                Some("recently-watched") => is_recently_watched = true,
                _ => {}
            }
        }
    }

    let has_search = !options.search_term.is_empty();
    
    // 2. Prepare Base Filter Values (We extract these so we can rebuild params later)
    let show_hidden = options.show_hidden.unwrap_or(false);
    
    let mut category_filter_id: Option<i64> = None;
    
    // Category Logic (Only if NOT searching and NOT special views)
    if !has_search && !is_favorites && !is_recently_watched {
         if let Some(cat_id) = options.filter.as_i64() {
             category_filter_id = Some(cat_id);
         } 
         else if let Some(obj) = options.filter.as_object() {
            if let Some(val) = obj.get("categoryId") {
                if !val.is_null() {
                    if let Some(cat_id) = val.as_i64() {
                        category_filter_id = Some(cat_id);
                    }
                }
            }
        }
    }

    // 3. Build Base SQL String
    let mut base_where = Vec::new();
    if is_favorites { base_where.push("is_favorite = ?"); }
    base_where.push("is_hidden = ?");
    if category_filter_id.is_some() {
        base_where.push("(category_id = ? OR category = (SELECT name FROM categories WHERE id = ?))");
    }
    
    let base_where_sql = if base_where.is_empty() { String::new() } else { format!("WHERE {}", base_where.join(" AND ")) };

    // Helper to generate a fresh param vector matching base_where_sql
    // We cannot clone Box<dyn ToSql>, so we must reconstruct it.
    let get_base_params = || -> Vec<Box<dyn rusqlite::ToSql>> {
        let mut p: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if is_favorites { p.push(Box::new(true)); }
        p.push(Box::new(show_hidden));
        if let Some(cid) = category_filter_id {
            p.push(Box::new(cid));
            p.push(Box::new(cid));
        }
        p
    };

    // Variables for results
    let final_ids_for_page: Vec<i64>;
    let total_count: i64;

    if has_search {
        // --- SEARCH LOGIC (Deep Search) ---
        let search_pattern = format!("%{}%", options.search_term);
        let now = chrono::Utc::now().to_rfc3339();

        // Query A: Channels matching Name (Applied on top of base filters)
        let sql_a_where = if base_where_sql.is_empty() { "WHERE name LIKE ?".to_string() } else { format!("{} AND name LIKE ?", base_where_sql) };
        let sql_a = format!("SELECT id FROM channels {}", sql_a_where);
        
        // Query B: EPG Matches (Current Program)
        let sql_b = "SELECT DISTINCT channel_id FROM epg_entries WHERE title LIKE ? AND start_time <= ? AND end_time > ?";

        let mut all_valid_ids: Vec<i64> = Vec::new();

        // Run A (Name Match)
        let mut params_a = get_base_params(); // Fresh Params
        params_a.push(Box::new(search_pattern.clone())); // Add Search Param
        
        let mut stmt_a = conn.prepare(&sql_a).map_err(|e| e.to_string())?;
        let ids_a = stmt_a.query_map(rusqlite::params_from_iter(params_a.iter().map(|p| p.as_ref())), |row| row.get(0)).map_err(|e| e.to_string())?;
        for id in ids_a { all_valid_ids.push(id.unwrap_or(0)); }

        // Run B (EPG Match)
        let mut stmt_b = conn.prepare(sql_b).map_err(|e| e.to_string())?;
        let ids_b = stmt_b.query_map(rusqlite::params![search_pattern, now, now], |row| row.get(0)).map_err(|e| e.to_string())?;
        for id in ids_b { all_valid_ids.push(id.unwrap_or(0)); }

        // Deduplicate
        all_valid_ids.sort();
        all_valid_ids.dedup();

        // Verify base filters for EPG results
        // (Query B results didn't check hidden/favorites yet, we must verify them)
        if !all_valid_ids.is_empty() {
            let id_list = all_valid_ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");
            
            let verify_sql = format!("SELECT id FROM channels {} AND id IN ({})", 
                if base_where_sql.is_empty() { "WHERE 1=1".to_string() } else { base_where_sql.clone() }, 
                id_list
            );
            
            let mut stmt_verify = conn.prepare(&verify_sql).map_err(|e| e.to_string())?;
            let params_verify = get_base_params(); // Fresh Params for verification
            
            let verified_iter = stmt_verify.query_map(rusqlite::params_from_iter(params_verify.iter().map(|p| p.as_ref())), |row| row.get(0)).map_err(|e| e.to_string())?;
            
            all_valid_ids = verified_iter.filter_map(|r| r.ok()).collect();
        }

        total_count = all_valid_ids.len() as i64;

        // Manual Pagination in Memory
        let start = offset as usize;
        if start >= all_valid_ids.len() {
            final_ids_for_page = Vec::new();
        } else {
            let end = (start + page_size as usize).min(all_valid_ids.len());
            final_ids_for_page = all_valid_ids[start..end].to_vec();
        }

    } else {
        // --- BROWSE LOGIC (Standard) ---
        let table = if is_recently_watched { "channels c JOIN recently_watched rw ON c.id = rw.channel_id" } else { "channels c" };
        
        let order_sql = if is_recently_watched { 
            String::from("ORDER BY rw.last_watched DESC")
        } else { 
            let col = if options.sort_by == "name" { "c.name" } else { "c.sort_order" };
            let dir = if options.sort_order == "desc" { "DESC" } else { "ASC" };
            format!("ORDER BY {} {}", col, dir)
        };

        // 1. Count Total
        let params_count = get_base_params(); // Fresh Params
        let count_sql = format!("SELECT COUNT(*) FROM {} {}", table, base_where_sql);
        total_count = conn.query_row(&count_sql, rusqlite::params_from_iter(params_count.iter().map(|p| p.as_ref())), |row| row.get(0)).map_err(|e| e.to_string())?;
        
        // 2. Fetch Paginated IDs
        let mut params_fetch = get_base_params(); // Fresh Params
        params_fetch.push(Box::new(page_size));
        params_fetch.push(Box::new(offset));

        let fetch_sql = format!("SELECT c.id FROM {} {} {} LIMIT ? OFFSET ?", table, base_where_sql, order_sql);
        
        let mut stmt = conn.prepare(&fetch_sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params_fetch.iter().map(|p| p.as_ref())), |row| row.get(0)).map_err(|e| e.to_string())?;
        
        final_ids_for_page = rows.filter_map(|r| r.ok()).collect();
    }

    if final_ids_for_page.is_empty() {
        return Ok(PaginatedResponse { items: vec![], has_more: false, total: total_count });
    }

    // --- HYDRATION STEP (Fetch Details for IDs) ---
    let ids_params: Vec<rusqlite::types::Value> = final_ids_for_page.iter().map(|&id| id.into()).collect();
    let placeholders = final_ids_for_page.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // 1. Fetch EPG
    let mut epg_map: HashMap<i64, Vec<EpgEntry>> = HashMap::new();
    let epg_sql = format!("SELECT channel_id, id, title, description, start_time, end_time FROM epg_entries WHERE channel_id IN ({})", placeholders);
    let mut epg_stmt = conn.prepare(&epg_sql).map_err(|e| e.to_string())?;
    let epg_rows = epg_stmt.query_map(rusqlite::params_from_iter(ids_params.clone()), |row| {
        Ok((row.get::<_, i64>(0)?, EpgEntry { id: row.get(1)?, title: row.get(2)?, description: row.get(3)?, start_time: row.get(4)?, end_time: row.get(5)? }))
    }).map_err(|e| e.to_string())?;
    for row in epg_rows {
        if let Ok((cid, entry)) = row { epg_map.entry(cid).or_default().push(entry); }
    }

    // 2. Fetch Channels
    let chan_sql = format!("SELECT id, playlist_id, name, logo_url, stream_url, category, category_id, is_favorite, is_hidden FROM channels WHERE id IN ({})", placeholders);
    let mut final_stmt = conn.prepare(&chan_sql).map_err(|e| e.to_string())?;
    let mut channels: Vec<Channel> = final_stmt.query_map(rusqlite::params_from_iter(ids_params), |row| {
        let channel_id: i64 = row.get(0)?;
        Ok(Channel {
            id: channel_id, playlist_id: row.get(1)?, name: row.get(2)?, logo_url: row.get(3)?, stream_url: row.get(4)?,
            epg: epg_map.remove(&channel_id).unwrap_or_default(), category: row.get(5)?, category_id: row.get(6)?, is_favorite: row.get(7)?, is_hidden: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<Channel>, _>>().map_err(|e| e.to_string())?;

    // Restore Order
    let mut pos_map = HashMap::new();
    for (i, id) in final_ids_for_page.iter().enumerate() { pos_map.insert(*id, i); }
    channels.sort_by_key(|c| pos_map.get(&c.id).unwrap_or(&0));

    Ok(PaginatedResponse { items: channels, has_more: (page * page_size) < total_count, total: total_count })
}

#[tauri::command]
fn get_movies(_options: Value) -> Result<Value, String> { Ok(json!({ "items": [], "hasMore": false, "total": 0 })) }
#[tauri::command]
fn get_series(_options: Value) -> Result<Value, String> { Ok(json!({ "items": [], "hasMore": false, "total": 0 })) }
#[tauri::command]
fn get_seasons_for_series(_series_id: Value) -> Result<Value, String> { Ok(json!([])) }
#[tauri::command]
fn get_categories(app: tauri::AppHandle) -> Result<Vec<Category>, String> {
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT * FROM categories").map_err(|e| e.to_string())?;
    let categories = stmt.query_map([], map_row_to_category).map_err(|e| e.to_string())?.collect::<Result<Vec<Category>, _>>().map_err(|e| e.to_string())?;
    Ok(categories)
}
#[tauri::command]
fn add_playlist(playlist_data: NewPlaylistData, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute("INSERT INTO playlists (name, url, type, error_message, username, password, mac_address, max_connections, expiration_date, last_updated, status, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'inactive', true)",
        rusqlite::params![playlist_data.name, playlist_data.url, playlist_data.r#type, playlist_data.error_message, playlist_data.username, playlist_data.password, playlist_data.mac_address, playlist_data.max_connections, playlist_data.expiration_date, playlist_data.last_updated],
    ).map_err(|e| e.to_string())?;
    let new_id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1").map_err(|e| e.to_string())?;
    let new_playlist = stmt.query_row(rusqlite::params![new_id], map_row_to_playlist).map_err(|e| e.to_string())?;
    Ok(new_playlist)
}
#[tauri::command]
fn update_playlist(playlist: Playlist, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute("UPDATE playlists SET name = ?1, url = ?2, type = ?3, is_active = ?4, status = ?5, error_message = ?6, username = ?7, password = ?8, mac_address = ?9, max_connections = ?10, expiration_date = ?11, last_updated = ?12 WHERE id = ?13",
        rusqlite::params![playlist.name, playlist.url, playlist.r#type, playlist.is_active, playlist.status, playlist.error_message, playlist.username, playlist.password, playlist.mac_address, playlist.max_connections, playlist.expiration_date, playlist.last_updated, playlist.id],
    ).map_err(|e| e.to_string())?;
    Ok(playlist) 
}
#[tauri::command]
fn delete_playlist(id: i64, app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn update_playlist_active_status(id: i64, is_active: bool, app: tauri::AppHandle) -> Result<Playlist, String> {
    let conn = get_db_connection(&app)?;
    conn.execute("UPDATE playlists SET is_active = ?1 WHERE id = ?2", rusqlite::params![is_active, id]).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1").map_err(|e| e.to_string())?;
    let updated_playlist = stmt.query_row(rusqlite::params![id], map_row_to_playlist).map_err(|e| e.to_string())?;
    Ok(updated_playlist)
}

#[tauri::command]
async fn refresh_playlist(playlist_id: i64, app: tauri::AppHandle) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    println!("[DEBUG] Starting refresh for playlist ID: {}", playlist_id);

    let mut conn = get_db_connection(&app)?;
    
    let (base_url, username, password) = conn.query_row(
        "SELECT url, username, password FROM playlists WHERE id = ?1",
        [playlist_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, Option<String>>(2)?))
    ).map_err(|e| e.to_string())?;

    let (username, password) = match (username, password) {
        (Some(u), Some(p)) => (u.trim().to_string(), p.trim().to_string()),
        _ => return Err("Missing credentials".to_string()),
    };

    // --- PRESERVE STATE (Favorites & Hidden) ---
    let mut existing_state: HashMap<i64, (bool, bool)> = HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, is_favorite, is_hidden FROM channels WHERE playlist_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([playlist_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, bool>(1)?, row.get::<_, bool>(2)?))
        }).map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok((id, fav, hid)) = row { existing_state.insert(id, (fav, hid)); }
        }
    }

    // --- NEW: PRESERVE HISTORY (Recently Watched) ---
    let mut recent_history: Vec<(i64, String)> = Vec::new();
    {
        // We collect history for channels belonging to this playlist (via join or check)
        // Since IDs are unique per line, we can just grab them all and filter on re-insert, 
        // or simplified: grab all history. Since we delete channels for THIS playlist, 
        // only history for THIS playlist is at risk of cascade delete.
        // To be safe, we just grab all. 
        let mut stmt = conn.prepare("SELECT channel_id, last_watched FROM recently_watched").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?))).map_err(|e| e.to_string())?;
        for row in rows { if let Ok(pair) = row { recent_history.push(pair); } }
    }
    
    update_playlist_status(&conn, playlist_id, "loading", None)?;
    let _ = app.emit("playlist-update", get_playlist_by_id(&conn, playlist_id).unwrap_or_default()); 

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(120)) 
        .build()
        .map_err(|e| e.to_string())?;

    let mut clean_url = base_url.trim().to_string();
    if clean_url.ends_with("player_api.php") { clean_url = clean_url.replace("player_api.php", ""); }
    if !clean_url.ends_with('/') { clean_url.push('/'); }
    let player_api_url = format!("{}player_api.php?username={}&password={}", clean_url, username, password);

    let categories_url = format!("{}&action=get_live_categories", player_api_url);
    println!("[DEBUG] Fetching Categories...");
    let categories = match client.get(&categories_url).send().await {
        Ok(resp) => resp.json::<Vec<XtreamCategory>>().await.map_err(|e| e.to_string())?,
        Err(e) => return Err(e.to_string()),
    };

    let streams_url = format!("{}&action=get_live_streams", player_api_url);
    println!("[DEBUG] Fetching Streams...");
    let stream_response = match client.get(&streams_url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            update_playlist_status(&conn, playlist_id, "error", Some(e.to_string()))?;
            let _ = app.emit("playlist-update", get_playlist_by_id(&conn, playlist_id).unwrap_or_default());
            return Err(e.to_string());
        }
    };
    let streams = match stream_response.json::<Vec<XtreamLiveStream>>().await {
        Ok(s) => s,
        Err(e) => {
            println!("[ERROR] Stream JSON Parse Failed: {}", e);
            return Err(format!("Stream JSON Error: {}", e));
        }
    };
    println!("[DEBUG] Parsed {} streams. Starting Transaction...", streams.len());

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories WHERE playlist_id = ?1", [playlist_id]).map_err(|e| e.to_string())?;
    // This DELETE triggers the CASCADE on recently_watched
    tx.execute("DELETE FROM channels WHERE playlist_id = ?1", [playlist_id]).map_err(|e| e.to_string())?;

    { 
        let mut cat_stmt = tx.prepare("INSERT INTO categories (playlist_id, name, is_hidden) VALUES (?1, ?2, false)").map_err(|e| e.to_string())?;
        for cat in &categories {
            cat_stmt.execute(rusqlite::params![playlist_id, cat.category_name]).map_err(|e| e.to_string())?;
        }
    } 

    let mut inserted_count = 0;
    {
        let mut chan_stmt = tx.prepare(
            "INSERT OR REPLACE INTO channels (playlist_id, id, name, logo_url, stream_url, category_id, category, epg_channel_id, is_favorite, is_hidden, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
        ).map_err(|e| e.to_string())?;
        
        for (index, stream) in streams.iter().enumerate() {
            let final_stream_id = match &stream.stream_id {
                serde_json::Value::Number(n) => n.as_i64().unwrap_or(0),
                serde_json::Value::String(s) => s.parse::<i64>().unwrap_or(0),
                _ => 0,
            };
            if final_stream_id == 0 { continue; }
            let cat_id_str = stream.category_id.as_deref().unwrap_or("0");
            let category_name = categories.iter().find(|c| c.category_id == cat_id_str).map_or("Uncategorized", |c| &c.category_name);
            let stream_url = format!("{}{}/{}/{}", clean_url, username, password, final_stream_id);

            // Restore state
            let (is_fav, is_hid) = existing_state.get(&final_stream_id).copied().unwrap_or((false, false));
            
            if let Err(e) = chan_stmt.execute(rusqlite::params![
                playlist_id, final_stream_id, stream.name, stream.stream_icon, stream_url, Option::<i64>::None, category_name, stream.epg_channel_id.as_deref(),
                is_fav, is_hid, index as i64 
            ]) {
                println!("[ERROR] Failed to insert channel {}: {}", stream.name, e);
                continue; 
            }
            inserted_count += 1;
            if inserted_count % 500 == 0 { println!("[DEBUG] Inserted {}/{} channels...", inserted_count, streams.len()); }
        }
    } 

    // --- NEW: RESTORE HISTORY ---
    {
        let mut hist_stmt = tx.prepare("INSERT OR IGNORE INTO recently_watched (channel_id, last_watched) VALUES (?1, ?2)").map_err(|e| e.to_string())?;
        for (chan_id, ts) in recent_history {
            // If the channel was removed by the provider, this insert will be ignored (due to FK violation? 
            // No, OR IGNORE handles uniqueness, but FK might still error if not careful. 
            // Actually, sqlite ON DELETE CASCADE removes rows, but here we inserted new channels.
            // If chan_id exists in channels table, this succeeds. If not, it fails FK constraint.
            // To be perfectly safe, we just let it try.
            let _ = hist_stmt.execute(rusqlite::params![chan_id, ts]); 
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    update_playlist_status(&conn, playlist_id, "active", None)?;
    let _ = app.emit("playlist-update", get_playlist_by_id(&conn, playlist_id).unwrap_or_default());
    println!("[DEBUG] SUCCESS! Playlist refresh complete. Total Time: {:.2?}", start_time.elapsed());
    Ok(())
}

#[tauri::command]
fn toggle_category_visibility(id: i64, app: tauri::AppHandle) -> Result<Category, String> {
    let conn = get_db_connection(&app)?;
    let is_hidden: bool = conn.query_row("SELECT is_hidden FROM categories WHERE id = ?1", [id], |row| row.get(0)).map_err(|e| e.to_string())?;
    conn.execute("UPDATE categories SET is_hidden = ?1 WHERE id = ?2", rusqlite::params![!is_hidden, id]).map_err(|e| e.to_string())?;
    let updated_category = conn.query_row("SELECT * FROM categories WHERE id = ?1", rusqlite::params![id], map_row_to_category).map_err(|e| e.to_string())?;
    Ok(updated_category)
}

#[tauri::command]
fn batch_update_category_visibility(ids: Vec<i64>, is_hidden: bool, app: tauri::AppHandle) -> Result<Vec<Category>, String> {
    let conn = get_db_connection(&app)?;
    if ids.is_empty() { return Ok(vec![]); }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!("UPDATE categories SET is_hidden = ?1 WHERE id IN ({})", placeholders);
    let mut params: Vec<rusqlite::types::Value> = vec![is_hidden.into()];
    params.extend(ids.iter().map(|&id| id.into()));
    conn.execute(&sql, rusqlite::params_from_iter(params)).map_err(|e| e.to_string())?;
    let fetch_sql = format!("SELECT * FROM categories WHERE id IN ({})", placeholders);
    let select_params: Vec<rusqlite::types::Value> = ids.iter().map(|&id| id.into()).collect();
    let mut stmt = conn.prepare(&fetch_sql).map_err(|e| e.to_string())?;
    let categories = stmt.query_map(rusqlite::params_from_iter(select_params), map_row_to_category).map_err(|e| e.to_string())?.collect::<Result<Vec<Category>, _>>().map_err(|e| e.to_string())?;
    Ok(categories)
}

fn fetch_single_channel(conn: &rusqlite::Connection, id: i64) -> Result<Channel, String> {
    let mut stmt = conn.prepare("SELECT id, playlist_id, name, logo_url, stream_url, category, category_id, is_favorite, is_hidden FROM channels WHERE id = ?1").map_err(|e| e.to_string())?;
    let channel_tuple = stmt.query_row([id], |row| {
        Ok((
            row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?,
            row.get::<_, String>(5)?, row.get::<_, Option<i64>>(6)?, row.get::<_, bool>(7)?, row.get::<_, bool>(8)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut epg_final = Vec::new();
    let mut epg_stmt_safe = conn.prepare("SELECT id, title, description, start_time, end_time FROM epg_entries WHERE channel_id = ?1").map_err(|e| e.to_string())?;
    let rows = epg_stmt_safe.query_map([id], |row| {
        Ok(EpgEntry { id: row.get(0)?, title: row.get(1)?, description: row.get(2)?, start_time: row.get(3)?, end_time: row.get(4)? })
    }).map_err(|e| e.to_string())?;
    for r in rows { if let Ok(entry) = r { epg_final.push(entry); } }

    Ok(Channel {
        id: channel_tuple.0, playlist_id: channel_tuple.1, name: channel_tuple.2, logo_url: channel_tuple.3, stream_url: channel_tuple.4,
        epg: epg_final, category: channel_tuple.5, category_id: channel_tuple.6, is_favorite: channel_tuple.7, is_hidden: channel_tuple.8,
    })
}

#[tauri::command]
fn toggle_channel_favorite(id: i64, app: tauri::AppHandle) -> Result<Channel, String> {
    let conn = get_db_connection(&app)?;
    conn.execute("UPDATE channels SET is_favorite = NOT is_favorite WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    fetch_single_channel(&conn, id)
}

#[tauri::command]
fn toggle_channel_visibility(id: i64, app: tauri::AppHandle) -> Result<Channel, String> {
    let conn = get_db_connection(&app)?;
    conn.execute("UPDATE channels SET is_hidden = NOT is_hidden WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    fetch_single_channel(&conn, id)
}

#[tauri::command]
fn batch_update_channel_visibility(ids: Vec<i64>, is_hidden: bool, app: tauri::AppHandle) -> Result<Vec<Channel>, String> {
    let conn = get_db_connection(&app)?;
    if ids.is_empty() { return Ok(vec![]); }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!("UPDATE channels SET is_hidden = ?1 WHERE id IN ({})", placeholders);
    let mut params: Vec<rusqlite::types::Value> = vec![is_hidden.into()];
    params.extend(ids.iter().map(|&id| id.into()));
    conn.execute(&sql, rusqlite::params_from_iter(params)).map_err(|e| e.to_string())?;
    Ok(vec![]) 
}

#[tauri::command]
fn batch_update_channel_favorite_status(ids: Vec<i64>, is_favorite: bool, app: tauri::AppHandle) -> Result<Vec<Channel>, String> {
    let conn = get_db_connection(&app)?;
    if ids.is_empty() { return Ok(vec![]); }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!("UPDATE channels SET is_favorite = ?1 WHERE id IN ({})", placeholders);
    let mut params: Vec<rusqlite::types::Value> = vec![is_favorite.into()];
    params.extend(ids.iter().map(|&id| id.into()));
    conn.execute(&sql, rusqlite::params_from_iter(params)).map_err(|e| e.to_string())?;
    Ok(vec![])
}

#[tauri::command]
fn add_to_recently_watched(channel_id: i64, app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    let now = chrono::Utc::now().to_rfc3339();
    
    // 1. Upsert the record (Insert or Update timestamp)
    conn.execute(
        "INSERT OR REPLACE INTO recently_watched (channel_id, last_watched) VALUES (?1, ?2)",
        rusqlite::params![channel_id, now],
    ).map_err(|e| e.to_string())?;

    // 2. Prune: Keep only top 15
    conn.execute(
        "DELETE FROM recently_watched WHERE channel_id NOT IN (
            SELECT channel_id FROM recently_watched ORDER BY last_watched DESC LIMIT 15
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
#[tauri::command]
#[allow(unused_variables)]
fn toggle_vod_watchlist(id: Value, r#type: Value) -> Result<Value, String> { Ok(json!(null)) }
#[tauri::command]
#[allow(unused_variables)]
fn toggle_vod_favorite(id: Value, r#type: Value) -> Result<Value, String> { Ok(json!(null)) }

#[tauri::command]
fn play_stream(url: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    
    println!("[Player] Attempting to play: {}", url);

    // "mpv" matches the binary name, NOT the path in tauri.conf.json
    let _child = app.shell().sidecar("mpv")
        .map_err(|e| format!("Failed to find sidecar: {}", e))? 
        .args([
            "--force-window",   // Open window immediately (don't wait for buffer)
            "--geometry=60%",   // Sets window width to 60% of screen (maintains aspect ratio)
            &url                // The stream URL
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch MPV: {}", e))?;

    Ok(())
}

fn convert_to_iso(xmltv_date: &str) -> String {
    // Helper to force UTC
    let to_utc = |dt: chrono::DateTime<chrono::FixedOffset>| -> String {
        dt.with_timezone(&chrono::Utc).to_rfc3339()
    };

    // Try format with space: "20241118120000 +0000"
    if let Ok(dt) = chrono::DateTime::parse_from_str(xmltv_date, "%Y%m%d%H%M%S %z") {
        return to_utc(dt);
    }
    // Try format without space: "20241118120000+0000"
    if let Ok(dt) = chrono::DateTime::parse_from_str(xmltv_date, "%Y%m%d%H%M%S%z") {
        return to_utc(dt);
    }
    // Fallback: Assume UTC if no timezone provided
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(xmltv_date, "%Y%m%d%H%M%S") {
        return dt.and_utc().to_rfc3339();
    }
    
    xmltv_date.to_string()
}

// --- UPDATED: EPG with Waterfall Fallback ---
#[tauri::command]
async fn refresh_epg(app: tauri::AppHandle) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    println!("[EPG] Starting EPG Refresh...");

    let mut conn = get_db_connection(&app)?;
    let playlists_creds = conn.prepare("SELECT id, url, username, password FROM playlists WHERE is_active = true AND type = 'xtream'").map_err(|e| e.to_string())?
        .query_map([], |row| { Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?, row.get::<_, Option<String>>(3)?)) }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<(i64, String, Option<String>, Option<String>)>, _>>().map_err(|e| e.to_string())?;

    let client = Client::new();
    conn.execute("DELETE FROM epg_entries", []).map_err(|e| e.to_string())?;

    for (playlist_id, base_url, username_opt, password_opt) in playlists_creds {
        let (username, password) = match (username_opt, password_opt) {
            (Some(u), Some(p)) => (u, p),
            _ => continue, 
        };

        // --- CHANGED: Maps now hold a VECTOR of IDs (One-to-Many) ---
        // 1. Build MAP 1: API ID -> List of DB IDs
        let mut epg_id_map: HashMap<String, Vec<i64>> = HashMap::new();
        // 2. Build MAP 2: Sanitized Name -> List of DB IDs
        let mut name_map: HashMap<String, Vec<i64>> = HashMap::new();

        { 
            let mut stmt = conn.prepare("SELECT id, epg_channel_id, name FROM channels WHERE playlist_id = ?1").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([playlist_id], |row| {
                let chan_id: i64 = row.get(0)?;
                let epg_id: Option<String> = row.get(1)?;
                let name: String = row.get(2)?;
                Ok((chan_id, epg_id, name))
            }).map_err(|e| e.to_string())?;

            for row in rows {
                if let Ok((chan_id, epg_id, name)) = row {
                    if let Some(eid) = epg_id { 
                        epg_id_map.entry(eid).or_default().push(chan_id); 
                    }
                    name_map.entry(sanitize_name(&name)).or_default().push(chan_id);
                }
            }
        } 

        println!("[EPG] Playlist {}: Mapped IDs for {} distinct EPG codes and {} distinct names.", playlist_id, epg_id_map.len(), name_map.len());

        let mut clean_url = base_url.trim().to_string();
        if clean_url.ends_with("player_api.php") { clean_url = clean_url.replace("player_api.php", ""); }
        if !clean_url.ends_with('/') { clean_url.push('/'); }
        let epg_url = format!("{}xmltv.php?username={}&password={}", clean_url, username, password);
        println!("[EPG] Fetching XML: {}", epg_url);

        let epg_xml_bytes = match client.get(&epg_url).send().await {
            Ok(resp) => resp.bytes().await.map_err(|e| e.to_string())?,
            Err(e) => { println!("[EPG] Network Error: {}", e); continue; }, 
        };

        let tv_data: Tv = match from_reader(epg_xml_bytes.as_ref()) {
            Ok(data) => data,
            Err(e) => { println!("[EPG] XML Parse Error: {}", e); continue; }, 
        };

        // 3. Build MAP 3: XML ID -> Sanitized Display Name
        let mut xml_alias_map: HashMap<String, String> = HashMap::new();
        for chan_def in tv_data.channels {
            if let Some(first_name) = chan_def.display_names.first() {
                xml_alias_map.insert(chan_def.id, sanitize_name(&first_name.value));
            }
        }

        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let mut match_count = 0;
        let mut name_match_count = 0;

        {
            let mut epg_stmt = tx.prepare(
                "INSERT OR IGNORE INTO epg_entries (id, channel_id, title, description, start_time, end_time)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
            ).map_err(|e| e.to_string())?;

            for programme in tv_data.programmes {
                // --- WATERFALL MATCHING STRATEGY (MULTI-TARGET) ---
                
                // 1. Try finding targets by ID
                let targets_by_id = epg_id_map.get(&programme.channel);
                
                // 2. Try finding targets by Name
                let targets_by_name = if let Some(sanitized_xml_name) = xml_alias_map.get(&programme.channel) {
                    name_map.get(sanitized_xml_name)
                } else { None };

                // 3. Combine them (Prioritize ID, fallback to Name)
                let final_targets = match (targets_by_id, targets_by_name) {
                    (Some(ids), _) => Some(ids), // ID Match takes precedence
                    (None, Some(names)) => {
                        name_match_count += 1;
                        Some(names) // Fallback to Name match
                    },
                    (None, None) => None
                };

                if let Some(target_ids) = final_targets {
                    let iso_start = convert_to_iso(&programme.start);
                    let iso_stop = convert_to_iso(&programme.stop);

                    // Loop through ALL matched channels (SD, HD, FHD) and insert for each
                    for &internal_channel_id in target_ids {
                        match_count += 1;
                        // We need a unique ID for the entry row, but it must be unique per channel_id
                        let entry_id = format!("{}-{}-{}", internal_channel_id, programme.start, programme.title.value);
                        let entry_hash_id = i64::from(crc32fast::hash(entry_id.as_bytes()));
                        
                        epg_stmt.execute(rusqlite::params![
                            entry_hash_id,
                            internal_channel_id,
                            programme.title.value,
                            programme.desc.as_ref().map(|d| &d.value), // Fixed .as_ref() borrow issue
                            iso_start, 
                            iso_stop   
                        ]).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        println!("[EPG] Matched and inserted {} programs ({} via Name Fallback).", match_count, name_match_count);
    }
    
    println!("[EPG] Refresh Complete. Time: {:.2?}", start_time.elapsed());
    app.emit("epg-complete", ()).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
    .plugin(tauri_plugin_shell::init()) 
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
        play_stream,
        refresh_epg
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}