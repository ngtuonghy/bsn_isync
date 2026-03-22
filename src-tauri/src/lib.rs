use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, State, Manager};
use tauri_plugin_dialog::DialogExt;

mod updater;

struct RunnerRuntimeState {
    child: Option<Child>,
    fingerprints: BTreeMap<String, u64>,
}

struct RunnerState(Mutex<RunnerRuntimeState>);

use std::collections::HashMap;

struct MultiPtyState(Mutex<HashMap<String, (Box<dyn portable_pty::MasterPty + Send>, Box<dyn Write + Send>)>>);

#[derive(Serialize, Clone)]
struct PtyOutput {
    id: String,
    data: String,
}

#[tauri::command]
fn init_pty(app: AppHandle, state: State<MultiPtyState>, id: String, root: String, rows: u16, cols: u16) -> Result<(), String> {
    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system.openpty(portable_pty::PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let pty_id_for_thread = id.clone();
    let mut cmd = portable_pty::CommandBuilder::new("powershell.exe");
    cmd.cwd(&root);
    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    thread::spawn(move || {
        use std::io::Read;
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let text = String::from_utf8_lossy(&buf[0..n]).into_owned();
                    let _ = app.emit("pty-out", PtyOutput { id: pty_id_for_thread.clone(), data: text });
                }
                _ => break,
            }
        }
    });

    let mut guard = state.0.lock().unwrap();
    guard.insert(id, (pair.master, writer));
    Ok(())
}

#[tauri::command]
fn resize_pty(state: State<MultiPtyState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some((master, _)) = guard.get_mut(&id) {
        let _ = master.resize(portable_pty::PtySize { rows, cols, pixel_width: 0, pixel_height: 0 });
    }
    Ok(())
}

#[tauri::command]
fn pty_write(state: State<MultiPtyState>, id: String, data: String) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some((_, writer)) = guard.get_mut(&id) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize)]
struct CommandResult {
    code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Serialize)]
struct ProjectCandidate {
    name: String,
    root: String,
    startup_project: String,
    sln_count: usize,
    csproj_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DotnetRequest {
    project_root: String,
    startup_project: String,
    build_config: Option<String>,
    alias_exe_name: Option<String>,
    bat_file_path: Option<String>,
    target: Option<String>,
    config_template: Option<String>,
    run_args: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DotnetOnceRequest {
    mode: String,
    project_root: String,
    startup_project: String,
    build_config: Option<String>,
    alias_exe_name: Option<String>,
    config_template: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncAssetRequest {
    source: String,
    project_root: String,
    dest: String,
    include: Option<String>,
    exclude: Option<String>,
    dry_run: bool,
}

#[derive(Serialize, Deserialize)]
struct BacklogOAuthToken {
    access_token: String,
    token_type: String,
    expires_in: u64,
    refresh_token: String,
}

fn normalize_base_url(host: &str) -> Result<String, String> {
    let trimmed = host.trim();
    if trimmed.is_empty() {
        return Err("BACKLOG_HOST chưa được cấu hình".to_string());
    }
    let mut base = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{}", trimmed)
    };
    while base.ends_with('/') {
        base.pop();
    }
    Ok(base)
}

#[tauri::command]
fn backlog_oauth_exchange(code: String) -> Result<BacklogOAuthToken, String> {
    let host = env::var("BACKLOG_HOST").unwrap_or_default();
    let client_id = env::var("BACKLOG_CLIENT_ID").unwrap_or_default();
    let client_secret = env::var("BACKLOG_CLIENT_SECRET").unwrap_or_default();
    let redirect_uri = env::var("BACKLOG_REDIRECT_URI").unwrap_or_default();

    if host.trim().is_empty() {
        return Err("Thiếu BACKLOG_HOST".to_string());
    }
    if client_id.trim().is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_ID".to_string());
    }
    if client_secret.trim().is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_SECRET".to_string());
    }
    if redirect_uri.trim().is_empty() {
        return Err("Thiếu BACKLOG_REDIRECT_URI".to_string());
    }

