// Prevents a new console window from
// opening on Windows in release,
// DON'T REMOVE!!
#![cfg_attr(
not(debug_assertions),
windows_subsystem = "windows"
)]

// Learn more about Tauri commands at
// https://tauri.app/v1/guides/features/command
#[tauri::command]
fn get_playlists() -> Result<Vec<String>, ()> {
Ok(Vec::new())
}

#[tauri::command]
fn save_settings(settings: String) -> Result<(), String> {
Ok(())
}

fn main() {
tauri::Builder::default()
.invoke_handler(tauri::generate_handler![
get_playlists,
save_settings
])
.run(tauri::generate_context!())
.expect("error while running tauri application");
}
