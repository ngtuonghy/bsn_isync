use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<String>, String> {
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => Ok(Some(update.version.clone())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    let update_opt = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    
    if let Some(update) = update_opt {
        update
            .download_and_install(
                |_chunk_length, _content_length| {
                },
                || {
                },
            )
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}