    let base_url = normalize_base_url(&host)?;
    let client = reqwest::blocking::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
    ];

    let res = client
        .post(format!("{}/api/v2/oauth2/token", base_url))
        .form(&params)
        .send()
        .map_err(|e| format!("Không gọi được token endpoint: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().unwrap_or_default();
        return Err(format!(
            "Không lấy được token ({}). {}",
            status,
            text
        ));
    }

    let token = res
        .json::<BacklogOAuthToken>()
        .map_err(|e| format!("Không parse được token: {e}"))?;
    Ok(token)
}

fn normalize_path(path: &Path) -> String {
    let mut s = path.to_string_lossy().replace('/', "\\");
    if s.starts_with(r#"\\?\"#) {
        s = s[4..].to_string();
    }
    s
}

fn normalize_input_path(path: &str) -> PathBuf {
    let mut s = path.replace('/', "\\");
    if s.starts_with(r#"\\?\"#) {
        s = s[4..].to_string();
    }
    PathBuf::from(s)
}

fn validate_startup_abs(root: &Path, startup_rel: &str) -> Result<PathBuf, String> {
    // Hotfix cho các profile cũ bị lưu dính lỗi `?\` ở đầu
    let mut clean_rel = startup_rel.replace("?\\", "");
    if clean_rel.starts_with(r#"\\?\"#) {
        clean_rel = clean_rel[4..].to_string();
    }
    let startup_abs = root.join(&clean_rel);
    let root_canon = fs::canonicalize(root).map_err(|e| format!("Project root không hợp lệ: {e}"))?;
    let startup_canon = fs::canonicalize(&startup_abs).map_err(|e| format!("Startup project không tồn tại: {e}\n(Path: {})", clean_rel))?;
    if !startup_canon.starts_with(&root_canon) {
        return Err("Startup project nằm ngoài project root".to_string());
    }
    let s = startup_canon.to_string_lossy().to_string();
    if s.starts_with(r#"\\?\"#) {
        Ok(PathBuf::from(&s[4..]))
    } else {
        Ok(startup_canon)
    }
}

