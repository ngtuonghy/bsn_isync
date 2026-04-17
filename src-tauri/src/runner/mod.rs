use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::terminal::MultiPtyState;
use crate::utils::*;

pub struct RunnerRuntimeState {
    pub child: Option<Child>,
    pub fingerprints: BTreeMap<String, u64>,
    pub temp_files: Vec<String>,
}

impl Drop for RunnerRuntimeState {
    fn drop(&mut self) {
        for path in &self.temp_files {
            let _ = std::fs::remove_file(path);
        }
    }
}

pub struct RunnerState(pub Mutex<RunnerRuntimeState>);

#[derive(Serialize, Deserialize)]
pub struct ProjectCandidate {
    pub name: String,
    pub root: String,
    pub startup_project: String,
    pub sln_count: usize,
    pub csproj_count: usize,
    pub found_bat: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct DotnetRequest {
    pub project_root: String,
    pub startup_project: String,
    pub urls: Option<String>,
    pub build_config: Option<String>,
    pub alias_exe_name: Option<String>,
    pub bat_file_path: Option<String>,
    pub target: Option<String>,
    pub config_template: Option<String>,
    pub run_config_template: Option<String>,
    #[serde(rename = "forceUnicode", alias = "force_unicode")]
    pub force_unicode: Option<bool>,
    pub sql_setup_path: Option<String>,
    pub sql_server: Option<String>,
    pub sql_database: Option<String>,
    pub sql_user: Option<String>,
    pub sql_password: Option<String>,
    pub sql_use_windows_auth: Option<bool>,
    pub run_args: Option<String>,
    pub deploy_path: Option<String>,
    pub pty_id: Option<String>,
    #[serde(rename = "isAppRunning")]
    pub is_app_running: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DotnetOnceRequest {
    pub mode: String,
    pub project_root: String,
    pub startup_project: String,
    pub build_config: Option<String>,
    pub alias_exe_name: Option<String>,
    pub config_template: Option<String>,
    pub run_config_template: Option<String>,
    pub deploy_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCheck {
    pub name: String,
    pub found: bool,
    pub version: String,
    pub download_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAssetRequest {
    pub source: String,
    pub project_root: String,
    pub dest: String,
    pub include: Option<String>,
    pub exclude: Option<String>,
    pub dry_run: bool,
}

pub fn copy_alias_exe_and_config(
    root: &Path,
    startup_abs: &Path,
    config: &str,
    alias_exe_name: Option<&String>,
    config_template: Option<&String>,
    run_config_template: Option<&String>,
    _deploy_path: Option<&String>,
    bat_file_path: Option<&String>,
    use_app_config: bool,
) -> Result<Option<String>, String> {
    let is_rba = startup_abs.to_string_lossy().to_ascii_lowercase().contains("receivebatchaction");
    let mut alias = alias_exe_name
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty())
        .unwrap_or_else(|| if is_rba { "JE5912.exe".to_string() } else { String::new() });
    if !alias.is_empty() && !alias.to_ascii_lowercase().ends_with(".exe") {
        alias.push_str(".exe");
    }
    let project_dir = startup_abs
        .parent()
        .ok_or_else(|| "Could not determine project directory".to_string())?;
    let startup_file_name = startup_abs
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or_else(|| "Invalid startup project".to_string())?;
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
            if line.contains("<OutputPath>") && condition_matches {
                let s = line.find("<OutputPath>").unwrap() + 12;
                let e = line.find("</OutputPath>").unwrap_or(line.len());
                custom_out = Some(line[s..e].trim().to_string());
                break;
            }
        }
    }

    let src = if let Some(ref p) = custom_out {
        project_dir.join(p.replace('\\', "/")).join(&source_exe_name)
    } else {
        project_dir.join("bin").join(&config).join(&source_exe_name)
    };

    let final_alias = if alias.is_empty() {
        source_exe_name.clone()
    } else {
        alias.clone()
    };
    
    let dst_dir = if let Some(ref p) = custom_out {
        project_dir.join(p.replace('\\', "/"))
    } else {
        project_dir.join("bin").join(&config)
    };
    
    let dst = dst_dir.join(&final_alias);
    fs::create_dir_all(dst.parent().unwrap()).map_err(|e| format!("Could not create destination directory: {e}"))?;
    let _root_canon = fs::canonicalize(root).map_err(|e| format!("Invalid project root: {e}"))?;
    let src_canon = fs::canonicalize(&src).map_err(|e| format!("EXE file not found after build: {e}"))?;
    
    let dst_canon_opt = fs::canonicalize(&dst).ok();
    if Some(src_canon.clone()) != dst_canon_opt {
        // Clean up any old .bak.* files from previous runs
        if let Some(parent_dir) = dst.parent() {
            if let Some(dst_stem) = dst.file_stem().and_then(|s| s.to_str()) {
                let bak_prefix = format!("{}.bak.", dst_stem);
                if let Ok(entries) = fs::read_dir(parent_dir) {
                    for entry in entries.flatten() {
                        if let Some(name) = entry.file_name().to_str() {
                            if name.starts_with(&bak_prefix) {
                                let _ = fs::remove_file(entry.path());
                            }
                        }
                    }
                }
            }
        }
        if dst.exists() {
            let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
            let temp_name = dst.with_extension(format!("bak.{}", timestamp));
            let _ = fs::rename(&dst, &temp_name);
            // Try to delete immediately (succeeds if exe is no longer running)
            let _ = fs::remove_file(&temp_name);
        }
        fs::copy(&src_canon, &dst).map_err(|e| format!("Failed to copy exe to alias: {e}"))?;
    }
    
    let config_path = dst.with_extension("exe.config");
    
    // Use App.config from project directory as base
    let app_config_path = project_dir.join("App.config");
    let base_config = if app_config_path.exists() {
        fs::read_to_string(&app_config_path).unwrap_or_else(|_| String::new())
    } else {
        String::new()
    };
    
    // If no base config, use template directly
    let template = if base_config.is_empty() {
        config_template
            .or(run_config_template)
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .unwrap_or_else(|| build_default_config_template(&alias, bat_file_path.map(|s| s.as_str()).unwrap_or("")))
    } else {
        // Get the template to use (prefer config_template, fallback to run_config_template)
        let template_src = config_template.or(run_config_template);
        
        if use_app_config {
            // Bat target: use template as base, replace connectionStrings from App.config
            let mut result = template_src
                .map(|x| x.trim().to_string())
                .filter(|x| !x.is_empty())
                .unwrap_or_else(|| base_config.clone());
            
            // Replace connectionStrings from base (App.config)
            if let Some(cs_start) = base_config.find("<connectionStrings>") {
                if let Some(cs_end) = base_config.find("</connectionStrings>") {
                    let cs_section = &base_config[cs_start..cs_end + 19];
                    if let Some(result_cs_start) = result.find("<connectionStrings>") {
                        if let Some(result_cs_end) = result.find("</connectionStrings>") {
                            result = format!("{}{}{}", &result[..result_cs_start], cs_section, &result[result_cs_end + 19..]);
                        }
                    }
                }
            }
            result
        } else {
            // Exe target: use App.config as base, replace Job.MsmqName/Job.BatFilePath from template
            let mut result = base_config.clone();
            
            if let Some(t) = template_src {
                // Replace Job.MsmqName
                if let Some(start) = t.find("Job.MsmqName") {
                    let line_start = t[..start].rfind("<add key=").map(|i| t[i..].find("/>").map(|e| i + e + 2)).flatten();
                    if let Some(ls) = line_start {
                        let new_line = &t[ls..ls + t[ls..].find("/>").unwrap_or(0) + 2];
                        if let Some(bi) = result.rfind("Job.MsmqName") {
                            let bls = result[..bi].rfind("<add key=").map(|i| result[i..].find("/>").map(|e| i + e + 2)).flatten();
                            if let Some(bl) = bls {
                                result = format!("{}{}{}", &result[..bl], new_line, &result[bl + result[bl..].find("/>").unwrap_or(0) + 2..]);
                            }
                        }
                    }
                }
                // Replace Job.BatFilePath
                if let Some(start) = t.find("Job.BatFilePath") {
                    let line_start = t[..start].rfind("<add key=").map(|i| t[i..].find("/>").map(|e| i + e + 2)).flatten();
                    if let Some(ls) = line_start {
                        let new_line = &t[ls..ls + t[ls..].find("/>").unwrap_or(0) + 2];
                        if let Some(bi) = result.rfind("Job.BatFilePath") {
                            let bls = result[..bi].rfind("<add key=").map(|i| result[i..].find("/>").map(|e| i + e + 2)).flatten();
                            if let Some(bl) = bls {
                                result = format!("{}{}{}", &result[..bl], new_line, &result[bl + result[bl..].find("/>").unwrap_or(0) + 2..]);
                            }
                        }
                    }
                }
            }
            result
        }
    };
    
    fs::write(&config_path, template).map_err(|e| format!("Failed to write config file: {e}"))?;
    Ok(Some(format!(
        "Copied {} -> {}\nWrote config {}",
        normalize_path(&src_canon),
        normalize_path(&dst),
        normalize_path(&config_path)
    )))
}

/// Resolves the output directory from a csproj file's OutputPath for the given build config
fn resolve_csproj_output_dir(csproj_path: &Path, config: &str) -> PathBuf {
    let project_dir = csproj_path.parent().unwrap();
    if let Ok(content) = fs::read_to_string(csproj_path) {
        let mut condition_matches = true;
        for line in content.lines() {
            if line.contains("<PropertyGroup") {
                condition_matches = if line.contains("Condition=") {
                    line.contains(config)
                } else {
                    true
                };
            }
            if line.contains("<OutputPath>") && condition_matches {
                let s = line.find("<OutputPath>").unwrap() + 12;
                let e = line.find("</OutputPath>").unwrap_or(line.len());
                let output_path = line[s..e].trim();
                return project_dir.join(output_path.replace('\\', "/"));
            }
        }
    }
    project_dir.join("bin").join(config)
}

/// Writes config template content to {OutputPath}/{projectName}.exe.config
fn write_config_for_project(
    csproj_path: &Path,
    build_config: &str,
    config_content: &str,
) -> Result<String, String> {
    let output_dir = resolve_csproj_output_dir(csproj_path, build_config);
    let project_name = csproj_path.file_stem().and_then(|s| s.to_str()).unwrap_or("app");
    let config_file = format!("{}.exe.config", project_name);
    let config_path = output_dir.join(&config_file);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Could not create output dir: {e}"))?;
    fs::write(&config_path, config_content).map_err(|e| format!("Failed to write config: {e}"))?;
    Ok(format!("Wrote config: {}", normalize_path(&config_path)))
}

/// Copies RBA exe with alias name and writes its config to {RBA OutputPath}/{alias}.exe.config
fn copy_rba_exe_with_config(
    rba_csproj: &Path,
    build_config: &str,
    alias_name: &str,
    config_content: &str,
) -> Result<String, String> {
    let output_dir = resolve_csproj_output_dir(rba_csproj, build_config);
    let source_name = rba_csproj.file_stem().and_then(|s| s.to_str())
        .map(|s| format!("{}.exe", s))
        .ok_or_else(|| "Invalid RBA csproj".to_string())?;
    let source_exe = output_dir.join(&source_name);

    let mut alias = alias_name.to_string();
    if !alias.to_ascii_lowercase().ends_with(".exe") {
        alias.push_str(".exe");
    }
    let dest_exe = output_dir.join(&alias);

    fs::create_dir_all(&output_dir).map_err(|e| format!("Could not create output dir: {e}"))?;
    let source_canon = fs::canonicalize(&source_exe)
        .map_err(|e| format!("RBA exe not found after build: {e}"))?;
    let dest_canon = fs::canonicalize(&dest_exe).ok();

    if Some(source_canon.clone()) != dest_canon {
        // Clean up old .bak files
        if let Some(dst_stem) = dest_exe.file_stem().and_then(|s| s.to_str()) {
            let bak_prefix = format!("{}.bak.", dst_stem);
            if let Ok(entries) = fs::read_dir(&output_dir) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with(&bak_prefix) {
                            let _ = fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
        if dest_exe.exists() {
            let ts = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
            let temp = dest_exe.with_extension(format!("bak.{}", ts));
            let _ = fs::rename(&dest_exe, &temp);
            let _ = fs::remove_file(&temp);
        }
        fs::copy(&source_canon, &dest_exe).map_err(|e| format!("Failed to copy exe: {e}"))?;
    }

    // Write config
    let config_path = dest_exe.with_extension("exe.config");
    fs::write(&config_path, config_content).map_err(|e| format!("Failed to write RBA config: {e}"))?;

    Ok(format!(
        "Copied {} -> {}\nWrote config: {}",
        normalize_path(&source_canon),
        normalize_path(&dest_exe),
        normalize_path(&config_path)
    ))
}

pub fn run_sql_setup_if_needed(
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
    
    let mut cmd = new_command("sqlcmd");
    
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
    
    cmd.arg("-s,").arg("-W").arg("-t").arg("300");
    
    let temp_dir = std::env::temp_dir();
    let file_name = format!("bsn_isync_sql_{}.sql", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
    let tp = temp_dir.join(file_name);
    
    // Write with UTF-8 BOM for proper encoding
    let mut bom_content = Vec::with_capacity(input.len() + 3);
    bom_content.extend_from_slice(b"\xEF\xBB\xBF");
    bom_content.extend_from_slice(input.as_bytes());
    fs::write(&tp, bom_content).map_err(|e| format!("Error creating temporary SQL file: {}", e))?;
    
    cmd.arg("-i").arg(&tp);
    
    let out = run_capture(cmd)?;
    
    let _ = fs::remove_file(tp);
    
    Ok(Some(out))
}

#[tauri::command]
pub fn pick_project_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let path = picked.and_then(|v| v.as_path().map(|p| p.to_path_buf()));
    Ok(path.map(|p| normalize_path(&p)))
}

#[tauri::command]
pub fn pick_file(app: AppHandle, default_path: Option<String>) -> Result<Option<String>, String> {
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
pub fn discover_projects(root: String) -> Result<Vec<ProjectCandidate>, String> {
    let root_path = normalize_input_path(&root);
    let root_canon = fs::canonicalize(&root_path).map_err(|e| format!("Invalid project root: {e}"))?;
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

    let batch_dir = root_canon.join("batch");
    let batch_files: Vec<PathBuf> = if batch_dir.exists() && batch_dir.is_dir() {
        fs::read_dir(&batch_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.extension().and_then(|ext| ext.to_str()).unwrap_or("").eq_ignore_ascii_case("bat"))
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Vec::new()
    };

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

        let startup_file_name = if !startup.is_empty() {
             Path::new(&startup).file_stem().and_then(|s| s.to_str()).unwrap_or("")
        } else {
            ""
        };

        let found_bat = if !startup_file_name.is_empty() {
            batch_files.iter()
                .find(|p| p.file_stem().and_then(|s| s.to_str()).unwrap_or("").eq_ignore_ascii_case(startup_file_name))
                .or_else(|| {
                    if startup_file_name.to_ascii_lowercase().contains("receivebatchaction") {
                         batch_files.iter().find(|p| p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().starts_with("je"))
                    } else {
                        None
                    }
                })
                .map(|p| {
                     p.strip_prefix(&root_canon)
                        .unwrap_or(p)
                        .to_string_lossy()
                        .replace('/', "\\")
                })
        } else {
            None
        };

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
            found_bat,
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn dotnet_once(request: DotnetOnceRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let startup_abs = validate_startup_abs(&root, &request.startup_project)?;
    let mut cmd = new_command("dotnet");
    cmd.current_dir(&root);
    let mode = request.mode.to_ascii_lowercase();
    let config = get_build_config(request.build_config.as_ref());
    if mode == "restore" {
        cmd.arg("restore").arg(&startup_abs);
    } else if mode == "build" {
        cmd.arg("build").arg(&startup_abs).arg("-c").arg(&config);
    } else {
        return Err("Invalid mode, only restore/build supported".to_string());
    }
    let mut output = run_capture(cmd)?;
    if mode == "build" && output.code == 0 {
        let mut target_abs = startup_abs.clone();
        // Only build RBA if startup project is not already the RBA itself
        let is_startup_rba = startup_abs.to_string_lossy().to_ascii_lowercase().contains("receivebatchaction");
        if !is_startup_rba {
            if let Some(rba) = get_receive_batch_action(&startup_abs) {
                let mut rba_build = new_command("dotnet");
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
        }
        if output.code == 0 {
            // For dotnet_once build (not exe target), use template as base
            if let Some(copy_msg) = copy_alias_exe_and_config(
                &root,
                &target_abs,
                &config,
                request.alias_exe_name.as_ref(),
                request.config_template.as_ref(),
                request.run_config_template.as_ref(),
                request.deploy_path.as_ref(),
                None,
                false, // use_app_config = false for dotnet_once
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
pub fn dotnet_rebuild(request: DotnetRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let startup_abs = validate_startup_abs(&root, &request.startup_project)?;
    let project_dir = startup_abs.parent().unwrap();
    let startup_file = startup_abs.file_name().unwrap();

    let mut restore = new_command("dotnet");
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
    let mut build = new_command("dotnet");
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
            let mut rba_build = new_command("dotnet");
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
        // For dotnet_rebuild, use template as base (like bat)
        if let Some(copy_msg) = copy_alias_exe_and_config(
            &root,
            &target_abs,
            &config,
            request.alias_exe_name.as_ref(),
            request.config_template.as_ref(),
            request.run_config_template.as_ref(),
            request.deploy_path.as_ref(),
            None,
            false, // use_app_config = false
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
pub fn dotnet_run_start(
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
    
    let target = request.target.as_deref().unwrap_or("exe");
    let is_bat = target == "bat";
    let is_exe = target == "exe" || target == "test_exe";
    
    // Declare these variables early so they're available after the build block
    let mut target_abs = startup_abs.clone();
    // Only set target_abs to RBA for exe targets (not for bat)
    if is_exe && request.target.as_deref() != Some("test_exe") {
        if let Some(rba) = get_receive_batch_action(&startup_abs) {
            target_abs = rba;
        }
    }

    let mut actual_bat_path = request.bat_file_path.clone();
    let config_template = request.config_template.clone();
    let run_config_template = request.run_config_template.clone();

    {
        let mut guard = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
        if let Some(mut child) = guard.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        // Selective cleanup: only remove 'one-off' temp files
        guard.temp_files.retain(|path| {
            if path.contains("bsn_isync_batch_") || path.contains("bsn_isync_manual_") {
                let _ = std::fs::remove_file(path);
                false // removed from list
            } else {
                true // keep in list (shared files like _isync.bat)
            }
        });
        let project_dir = startup_abs.parent().unwrap();
        let startup_file_name = startup_abs.file_name().unwrap().to_str().unwrap();

        // Always build for bat and exe targets
        if is_bat {
            let _ = app.emit("build-status", "building");
            let _ = app.emit("runner-log", "[BUILD] Rebuilding project...");
            drop(guard);
            let mut build = new_command("dotnet");
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
                let _ = app.emit("build-status", "error");
                let _ = app.emit("runner-log", format!("[ERROR] Build failed (code {})", build_out.code));
                return Err(format!("Build failed, exit code {}", build_out.code));
            }
            
            // Write configTemplate (TARGET CONFIG) to target project's OutputPath
            if let Some(ct) = config_template.as_ref().filter(|s| !s.trim().is_empty()) {
                match write_config_for_project(&startup_abs, &config, ct) {
                    Ok(msg) => { let _ = app.emit("runner-log", msg); },
                    Err(e) => { let _ = app.emit("runner-log", format!("[WARN] Config write failed: {}", e)); },
                }
            }

            let mut guard2 = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
            guard2.fingerprints.insert(state_key.clone(), source_fp);
            let _ = app.emit("build-status", "done");
        } else if is_exe {
            // Build target project
            let _ = app.emit("build-status", "building");
            let _ = app.emit("runner-log", "[BUILD] Rebuilding project...");
            drop(guard);
            let mut build = new_command("dotnet");
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
                let _ = app.emit("build-status", "error");
                let _ = app.emit("runner-log", format!("[ERROR] Build failed (code {})", build_out.code));
                return Err(format!("Build failed, exit code {}", build_out.code));
            }
            
            // Write configTemplate (TARGET CONFIG) to startup project's OutputPath
            if let Some(ct) = config_template.as_ref().filter(|s| !s.trim().is_empty()) {
                match write_config_for_project(&startup_abs, &config, ct) {
                    Ok(msg) => { let _ = app.emit("runner-log", msg); },
                    Err(e) => { let _ = app.emit("runner-log", format!("[WARN] Config write failed: {}", e)); },
                }
            }
            
            // Build RBA and copy/rename exe with config
            if let Some(rba) = get_receive_batch_action(&startup_abs) {
                let rba_path_str = rba.to_string_lossy().to_string();
                let _ = app.emit("build-status", "building_rba");
                let _ = app.emit("runner-log", format!("[BUILD] Building ReceiveBatchAction: {}", rba_path_str));
                let mut rba_build = new_command("dotnet");
                rba_build.current_dir(&root).arg("build").arg(&rba_path_str).arg("-c").arg(&config);
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
                    let _ = app.emit("build-status", "error");
                    let _ = app.emit("runner-log", format!("[ERROR] ReceiveBatchAction build failed (code {})", rba_out.code));
                    return Err(format!("ReceiveBatchAction build failed, exit code {}", rba_out.code));
                }
                
                // Copy RBA exe with bat name alias and write runConfigTemplate (RUN CONFIG EXE)
                let rba_alias = request.alias_exe_name.as_ref()
                    .map(|x| x.trim().to_string())
                    .filter(|x| !x.is_empty())
                    .unwrap_or_else(|| "JE5912.exe".to_string());
                if let Some(rct) = run_config_template.as_ref().filter(|s| !s.trim().is_empty()) {
                    match copy_rba_exe_with_config(&rba, &config, &rba_alias, rct) {
                        Ok(msg) => { let _ = app.emit("runner-log", msg); },
                        Err(e) => { let _ = app.emit("runner-log", format!("[WARN] RBA config failed: {}", e)); },
                    }
                }
            }
            
            let _ = app.emit("build-status", "done");
        }
        // test_exe: no config copy needed
    } // end of outer block

    // force_unicode processing for both bat and exe targets
    if request.force_unicode.unwrap_or(false) {
        if let Some(ref bat_str) = request.bat_file_path {
            let bat_path = Path::new(bat_str);
            if bat_path.exists() {
                if let Ok(content_bytes) = fs::read(bat_path) {
                    let mut new_content = Vec::with_capacity(content_bytes.len() + 200);
                    let mut changed = false;
                    
                    let search_bytes = b"SQLCMD";
                    let insert_bytes = b"-f 932";
                    
                    for byte in content_bytes.iter() {
                        new_content.push(*byte);
                    }
                    
                    let mut i = 0;
                    while i + search_bytes.len() <= new_content.len() {
                        if &new_content[i..i+search_bytes.len()] == search_bytes {
                            let has_f932 = if i + search_bytes.len() + 1 < new_content.len() {
                                let after = &new_content[i+search_bytes.len()..];
                                after.starts_with(b" -f 932") || after.starts_with(b"\t-f 932")
                            } else {
                                false
                            };
                            
                            if !has_f932 {
                                new_content.splice(i+search_bytes.len()..i+search_bytes.len(), b" -f 932".to_vec());
                                i += search_bytes.len() + 7;
                                changed = true;
                            } else {
                                i += search_bytes.len();
                            }
                        } else {
                            i += 1;
                        }
                    }

                    if changed {
                        let file_stem = bat_path.file_stem().unwrap().to_string_lossy();
                        let new_bat_path = bat_path.with_file_name(format!("{}_isync.bat", file_stem));
                        
                        // Copy as-is without any encoding conversion
                        if fs::write(&new_bat_path, &new_content).is_ok() {
                            let new_bat_str = new_bat_path.to_string_lossy().to_string();
                            actual_bat_path = Some(new_bat_str.clone());
                            
                            // Register for cleanup
                            if let Ok(mut guard) = state.0.lock() {
                                if !guard.temp_files.contains(&new_bat_str) {
                                    guard.temp_files.push(new_bat_str.clone());
                                }
                            }
                            
                            // For exe target: re-write the RBA config with updated _isync bat path
                            if target == "exe" {
                                if let Some(rba) = get_receive_batch_action(&startup_abs) {
                                    let rba_alias = request.alias_exe_name.as_ref()
                                        .map(|x| x.trim().to_string())
                                        .filter(|x| !x.is_empty())
                                        .unwrap_or_else(|| "JE5912.exe".to_string());
                                    if let Some(ref rct) = run_config_template {
                                        // Update Job.BatFilePath in the config to point to _isync bat
                                        let updated_rct = rct.replace(
                                            &format!("value=\"{}\"", bat_str),
                                            &format!("value=\"{}\"", new_bat_str)
                                        );
                                        let output_dir = resolve_csproj_output_dir(&rba, &config);
                                        let mut alias = rba_alias.clone();
                                        if !alias.to_ascii_lowercase().ends_with(".exe") {
                                            alias.push_str(".exe");
                                        }
                                        let dest_exe = output_dir.join(&alias);
                                        let config_path = dest_exe.with_extension("exe.config");
                                        let _ = fs::write(&config_path, &updated_rct);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let alias = if request.target.as_deref() == Some("test_exe") {
        String::new()
    } else {
        request.alias_exe_name
            .as_ref()
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .unwrap_or_default()
    };
    
    let run_project_abs = if request.target.as_deref() == Some("test_exe") {
        &startup_abs
    } else {
        &target_abs
    };
    let project_dir = run_project_abs.parent().unwrap();
    let startup_file_name = run_project_abs.file_name().unwrap().to_str().unwrap();
    let source_exe_name = startup_file_name.replace(".csproj", ".exe");
    
    let mut custom_out = None;
    if let Ok(content) = fs::read_to_string(run_project_abs) {
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
    let dst_dir = if let Some(dp) = request.deploy_path.as_ref().filter(|s| !s.trim().is_empty()) {
        let dp_path = normalize_input_path(dp);
        if dp_path.is_absolute() {
            dp_path
        } else {
            root.join(dp_path)
        }
    } else if let Some(ref p) = custom_out {
        project_dir.join(p.replace('\\', "/"))
    } else {
        project_dir.join("bin").join(&config)
    };

    let final_alias = if alias.is_empty() {
        source_exe_name.clone()
    } else {
        alias.clone()
    };
    
    let exe_path = dst_dir.join(&final_alias);
    
    let exe_path = if exe_path.exists() {
        exe_path
    } else {
        if let Some(p) = custom_out {
            project_dir.join(p.replace('\\', "/")).join(&source_exe_name)
        } else {
            project_dir.join("bin").join(&config).join(&source_exe_name)
        }
    };

    let run_args = request.run_args.as_deref().unwrap_or("").trim();
    let target = request.target.as_deref().unwrap_or("exe");
    
    let cmd_str = if target == "bat" {
        if let Some(bat_path_str) = actual_bat_path.as_ref().filter(|s| !s.trim().is_empty()) {
            let mut final_path = bat_path_str.clone();

            if is_looks_like_batch_code(&final_path) && !Path::new(&final_path).exists() {
                final_path = prepare_batch_temp_file(final_path)?;
                if let Ok(mut guard) = state.0.lock() {
                    if !guard.temp_files.contains(&final_path) {
                        guard.temp_files.push(final_path.clone());
                    }
                }
            } else if final_path.ends_with("_isync.bat") {
            }

let original_bat_path = std::path::Path::new(bat_path_str);
            let parent = original_bat_path.parent().and_then(|p| p.to_str()).unwrap_or("");
            let stem = original_bat_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let escaped_path = final_path.replace('\'', "''");
            
            // Delete _isync.bat when test finishes, but skip if app is running
            let is_running = request.is_app_running.unwrap_or(false);
            let cleanup = if final_path.ends_with("_isync.bat") && !stem.is_empty() && !is_running {
                format!("\r\nRemove-Item '{}' -Force -ErrorAction SilentlyContinue", escaped_path)
            } else {
                String::new()
            };

            let mut cmd = String::new();
            if request.force_unicode.unwrap_or(false) {
                cmd.push_str("chcp 932 >$null; [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(932); ");
            }

            if !parent.is_empty() {
                if run_args.is_empty() {
                    cmd.push_str(&format!("cd '{}'; & '{}'{}\r\n", parent, final_path, cleanup));
                } else {
                    cmd.push_str(&format!("cd '{}'; & '{}' {}{}\r\n", parent, final_path, run_args, cleanup));
                }
            } else {
                if run_args.is_empty() {
                    cmd.push_str(&format!("& '{}'{}\r\n", final_path, cleanup));
                } else {
                    cmd.push_str(&format!("& '{}' {}{}\r\n", final_path, run_args, cleanup));
                }
            }
            cmd
        } else {
            return Err("BAT file path not configured for Test action".to_string());
        }
    } else {
        let exe_path_to_run = exe_path.clone();
        let mut cmd = String::new();
        if request.force_unicode.unwrap_or(false) {
            cmd.push_str("chcp 932 >$null; [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(932); ");
        }

        // Build cleanup command for _isync.bat temp file (created by force_unicode)
        let cleanup = String::new(); // Manual cleanup removed (relying on temp_files + stop)

        if run_args.is_empty() {
            cmd.push_str(&format!("& '{}'{}\r\n", exe_path_to_run.display(), cleanup));
        } else {
            cmd.push_str(&format!("& '{}' {}{}\r\n", exe_path_to_run.display(), run_args, cleanup));
        }
        cmd
    };
    
    let pty_id = request.pty_id.as_deref().unwrap_or(if target == "bat" { "main" } else { "run" });
    
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
pub fn dotnet_run_stop(state: State<RunnerState>, pty_state: State<MultiPtyState>, pty_id: Option<String>) -> Result<bool, String> {
    let mut guard = pty_state.inner().0.lock().unwrap();
    if let Some(id) = pty_id {
        if let Some((_, writer)) = guard.get_mut(id.as_str()) {
            let _ = writer.write_all(&[3]);
            let _ = writer.flush();
        }
    } else {
        for (k, (_, writer)) in guard.iter_mut() {
            if k.starts_with("run") {
                let _ = writer.write_all(&[3]);
                let _ = writer.flush();
            }
        }
    }
    if let Ok(mut runner_guard) = state.0.lock() {
        for path in runner_guard.temp_files.drain(..) {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn dotnet_run_is_running(state: State<RunnerState>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|_| "State bị lock lỗi".to_string())?;
    if let Some(child) = guard.child.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                guard.child = None;
                for path in guard.temp_files.drain(..) {
                    let _ = std::fs::remove_file(path);
                }
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(_) => {
                guard.child = None;
                for path in guard.temp_files.drain(..) {
                    let _ = std::fs::remove_file(path);
                }
                Ok(false)
            }
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn deploy_project_config(project_root: String, startup_project: String, config_template: String) -> Result<String, String> {
    let root = normalize_input_path(&project_root);
    let startup_abs = validate_startup_abs(&root, &startup_project)?;
    let project_dir = startup_abs.parent().ok_or_else(|| "Could not determine project directory".to_string())?;
    let config_path = project_dir.join("App.config");
    fs::write(&config_path, config_template).map_err(|e| format!("Failed to write App.config: {e}"))?;
    Ok(normalize_path(&config_path))
}

#[tauri::command]
pub fn fetch_project_config(project_root: String, startup_project: String) -> Result<String, String> {
    let root = normalize_input_path(&project_root);
    let startup_abs = validate_startup_abs(&root, &startup_project)?;
    let project_dir = startup_abs.parent().ok_or_else(|| "Could not determine project directory".to_string())?;
    let config_path = project_dir.join("App.config");
    if !config_path.exists() {
        return Err("App.config does not exist in the target project folder".to_string());
    }
    fs::read_to_string(&config_path).map_err(|e| format!("Failed to read App.config: {e}"))
}

#[tauri::command]
pub fn sync_asset(request: SyncAssetRequest) -> Result<CommandResult, String> {
    let root = normalize_input_path(&request.project_root);
    let source = normalize_input_path(&request.source);
    let root_canon = fs::canonicalize(&root).map_err(|e| format!("Project root không hợp lệ: {e}"))?;
    let dest_abs = root.join(request.dest.replace('/', "\\"));
    fs::create_dir_all(&dest_abs).map_err(|e| format!("Không tạo được thư mục đích: {e}"))?;
    let dest_canon = fs::canonicalize(&dest_abs).map_err(|e| format!("Dest không hợp lệ: {e}"))?;
    if !dest_canon.starts_with(&root_canon) {
        return Err("Dest nằm ngoài project root".to_string());
    }
    let mut cmd = new_command("robocopy");
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
pub fn get_hostname() -> String {
    get_hostname_impl()
}

#[tauri::command]
pub fn run_sql_only(
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
pub fn prepare_sql_temp_file(content: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_name = format!("bsn_isync_manual_{}.sql", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
    let tp = temp_dir.join(file_name);
    let mut bom_content = Vec::with_capacity(content.len() + 3);
    bom_content.extend_from_slice(b"\xEF\xBB\xBF");
    bom_content.extend_from_slice(content.as_bytes());
    fs::write(&tp, bom_content).map_err(|e| format!("Lỗi tạo file SQL tạm: {}", e))?;
    Ok(tp.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_sql_connection(connection_string: String) -> Result<serde_json::Value, String> {
    let conn_str = connection_string.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let parts: Vec<&str> = conn_str.split(';').collect();
        let mut server = String::new();
        let mut database = String::new();
        let mut user = String::new();
        let mut password = String::new();
        let mut use_windows_auth = true;

        for part in &parts {
            let kv: Vec<&str> = part.splitn(2, '=').collect();
            if kv.len() == 2 {
                let key = kv[0].trim().to_lowercase();
                let val = kv[1].trim();
                match key.as_str() {
                    "server" | "data source" => server = val.to_string(),
                    "database" | "initial catalog" => database = val.to_string(),
                    "user id" | "uid" => { user = val.to_string(); use_windows_auth = false; }
                    "password" | "pwd" => password = val.to_string(),
                    "trusted_connection" => use_windows_auth = val.to_lowercase() == "true" || val.to_lowercase() == "yes",
                    _ => {}
                }
            }
        }

        if server.is_empty() {
            return Ok(serde_json::json!({ "success": false, "error": "Missing server name" }));
        }
        if database.is_empty() {
            return Ok(serde_json::json!({ "success": false, "error": "Missing database name" }));
        }

        let mut cmd = std::process::Command::new("sqlcmd");
        cmd.arg("-S").arg(&server)
            .arg("-d").arg(&database)
            .arg("-Q").arg("SELECT 1")
            .creation_flags(CREATE_NO_WINDOW);

        if use_windows_auth {
            cmd.arg("-E");
        } else if !user.is_empty() {
            cmd.arg("-U").arg(&user).arg("-P").arg(&password);
        } else {
            cmd.arg("-E");
        }

        match cmd.output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(serde_json::json!({ "success": true }))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let error_msg = if !stderr.is_empty() { stderr.to_string() } else { stdout.to_string() };
                    Ok(serde_json::json!({ "success": false, "error": error_msg.trim() }))
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    Ok(serde_json::json!({ "success": false, "error": "sqlcmd not found. Please install SQL Server Command Line Utilities." }))
                } else {
                    Ok(serde_json::json!({ "success": false, "error": format!("Failed to run sqlcmd: {}", e) }))
                }
            }
        }
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub fn prepare_batch_temp_file(content: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_name = format!("bsn_isync_batch_{}.bat", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
    let tp = temp_dir.join(file_name);
    
    let mut bom_content = Vec::with_capacity(content.len() + 3);
    bom_content.extend_from_slice(b"\xEF\xBB\xBF");
    bom_content.extend_from_slice(content.as_bytes());
    
    fs::write(&tp, bom_content).map_err(|e| format!("Error creating temporary BAT file: {}", e))?;
    Ok(tp.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(path, None::<String>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_environment() -> Vec<ToolCheck> {
    let mut results = Vec::new();

    let mut dotnet = ToolCheck {
        name: ".NET SDK".to_string(),
        found: false,
        version: "".to_string(),
        download_url: "https://dotnet.microsoft.com/en-us/download/dotnet/6.0".to_string(),
    };
    let mut cmd_dotnet = new_command("dotnet");
    cmd_dotnet.arg("--version");
    #[cfg(windows)]
    cmd_dotnet.creation_flags(CREATE_NO_WINDOW);
    if let Ok(out) = cmd_dotnet.output() {
        if out.status.success() {
            dotnet.found = true;
            dotnet.version = String::from_utf8_lossy(&out.stdout).trim().to_string();
        }
    }
    results.push(dotnet);

    let mut sqlcmd = ToolCheck {
        name: "SQLCMD".to_string(),
        found: false,
        version: "".to_string(),
        download_url: "https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility".to_string(),
    };
    let mut cmd_sqlcmd = new_command("sqlcmd");
    cmd_sqlcmd.arg("-?");
    #[cfg(windows)]
    cmd_sqlcmd.creation_flags(CREATE_NO_WINDOW);
    if let Ok(out) = cmd_sqlcmd.output() {
        if out.status.success() || !out.stdout.is_empty() {
            sqlcmd.found = true;
            sqlcmd.version = "Found".to_string();
        }
    }
    results.push(sqlcmd);

    results
}

#[tauri::command]
pub fn invalidate_build_fingerprint(
    state: State<RunnerState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "State lock error".to_string())?;
    guard.fingerprints.clear();
    Ok(())
}

#[tauri::command]
pub fn write_project_config_output(project_path: String, build_config: String, content: String) -> Result<String, String> {
    let path = normalize_input_path(&project_path);
    write_config_for_project(&path, &build_config, &content)
}

#[tauri::command]
pub fn dotnet_plain_command(mode: String, project_root: String, startup_project: String, build_config: Option<String>) -> Result<CommandResult, String> {
    let root = normalize_input_path(&project_root);
    let startup_abs = validate_startup_abs(&root, &startup_project)?;
    let project_dir = startup_abs.parent().unwrap();
    let startup_file = startup_abs.file_name().unwrap();

    let mut cmd = new_command("dotnet");
    cmd.current_dir(project_dir);
    let md = mode.to_ascii_lowercase();
    
    if md == "restore" {
        cmd.arg("restore").arg(startup_file);
    } else if md == "build" {
        let config = get_build_config(build_config.as_ref());
        cmd.arg("build").arg(startup_file).arg("-c").arg(&config);
    } else {
        return Err("Invalid mode".to_string());
    }
    
    run_capture(cmd)
}
