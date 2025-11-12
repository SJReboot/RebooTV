// Prevents a new console window from
// opening on Windows in release,
// DON'T REMOVE!!
#![cfg_attr(
not(debug_assertions),
windows_subsystem = "windows"
)]

use serde_json::{json, Value};

// Learn more about Tauri commands at
// https://tauri.app/v1/guides/features/command
#[tauri::command]
fn get_playlists() -> Result<Value, String> {
    Ok(json!([]))
}

// From tauri.service.ts
#[tauri::command]
fn schedule_notification(payload: Value) -> Result<(), String> {
    Ok(())
}
// From settings.service.ts
#[tauri::command]
fn get_settings() -> Result<Value, String> {
    // Return a null JSON value to indicate no settings saved
    Ok(json!(null))
}
#[tauri::command]
fn save_settings(settings: Value) -> Result<(), String> {
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
fn add_playlist(playlist_data: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn update_playlist(playlist: Value) -> Result<Value, String> {
    Ok(json!(null))
}
#[tauri::command]
fn delete_playlist(id: Value) -> Result<(), String> {
    Ok(())
}
#[tauri::command]
fn update_playlist_active_status(id: Value, is_active: Value) -> Result<Value, String> {
    Ok(json!(null))
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