fn run_capture(mut cmd: Command) -> Result<CommandResult, String> {
    let output = cmd.output().map_err(|e| format!("Không chạy được command: {e}"))?;
    Ok(CommandResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn get_build_config(build_config: Option<&String>) -> String {
    let cfg = build_config
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .unwrap_or_else(|| "Debug".to_string());
    if cfg.eq_ignore_ascii_case("Release") {
        "Release".to_string()
    } else {
        "Debug".to_string()
    }
}

fn build_default_config_template(alias_exe_name: &str) -> String {
    let queue_name = alias_exe_name
        .strip_suffix(".exe")
        .unwrap_or(alias_exe_name)
        .to_string();
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <configSections>
    <section name="entityFramework" type="System.Data.Entity.Internal.ConfigFile.EntityFrameworkSection, EntityFramework, Version=6.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" requirePermission="false" />
  </configSections>
  <startup>
    <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.7.1" />
  </startup>
  <appSettings>
    <add key="Job.MsmqName" value="{queue_name}" />
    <add key="Job.BatFilePath" value="" />
    <add key="Job.SyncMode" value="sync" />
    <add key="Execute.EnvId" value="Arkbell_Dev" />
    <add key="ClientSettingsProvider.ServiceUri" value="" />
  </appSettings>
  <connectionStrings>
    <add name="EntityFramework" connectionString="" providerName="System.Data.SqlClient" />
  </connectionStrings>
  <entityFramework>
    <providers>
      <provider invariantName="System.Data.SqlClient" type="System.Data.Entity.SqlServer.SqlProviderServices, EntityFramework.SqlServer" />
    </providers>
  </entityFramework>
</configuration>"#
    )
}

fn copy_alias_exe_and_config(
    root: &Path,
    startup_abs: &Path,
    config: &str,
    alias_exe_name: Option<&String>,
    config_template: Option<&String>,
) -> Result<Option<String>, String> {
    let mut alias = alias_exe_name
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .unwrap_or_else(|| "JE5912.exe".to_string());
    if !alias.to_ascii_lowercase().ends_with(".exe") {
        alias.push_str(".exe");
    }
    let project_dir = startup_abs
        .parent()
        .ok_or_else(|| "Không xác định được thư mục project".to_string())?;
    let startup_file_name = startup_abs
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or_else(|| "Startup project không hợp lệ".to_string())?;
    let source_exe_name = startup_file_name.replace(".csproj", ".exe");

    let mut custom_out = None;
    if let Ok(content) = fs::read_to_string(startup_abs) {
        let mut condition_matches = true;
        for line in content.lines() {
            if line.contains("<PropertyGroup") {
                if line.contains("Condition=") {
                    condition_matches = line.contains(config);
                } else {
                    condition_matches = true;
                }
            }
            if line.contains("<OutputPath>") {
                if condition_matches {
                    let s = line.find("<OutputPath>").unwrap() + 12;
                    let e = line.find("</OutputPath>").unwrap_or(line.len());
                    custom_out = Some(line[s..e].trim().to_string());
                    break;
                }
            }
        }
    }

    let src = if let Some(p) = custom_out {
        project_dir.join(p.replace('\\', "/")).join(&source_exe_name)
    } else {
        project_dir.join("bin").join(&config).join(&source_exe_name)
    };

    let final_alias = if alias.is_empty() {
        source_exe_name.clone()
    } else {
        alias.clone()
    };
    let dst = project_dir.join("bin").join(&config).join(&final_alias);
    fs::create_dir_all(dst.parent().unwrap()).map_err(|e| format!("Không tạo được thư mục bin: {e}"))?;
    let _root_canon = fs::canonicalize(root).map_err(|e| format!("Project root không hợp lệ: {e}"))?;
    let src_canon = fs::canonicalize(&src).map_err(|e| format!("Không tìm thấy file exe sau build: {e}"))?;
    // Cho phép source exe nằm ngoài project root vì nhiều `.csproj` cấu hình xuất ra thư mục chung (vd: ..\..\batch\EXE\)
    
    // Ensure the destination file is not in use before copying
    let _ = Command::new("taskkill")
        .args(&["/F", "/IM", &final_alias])
        .output();
    // A small delay to ensure the OS has released the file handles
    std::thread::sleep(std::time::Duration::from_millis(200));

    fs::copy(&src_canon, &dst).map_err(|e| format!("Copy exe sang alias thất bại: {e}"))?;
    let config_path = dst.with_extension("exe.config");
    let template = config_template
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .unwrap_or_else(|| build_default_config_template(&alias));
    fs::write(&config_path, template).map_err(|e| format!("Ghi file config thất bại: {e}"))?;
    Ok(Some(format!(
        "Copied {} -> {}\nWrote config {}",
        normalize_path(&src_canon),
        normalize_path(&dst),
        normalize_path(&config_path)
    )))
}

fn collect_source_fingerprint(path: &Path, acc: &mut u64) -> Result<(), String> {
    let entries = fs::read_dir(path).map_err(|e| format!("Không đọc được thư mục {}: {e}", normalize_path(path)))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Lỗi đọc entry: {e}"))?;
        let p = entry.path();
        if p.is_dir() {
            let name = p
                .file_name()
                .and_then(|x| x.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(name.as_str(), "bin" | "obj" | ".git" | ".vs" | "node_modules" | "packages") {
                continue;
            }
            collect_source_fingerprint(&p, acc)?;
            continue;
        }
        if let Ok(meta) = fs::metadata(&p) {
            let ts = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            *acc = acc.wrapping_add(ts).wrapping_add(meta.len());
        }
    }
    Ok(())
}

fn project_source_fingerprint(startup_abs: &Path) -> Result<u64, String> {
    let project_dir = startup_abs
        .parent()
        .ok_or_else(|| "Không xác định được thư mục project".to_string())?;
    let mut acc = 0u64;
    collect_source_fingerprint(project_dir, &mut acc)?;
    Ok(acc)
}

fn run_sql_setup_if_needed(
    sql_setup_path: Option<&String>,
    server: Option<&String>,
    database: Option<&String>,
    user: Option<&String>,
    password: Option<&String>,
    use_windows_auth: Option<bool>,
) -> Result<Option<CommandResult>, String> {
    let Some(path) = sql_setup_path else {
        return Ok(None);
    };
    let input = path.trim();
    if input.is_empty() {
        return Ok(None);
    }
    
    let mut cmd = Command::new("sqlcmd");
    
    if use_windows_auth.unwrap_or(true) {
        cmd.arg("-E");
    } else {
        if let Some(u) = user {
            cmd.arg("-U").arg(u);
        }
        if let Some(p) = password {
            cmd.arg("-P").arg(p);
        }
    }
    
    if let Some(s) = server {
        if !s.trim().is_empty() {
            cmd.arg("-S").arg(s.trim());
        }
    }
    
    if let Some(d) = database {
        if !d.trim().is_empty() {
            cmd.arg("-d").arg(d.trim());
        }
    }
    
    let is_file = !input.contains('\n') && Path::new(input).exists();
    let temp_path = if !is_file {
        let temp_dir = std::env::temp_dir();
        let file_name = format!("bsn_isync_sql_{}.sql", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
        let tp = temp_dir.join(file_name);
        fs::write(&tp, input).map_err(|e| format!("Lỗi tạo file sql tạm: {}", e))?;
        Some(tp)
    } else {
        None
    };
    
    if let Some(ref tp) = temp_path {
        cmd.arg("-i").arg(tp);
    } else {
        cmd.arg("-i").arg(normalize_input_path(input));
    }
    
    let out = run_capture(cmd)?;
    
    if let Some(tp) = temp_path {
        let _ = fs::remove_file(tp);
    }
    
    Ok(Some(out))
}

fn collect_project_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Không đọc được thư mục {}: {e}", normalize_path(dir)))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Lỗi đọc entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_project_files(&path, out)?;
            continue;
        }
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_l = ext.to_ascii_lowercase();
            if ext_l == "sln" || ext_l == "csproj" {
                out.push(path);
            }
        }
    }
    Ok(())
}

