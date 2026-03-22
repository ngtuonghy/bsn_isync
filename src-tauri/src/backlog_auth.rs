use serde::{Deserialize, Serialize};
use std::env;
use urlencoding::encode;

#[derive(Serialize, Deserialize)]
pub struct BacklogOAuthToken {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: String,
    #[serde(default)]
    pub host: String, // Added to sync with frontend, not in Backlog API response
}

#[derive(Serialize, Deserialize)]
pub struct BacklogConfig {
    pub host: String,
    pub client_id: String,
    pub redirect_uri: String,
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

fn get_backlog_env(key: &str) -> String {
    env::var(key)
        .or_else(|_| env::var(format!("VITE_{}", key)))
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_backlog_config() -> Result<BacklogConfig, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let redirect_uri = get_backlog_env("BACKLOG_REDIRECT_URI");

    println!("[backlog-config] host: {}", host);
    println!("[backlog-config] client_id: {}", client_id);
    println!("[backlog-config] redirect_uri: {}", redirect_uri);

    Ok(BacklogConfig {
        host,
        client_id,
        redirect_uri,
    })
}

#[tauri::command]
pub fn get_backlog_auth_url(state: String) -> Result<String, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let redirect_uri = get_backlog_env("BACKLOG_REDIRECT_URI");

    println!("[backlog-auth] Generating auth URL. host={}, client_id={}, redirect_uri={}", host, client_id, redirect_uri);

    if host.is_empty() {
        return Err("Thiếu BACKLOG_HOST trong .env".to_string());
    }
    if client_id.is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_ID trong .env".to_string());
    }
    if redirect_uri.is_empty() {
        return Err("Thiếu BACKLOG_REDIRECT_URI trong .env".to_string());
    }

    let base_url = normalize_base_url(&host)?;
    
    let url = format!(
        "{}/OAuth2AccessRequest.action?response_type=code&client_id={}&redirect_uri={}&state={}",
        base_url,
        encode(&client_id),
        encode(&redirect_uri),
        encode(&state)
    );
    println!("[backlog-auth] Generated URL: {}", url);
    Ok(url)
}

#[tauri::command]
pub fn backlog_oauth_exchange(code: String) -> Result<BacklogOAuthToken, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let client_secret = get_backlog_env("BACKLOG_CLIENT_SECRET");
    let redirect_uri = get_backlog_env("BACKLOG_REDIRECT_URI");

    println!("[backlog-auth] Exchanging token. host={}, client_id={}, client_secret_len={}, redirect_uri={}", 
        host, client_id, client_secret.len(), redirect_uri);

    if host.is_empty() {
        return Err("Thiếu BACKLOG_HOST".to_string());
    }
    if client_id.is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_ID".to_string());
    }
    if client_secret.is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_SECRET".to_string());
    }
    if redirect_uri.is_empty() {
        return Err("Thiếu BACKLOG_REDIRECT_URI".to_string());
    }

    let base_url = normalize_base_url(&host)?;
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
    ];

    let client = reqwest::blocking::Client::new();
    let res = client
        .post(format!("{}/api/v2/oauth2/token", base_url))
        .header("User-Agent", "BSNiSync/1.0.0")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .map_err(|e| format!("Lỗi kết nối API: {}", e))?;

    let status = res.status();
    let body = res.text().unwrap_or_default();

    println!("[backlog-auth] Token exchange response status: {}", status);
    if !status.is_success() {
        println!("[backlog-auth] Error body: {}", body);
        return Err(format!("Lỗi exchange token ({}): {}", status, body));
    }

    let mut token: BacklogOAuthToken = serde_json::from_str(&body)
        .map_err(|e| format!("Lỗi phân giải JSON token: {} | Nội dung: {}", e, body))?;
    
    token.host = host; // Populate host for frontend sync

    println!("[backlog-auth] Token exchange success.");
    Ok(token)
}

#[tauri::command]
pub fn backlog_oauth_refresh(refresh_token: String) -> Result<BacklogOAuthToken, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let client_secret = get_backlog_env("BACKLOG_CLIENT_SECRET");

    println!("[backlog-auth] Refreshing token. host={}, client_id={}, client_secret_len={}", 
        host, client_id, client_secret.len());

    if host.is_empty() {
        return Err("Thiếu BACKLOG_HOST".to_string());
    }
    if client_id.is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_ID".to_string());
    }
    if client_secret.is_empty() {
        return Err("Thiếu BACKLOG_CLIENT_SECRET".to_string());
    }

    let base_url = normalize_base_url(&host)?;
    let params = [
        ("grant_type", "refresh_token"),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("refresh_token", refresh_token.as_str()),
    ];

    let client = reqwest::blocking::Client::new();
    let res = client
        .post(format!("{}/api/v2/oauth2/token", base_url))
        .header("User-Agent", "BSNiSync/1.0.0")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .map_err(|e| format!("Lỗi kết nối API: {}", e))?;

    let status = res.status();
    let body = res.text().unwrap_or_default();

    println!("[backlog-auth] Token refresh response status: {}", status);
    if !status.is_success() {
        println!("[backlog-auth] Error body: {}", body);
        return Err(format!("Lỗi refresh token ({}): {}", status, body));
    }

    let mut token: BacklogOAuthToken = serde_json::from_str(&body)
        .map_err(|e| format!("Lỗi phân giải JSON token: {} | Nội dung: {}", e, body))?;
    
    token.host = host; // Populate host for frontend sync

    println!("[backlog-auth] Token refresh success.");
    Ok(token)
}
