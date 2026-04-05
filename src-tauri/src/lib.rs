use std::collections::BTreeMap;
use std::sync::Mutex;

mod updater;
mod utils;
mod terminal;
mod runner;

pub use terminal::{init_pty, resize_pty, pty_write, MultiPtyState};
pub use runner::{
    RunnerState, RunnerRuntimeState, ProjectCandidate, DotnetRequest, DotnetOnceRequest,
    ToolCheck, SyncAssetRequest, copy_alias_exe_and_config, run_sql_setup_if_needed,
    pick_project_folder, pick_file, discover_projects, dotnet_once, dotnet_rebuild,
    dotnet_run_start, dotnet_run_stop, dotnet_run_is_running, deploy_project_config,
    fetch_project_config, sync_asset, get_hostname, run_sql_only, prepare_sql_temp_file,
    prepare_batch_temp_file, open_file, check_environment, check_sql_connection,
};
pub use utils::{CommandResult, normalize_path, normalize_input_path, validate_startup_abs,
    new_command, run_capture, get_build_config, build_default_config_template,
    collect_source_fingerprint, project_source_fingerprint, collect_project_files,
    top_group_root, get_receive_batch_action, is_looks_like_batch_code, get_hostname_impl,
    CREATE_NO_WINDOW};

mod backlog_auth;
pub use crate::backlog_auth::{get_backlog_auth_url, backlog_oauth_exchange, backlog_oauth_refresh, get_backlog_config};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::collections::HashMap;
    use tauri::{Emitter, Manager};
    
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("[single-instance] App reopened with args: {:?}", argv);
            
            for arg in argv {
                if arg.starts_with("bsn-isync://") {
                    println!("[single-instance] Deep-link URL found: {}", arg);
                    let _ = app.emit("deep-link", vec![arg.clone()]);
                }
            }
            
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .manage(runner::RunnerState(Mutex::new(runner::RunnerRuntimeState {
            child: None,
            fingerprints: BTreeMap::new(),
            temp_files: Vec::new(),
        })))
        .manage(terminal::MultiPtyState(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            init_pty,
            resize_pty,
            pty_write,
            pick_project_folder,
            pick_file,
            discover_projects,
            dotnet_once,
            dotnet_rebuild,
            dotnet_run_start,
            dotnet_run_stop,
            dotnet_run_is_running,
            sync_asset,
            get_backlog_config,
            get_backlog_auth_url,
            get_hostname,
            backlog_oauth_exchange,
            backlog_oauth_refresh,
            run_sql_only,
            prepare_sql_temp_file,
            check_sql_connection,
            prepare_batch_temp_file,
            open_file,
            deploy_project_config,
            fetch_project_config,
            check_environment,
            updater::check_update,
            updater::download_and_install_update,
            updater::restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