fn top_group_root(root: &Path, file: &Path) -> PathBuf {
    let rel = file.strip_prefix(root).unwrap_or(file);
    let mut components = rel.components();
    if let Some(first) = components.next() {
        root.join(first.as_os_str())
    } else {
        root.to_path_buf()
    }
}

#[tauri::command]
fn pick_project_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let path = picked.and_then(|v| v.as_path().map(|p| p.to_path_buf()));
    Ok(path.map(|p| normalize_path(&p)))
}

#[tauri::command]
fn pick_file(app: AppHandle, default_path: Option<String>) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file();
    if let Some(p) = default_path {
        let pb = normalize_input_path(&p);
        if pb.exists() {
            builder = builder.set_directory(pb);
        }
    }
    let picked = builder.blocking_pick_file();
    let path = picked.and_then(|v| v.as_path().map(|p| p.to_path_buf()));
    Ok(path.map(|p| normalize_path(&p)))
}

#[tauri::command]
fn discover_projects(root: String) -> Result<Vec<ProjectCandidate>, String> {
    let root_path = normalize_input_path(&root);
    let root_canon = fs::canonicalize(&root_path).map_err(|e| format!("Project root không hợp lệ: {e}"))?;
    let mut files = Vec::new();
    collect_project_files(&root_canon, &mut files)?;

    let mut groups: BTreeMap<String, (Vec<PathBuf>, Vec<PathBuf>)> = BTreeMap::new();
    for file in files {
        let group_root = top_group_root(&root_canon, &file);
        let key = normalize_path(&group_root);
        let item = groups.entry(key).or_insert((Vec::new(), Vec::new()));
        if file.extension().and_then(|e| e.to_str()).unwrap_or("").eq_ignore_ascii_case("sln") {
            item.0.push(file);
        } else {
            item.1.push(file);
        }
    }

    let mut result = Vec::new();
    for (root_key, (slns, csprojs)) in groups {
        let group_root_path = PathBuf::from(&root_key);
        let startup = csprojs
            .iter()
            .find(|p| normalize_path(p).to_ascii_lowercase().contains("receivebatchaction"))
            .or_else(|| csprojs.iter().find(|p| normalize_path(p).to_ascii_lowercase().contains("\\web")))
            .or_else(|| csprojs.first())
            .map(|p| {
                let p_str = normalize_path(p);
                let p_path = Path::new(&p_str);
                let rp = p_path
                    .strip_prefix(&group_root_path)
                    .unwrap_or(p_path)
                    .to_string_lossy()
                    .replace('/', "\\")
                    .trim_start_matches('\\')
                    .to_string();
                rp
            })
            .unwrap_or_default();
        let name = group_root_path
            .file_name()
            .and_then(|x| x.to_str())
            .unwrap_or(&root_key)
            .to_string();
        result.push(ProjectCandidate {
            name,
            root: root_key,
            startup_project: startup,
            sln_count: slns.len(),
            csproj_count: csprojs.len(),
        });
    }
    Ok(result)
}

