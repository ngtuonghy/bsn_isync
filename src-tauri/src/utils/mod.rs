use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct CommandResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub fn normalize_path(path: &Path) -> String {
    let mut s = path.to_string_lossy().replace('/', "\\");
    if s.starts_with(r#"\\?\"#) {
        s = s[4..].to_string();
    }
    s
}

pub fn normalize_input_path(path: &str) -> PathBuf {
    let mut s = path.replace('/', "\\");
    if s.starts_with(r#"\\?\"#) {
        s = s[4..].to_string();
    }
    PathBuf::from(s)
}

pub fn validate_startup_abs(root: &Path, startup_rel: &str) -> Result<PathBuf, String> {
    let mut clean_rel = startup_rel.replace("?\\", "");
    if clean_rel.starts_with(r#"\\?\"#) {
        clean_rel = clean_rel[4..].to_string();
    }
    let startup_abs = root.join(&clean_rel);
    let root_canon = fs::canonicalize(root).map_err(|e| format!("Invalid project root: {e}"))?;
    let startup_canon = fs::canonicalize(&startup_abs).map_err(|e| format!("Startup project does not exist: {e}\n(Path: {})", clean_rel))?;
    if !startup_canon.starts_with(&root_canon) {
        return Err("Startup project is outside of project root".to_string());
    }
    let s = startup_canon.to_string_lossy().to_string();
    if s.starts_with(r#"\\?\"#) {
        Ok(PathBuf::from(&s[4..]))
    } else {
        Ok(startup_canon)
    }
}

pub fn new_command(program: &str) -> Command {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C").arg(program);
        cmd
    }
    #[cfg(not(windows))]
    {
        Command::new(program)
    }
}

pub fn run_capture(mut cmd: Command) -> Result<CommandResult, String> {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!("Program not found. Please ensure it is installed and added to PATH: {e}")
        } else {
            format!("Failed to execute command: {e}")
        }
    })?;
    Ok(CommandResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn get_build_config(build_config: Option<&String>) -> String {
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

pub fn build_default_config_template(alias_exe_name: &str, bat_file_path: &str) -> String {
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
    <add key="Job.BatFilePath" value="{bat_file_path}" />
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

pub fn collect_source_fingerprint(path: &Path, acc: &mut u64) -> Result<(), String> {
    let entries = fs::read_dir(path).map_err(|e| format!("Could not read directory {}: {e}", normalize_path(path)))?;
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

pub fn project_source_fingerprint(startup_abs: &Path) -> Result<u64, String> {
    let project_dir = startup_abs
        .parent()
        .ok_or_else(|| "Không xác định được thư mục project".to_string())?;
    let mut acc = 0u64;
    collect_source_fingerprint(project_dir, &mut acc)?;
    Ok(acc)
}

pub fn collect_project_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Could not read directory {}: {e}", normalize_path(dir)))?;
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

pub fn top_group_root(_root: &Path, file: &Path) -> PathBuf {
    file.parent().unwrap_or(file).to_path_buf()
}

pub fn get_receive_batch_action(startup_abs: &Path) -> Option<PathBuf> {
    let parent = startup_abs.parent()?.parent()?;
    let rba_path = parent.join("Arkbell.Console.ReceiveBatchAction").join("Arkbell.Console.ReceiveBatchAction.csproj");
    if rba_path.exists() && rba_path != startup_abs {
        Some(rba_path)
    } else {
        None
    }
}

pub fn is_looks_like_batch_code(input: &str) -> bool {
    let s = input.trim();
    if s.is_empty() { return false; }
    if s.contains('\n') || s.contains('\r') { return true; }
    
    let lower = s.to_ascii_lowercase();
    if lower.starts_with("@echo") || 
       lower.starts_with("rem ") || 
       lower.starts_with("set ") ||
       lower.starts_with("chcp ") ||
       lower.starts_with("cd /") ||
       lower.contains(" | ") ||
       lower.contains(" > ") ||
       lower.contains(" & ") {
        return true;
    }
    false
}

pub fn get_hostname_impl() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN-PC".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOSTNAME").unwrap_or_else(|_| "UNKNOWN-PC".to_string())
    }
}
