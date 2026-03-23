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
        return Err("BACKLOG_HOST is not configured".to_string());
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
    match key {
        "BACKLOG_HOST" => env!("BACKLOG_HOST").to_string(),
        "BACKLOG_CLIENT_ID" => env!("BACKLOG_CLIENT_ID").to_string(),
        "BACKLOG_CLIENT_SECRET" => env!("BACKLOG_CLIENT_SECRET").to_string(),
        "BACKLOG_REDIRECT_URI" => env!("BACKLOG_REDIRECT_URI").to_string(),
        _ => "".to_string(),
    }
}

#[tauri::command]
pub fn get_backlog_config() -> Result<BacklogConfig, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let redirect_uri = get_backlog_env("BACKLOG_REDIRECT_URI");



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



    if host.is_empty() {
        return Err("Missing BACKLOG_HOST in .env".to_string());
    }
    if client_id.is_empty() {
        return Err("Missing BACKLOG_CLIENT_ID in .env".to_string());
    }
    if redirect_uri.is_empty() {
        return Err("Missing BACKLOG_REDIRECT_URI in .env".to_string());
    }

    let base_url = normalize_base_url(&host)?;
    
    let url = format!(
        "{}/OAuth2AccessRequest.action?response_type=code&client_id={}&redirect_uri={}&state={}",
        base_url,
        encode(&client_id),
        encode(&redirect_uri),
        encode(&state)
    );

    Ok(url)
}

#[tauri::command]
pub fn backlog_oauth_exchange(code: String) -> Result<BacklogOAuthToken, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let client_secret = get_backlog_env("BACKLOG_CLIENT_SECRET");
    let redirect_uri = get_backlog_env("BACKLOG_REDIRECT_URI");



    if host.is_empty() {
        return Err("Missing BACKLOG_HOST".to_string());
    }
    if client_id.is_empty() {
        return Err("Missing BACKLOG_CLIENT_ID".to_string());
    }
    if client_secret.is_empty() {
        return Err("Missing BACKLOG_CLIENT_SECRET".to_string());
    }
    if redirect_uri.is_empty() {
        return Err("Missing BACKLOG_REDIRECT_URI".to_string());
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
        .map_err(|e| format!("API connection error: {}", e))?;

    let status = res.status();
    let body = res.text().unwrap_or_default();

    println!("[backlog-auth] Token exchange response status: {}", status);
    if !status.is_success() {
        println!("[backlog-auth] Error body: {}", body);
        return Err(format!("Token exchange error ({}): {}", status, body));
    }

    let mut token: BacklogOAuthToken = serde_json::from_str(&body)
        .map_err(|e| format!("JSON token parse error: {} | Content: {}", e, body))?;
    
    token.host = host; // Populate host for frontend sync

    println!("[backlog-auth] Token exchange success.");
    Ok(token)
}

#[tauri::command]
pub fn backlog_oauth_refresh(refresh_token: String) -> Result<BacklogOAuthToken, String> {
    let host = get_backlog_env("BACKLOG_HOST");
    let client_id = get_backlog_env("BACKLOG_CLIENT_ID");
    let client_secret = get_backlog_env("BACKLOG_CLIENT_SECRET");



    if host.is_empty() {
        return Err("Missing BACKLOG_HOST".to_string());
    }
    if client_id.is_empty() {
        return Err("Missing BACKLOG_CLIENT_ID".to_string());
    }
    if client_secret.is_empty() {
        return Err("Missing BACKLOG_CLIENT_SECRET".to_string());
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
        .map_err(|e| format!("API connection error: {}", e))?;

    let status = res.status();
    let body = res.text().unwrap_or_default();

    println!("[backlog-auth] Token refresh response status: {}", status);
    if !status.is_success() {
        println!("[backlog-auth] Error body: {}", body);
        return Err(format!("Token refresh error ({}): {}", status, body));
    }

    let mut token: BacklogOAuthToken = serde_json::from_str(&body)
        .map_err(|e| format!("JSON token parse error: {} | Content: {}", e, body))?;
    
    token.host = host; // Populate host for frontend sync

    println!("[backlog-auth] Token refresh success.");
    Ok(token)
}