fn get_receive_batch_action(startup_abs: &Path) -> Option<PathBuf> {
    let parent = startup_abs.parent()?.parent()?;
    let rba_path = parent.join("Arkbell.Console.ReceiveBatchAction").join("Arkbell.Console.ReceiveBatchAction.csproj");
    if rba_path.exists() {
        Some(rba_path)
    } else {
        None
    }
}

#[tauri::command]
fn dotnet_once(request: DotnetOnceRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let startup_abs = validate_startup_abs(&root, &request.startup_project)?;
    let mut cmd = Command::new("dotnet");
    cmd.current_dir(&root);
    let mode = request.mode.to_ascii_lowercase();
    let config = get_build_config(request.build_config.as_ref());
    if mode == "restore" {
        cmd.arg("restore").arg(&startup_abs);
    } else if mode == "build" {
        cmd.arg("build").arg(&startup_abs).arg("-c").arg(&config);
    } else {
        return Err("Mode không hợp lệ, chỉ hỗ trợ restore/build".to_string());
    }
    let mut output = run_capture(cmd)?;
    if mode == "build" && output.code == 0 {
        let mut target_abs = startup_abs.clone();
        if let Some(rba) = get_receive_batch_action(&startup_abs) {
            let mut rba_build = Command::new("dotnet");
            rba_build.current_dir(&root).arg("build").arg(normalize_path(&rba)).arg("-c").arg(&config);
            let rba_out = run_capture(rba_build)?;
            output.stdout = format!("{}\n[ReceiveBatchAction]\n{}", output.stdout, rba_out.stdout);
            if !rba_out.stderr.trim().is_empty() {
                output.stderr = format!("{}\n{}", output.stderr, rba_out.stderr);
            }
            if rba_out.code != 0 {
                output.code = rba_out.code;
            } else {
                target_abs = rba;
            }
        }
        if output.code == 0 {
            if let Some(copy_msg) = copy_alias_exe_and_config(
                &root,
                &target_abs,
                &config,
                request.alias_exe_name.as_ref(),
                request.config_template.as_ref(),
            )? {
                output.stdout = if output.stdout.trim().is_empty() {
                    copy_msg
                } else {
                    format!("{}\n{}", output.stdout, copy_msg)
                };
            }
        }
    }
    Ok(output)
}

#[tauri::command]
fn dotnet_rebuild(request: DotnetRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let startup_abs = validate_startup_abs(&root, &request.startup_project)?;
    let project_dir = startup_abs.parent().unwrap();
    let startup_file = startup_abs.file_name().unwrap();

    let mut restore = Command::new("dotnet");
    restore
        .current_dir(project_dir)
        .arg("restore")
        .arg(startup_file);
    let restore_out = run_capture(restore)?;
    if restore_out.code != 0 {
        return Ok(CommandResult {
            code: restore_out.code,
            stdout: format!("[restore]\n{}", restore_out.stdout),
            stderr: format!("[restore]\n{}", restore_out.stderr),
        });
    }
    let config = get_build_config(request.build_config.as_ref());
    let mut build = Command::new("dotnet");
    build
        .current_dir(project_dir)
        .arg("build")
        .arg(startup_file)
        .arg("-c")
        .arg(&config);
    let mut build_out = run_capture(build)?;
    let mut target_abs = startup_abs.clone();

    if build_out.code == 0 {
        if let Some(rba) = get_receive_batch_action(&startup_abs) {
            let mut rba_build = Command::new("dotnet");
            rba_build.current_dir(&root).arg("build").arg(normalize_path(&rba)).arg("-c").arg(&config);
            let rba_out = run_capture(rba_build)?;
            build_out.stdout = format!("{}\n[ReceiveBatchAction]\n{}", build_out.stdout, rba_out.stdout);
            if !rba_out.stderr.trim().is_empty() {
                build_out.stderr = format!("{}\n{}", build_out.stderr, rba_out.stderr);
            }
            if rba_out.code != 0 {
                build_out.code = rba_out.code;
            } else {
                target_abs = rba;
            }
        }
    }

    if build_out.code == 0 {
        if let Some(copy_msg) = copy_alias_exe_and_config(
            &root,
            &target_abs,
            &config,
            request.alias_exe_name.as_ref(),
            request.config_template.as_ref(),
        )? {
            build_out.stdout = if build_out.stdout.is_empty() {
                copy_msg
            } else {
                format!("{}\n{}", build_out.stdout, copy_msg)
            };
        }
    }
    Ok(CommandResult {
        code: build_out.code,
        stdout: format!(
            "[restore]\n{}\n\n[build]\n{}",
            restore_out.stdout, build_out.stdout
        ),
        stderr: {
            let mut err = String::new();
            if !restore_out.stderr.trim().is_empty() {
                err.push_str(&format!("[restore]\n{}\n\n", restore_out.stderr));
            }
            if !build_out.stderr.trim().is_empty() {
                err.push_str(&format!("[build]\n{}", build_out.stderr));
            }
            err
        },
    })
}

#[tauri::command]
fn dotnet_run_start(
    app: AppHandle,
    state: State<RunnerState>,
    pty_state: State<MultiPtyState>,
    request: DotnetRequest,
) -> Result<u32, String> {
    let root = normalize_input_path(&request.project_root);
    let startup_abs = validate_startup_abs(&root, &request.startup_project)?;
    let config = get_build_config(request.build_config.as_ref());
    let source_fp = project_source_fingerprint(&startup_abs)?;
    let state_key = normalize_path(&startup_abs);
    
    let is_bat = request.target.as_deref().unwrap_or("exe") == "bat";
    
    {
        let mut guard = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
        if let Some(mut child) = guard.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let previous_fp = guard.fingerprints.get(&state_key).copied().unwrap_or(0);
        
        // Define common binary location
        let project_dir = startup_abs.parent().unwrap();
        let startup_file_name = startup_abs.file_name().unwrap().to_str().unwrap();
        let source_exe_name = startup_file_name.replace(".csproj", ".exe");
        let source_exe_path = project_dir.join("bin").join(&config).join(&source_exe_name);

        if is_bat {
            // For tests, just build the target project directly
            let _ = app.emit("build-status", "building");
            let _ = app.emit("runner-log", format!("[BUILD] Building target project for test: {}...", startup_file_name));
            drop(guard);
            
            let mut build = Command::new("dotnet");
            build.current_dir(project_dir).arg("build").arg(startup_file_name).arg("-c").arg(&config);
            let build_out = run_capture(build)?;
            
            if build_out.code != 0 {
                let _ = app.emit("runner-log", format!("[ERROR] Build failed (code {})", build_out.code));
                return Err(format!("Build failed, exit code {}", build_out.code));
            }
            let _ = app.emit("build-status", "done");
            let _ = app.emit("runner-log", "[BUILD] Target project built successfully.");
        } else if previous_fp != source_fp || !source_exe_path.exists() {
            // Smart build for EXE target
            let _ = app.emit("build-status", "building");
            let _ = app.emit("runner-log", "[BUILD] Rebuilding project...");
            drop(guard);
            let mut build = Command::new("dotnet");
            build
                .current_dir(project_dir)
                .arg("build")
                .arg(startup_file_name)
                .arg("-c")
                .arg(&config);
            let build_out = run_capture(build)?;
            if !build_out.stdout.trim().is_empty() {
                for line in build_out.stdout.lines() {
                     let _ = app.emit("runner-log", format!("  {}", line));
                }
            }
            if !build_out.stderr.trim().is_empty() {
                for line in build_out.stderr.lines() {
                     let _ = app.emit("runner-log", format!("  [ERROR] {}", line));
                }
            }
            if build_out.code != 0 {
                let _ = app.emit("runner-log", format!("[ERROR] Build failed (code {})", build_out.code));
                return Err(format!("Build failed, exit code {}", build_out.code));
            }
            
            let mut target_abs = startup_abs.clone();
            if let Some(rba) = get_receive_batch_action(&startup_abs) {
                let _ = app.emit("build-status", "building_rba");
                let _ = app.emit("runner-log", "[UPDATE] Updating ReceiveBatchAction...");
                let mut rba_build = Command::new("dotnet");
                rba_build.current_dir(&root).arg("build").arg(normalize_path(&rba)).arg("-c").arg(&config);
                let rba_out = run_capture(rba_build)?;
                if !rba_out.stdout.trim().is_empty() {
                    for line in rba_out.stdout.lines() {
                        let _ = app.emit("runner-log", format!("  {}", line));
                    }
                }
                if !rba_out.stderr.trim().is_empty() {
                     for line in rba_out.stderr.lines() {
                        let _ = app.emit("runner-log", format!("  [ERROR] {}", line));
                    }
                }
                if rba_out.code != 0 {
                    let _ = app.emit("runner-log", format!("[ERROR] ReceiveBatchAction failed (code {})", rba_out.code));
                    return Err(format!("ReceiveBatchAction build failed, exit code {}", rba_out.code));
                }
                target_abs = rba;
            }

            if let Some(copy_msg) = copy_alias_exe_and_config(
                &root,
                &target_abs,
                &config,
                request.alias_exe_name.as_ref(),
                request.config_template.as_ref(),
            )? {
                let _ = app.emit("runner-log", copy_msg);
            }
            let mut guard2 = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
            guard2.fingerprints.insert(state_key.clone(), source_fp);
            let _ = app.emit("build-status", "done");
        }
    }

    let mut target_abs = startup_abs.clone();
    if let Some(rba) = get_receive_batch_action(&startup_abs) {
        target_abs = rba;
    }

    // Always try to update/copy alias and config before running
    let _ = copy_alias_exe_and_config(
        &root,
        &target_abs,
        &config,
        request.alias_exe_name.as_ref(),
        request.config_template.as_ref(),
    );

    let alias = request.alias_exe_name
        .as_ref()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .unwrap_or_default();
    
    let project_dir = target_abs.parent().unwrap();
    let exe_path = project_dir.join("bin").join(&config).join(&alias);
    
    // Fallback to original path if alias doesn't exist
    let exe_path = if exe_path.exists() {
        exe_path
    } else {
        // Try original source
        let startup_file_name = target_abs.file_name().unwrap().to_str().unwrap();
        let source_exe_name = startup_file_name.replace(".csproj", ".exe");
        let mut custom_out = None;
        if let Ok(content) = fs::read_to_string(&startup_abs) {
            let mut condition_matches = true;
            for line in content.lines() {
                if line.contains("<PropertyGroup") {
                    if line.contains("Condition=") {
                        condition_matches = line.contains(&config);
                    } else {
                        condition_matches = true;
                    }
                }
                if line.contains("<OutputPath>") {
                    if condition_matches {
                        let s = line.find("<OutputPath>").unwrap() + 12;
                        let e = line.find("</OutputPath>").unwrap_or(line.len());
                        custom_out = Some(line[s..e].trim().to_string());
                        break;
                    }
                }
            }
        }
        if let Some(p) = custom_out {
            project_dir.join(p.replace('\\', "/")).join(&source_exe_name)
        } else {
            project_dir.join("bin").join(&config).join(&source_exe_name)
        }
    }; // We will just rely on the OS to run it.

    let run_args = request.run_args.as_deref().unwrap_or("").trim();
    let target = request.target.as_deref().unwrap_or("exe");
    
    let cmd_str = if target == "bat" {
        if let Some(bat_path_str) = request.bat_file_path.as_ref().filter(|s| !s.trim().is_empty()) {
            let bat_path = std::path::Path::new(bat_path_str);
            let parent = bat_path.parent().and_then(|p| p.to_str()).unwrap_or("");
            let file_name = bat_path.file_name().and_then(|f| f.to_str()).unwrap_or(bat_path_str);

            if !parent.is_empty() {
                if run_args.is_empty() {
                    format!("cd '{}'; & './{}'\r\n", parent, file_name)
                } else {
                    format!("cd '{}'; & './{}' {}\r\n", parent, file_name, run_args)
                }
            } else {
                if run_args.is_empty() {
                    format!("& '{}'\r\n", bat_path_str)
                } else {
                    format!("& '{}' {}\r\n", bat_path_str, run_args)
                }
            }
        } else {
            return Err("Chưa cấu hình đường dẫn BAT file cho hành động Test".to_string());
        }
    } else {
        // Run EXE without args ("khôgn cần truyền thanh số")
        format!("& '{}'\r\n", exe_path.display())
    };
    
    let pty_id = if target == "bat" { "main" } else { "run" };
    
    let mut guard = pty_state.inner().0.lock().unwrap();
    if let Some((_, writer)) = guard.get_mut(pty_id) {
        writer.write_all(cmd_str.as_bytes()).map_err(|e: std::io::Error| e.to_string())?;
        writer.flush().map_err(|e: std::io::Error| e.to_string())?;
    } else {
        return Err(format!("PTY session '{}' not initialized", pty_id));
    }
    
    Ok(0)
}

#[tauri::command]
fn dotnet_run_stop(pty_state: State<MultiPtyState>) -> Result<bool, String> {
    let mut guard = pty_state.inner().0.lock().unwrap();
    if let Some((_, writer)) = guard.get_mut("run") {
        let _ = writer.write_all(&[3]); // Ctrl+C
        let _ = writer.flush();
    }
    Ok(true)
}

#[tauri::command]
fn dotnet_run_is_running(state: State<RunnerState>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
    if let Some(child) = guard.child.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                guard.child = None;
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(_) => {
                guard.child = None;
                Ok(false)
            }
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn sync_asset(request: SyncAssetRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let source = normalize_input_path(&request.source);
    let root_canon = fs::canonicalize(&root).map_err(|e| format!("Project root không hợp lệ: {e}"))?;
    let dest_abs = root.join(request.dest.replace('/', "\\"));
    fs::create_dir_all(&dest_abs).map_err(|e| format!("Không tạo được thư mục đích: {e}"))?;
    let dest_canon = fs::canonicalize(&dest_abs).map_err(|e| format!("Dest không hợp lệ: {e}"))?;
    if !dest_canon.starts_with(&root_canon) {
        return Err("Dest nằm ngoài project root".to_string());
    }
    let mut cmd = Command::new("robocopy");
    cmd.arg(source).arg(dest_canon);
    if let Some(include) = request.include {
        if !include.trim().is_empty() {
            cmd.arg(include);
        }
    }
    cmd.arg("/E")
        .arg("/NFL")
        .arg("/NDL")
        .arg("/NP")
        .arg("/R:1")
        .arg("/W:1");
    if let Some(exclude) = request.exclude {
        if !exclude.trim().is_empty() {
            cmd.arg("/XF").arg(exclude);
        }
    }
    if request.dry_run {
        cmd.arg("/L");
    }
    let result = run_capture(cmd)?;
    Ok(result)
}

#[tauri::command]
fn run_sql_only(
    sql_content: String,
    server: Option<String>,
    database: Option<String>,
    user: Option<String>,
    password: Option<String>,
    use_windows_auth: Option<bool>,
) -> Result<CommandResult, String> {
    if let Some(out) = run_sql_setup_if_needed(
        Some(&sql_content),
        server.as_ref(),
        database.as_ref(),
        user.as_ref(),
        password.as_ref(),
        use_windows_auth,
    )? {
        Ok(out)
    } else {
        Ok(CommandResult {
            code: 0,
            stdout: "Không có dữ liệu SQL để chạy.".to_string(),
            stderr: "".to_string(),
        })
    }
}

#[tauri::command]
fn prepare_sql_temp_file(content: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_name = format!("bsn_isync_manual_{}.sql", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
    let tp = temp_dir.join(file_name);
    let mut bom_content = Vec::with_capacity(content.len() + 3);
    bom_content.extend_from_slice(b"\xEF\xBB\xBF");
    bom_content.extend_from_slice(content.as_bytes());
    fs::write(&tp, bom_content).map_err(|e| format!("Lỗi tạo file SQL tạm: {}", e))?;
    Ok(tp.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .manage(RunnerState(Mutex::new(RunnerRuntimeState {
            child: None,
            fingerprints: BTreeMap::new(),
        })))
        .manage(MultiPtyState(Mutex::new(HashMap::new())))
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
            backlog_oauth_exchange,
            run_sql_only,
            prepare_sql_temp_file,
            updater::check_update,
            updater::download_and_install_update,
            updater::restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
