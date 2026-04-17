use std::process::Command;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SqlTable {
    pub name: String,
    pub schema: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    #[serde(rename = "rowCount")]
    pub row_count: i32,
}

fn run_sql_query(
    server: &str,
    database: &str,
    user: &str,
    password: &str,
    use_windows_auth: bool,
    sql: &str,
) -> Result<SqlQueryResult, String> {
    let query = format!("SET NOCOUNT ON; {}", sql);
    
    let mut cmd = if use_windows_auth {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(server)
         .arg("-d").arg(database)
         .arg("-E")
         .arg("-Q").arg(&query)
         .arg("-s,")
         .arg("-W")
         .arg("-t").arg("300");
        c
    } else {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(server)
         .arg("-d").arg(database)
         .arg("-U").arg(user)
         .arg("-P").arg(password)
         .arg("-Q").arg(&query)
         .arg("-s,")
         .arg("-W")
         .arg("-t").arg("300");
        c
    };
    
    let output = cmd.output().map_err(|e| format!("Failed to execute: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("SQL Error: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();
    
    if lines.is_empty() {
        return Ok(SqlQueryResult { columns: vec![], rows: vec![], row_count: 0 });
    }
    
    let mut columns: Vec<String> = vec![];
    let mut rows: Vec<serde_json::Value> = vec![];
    let mut found_header = false;
    
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        
        let values: Vec<&str> = trimmed.split(',').map(|s| s.trim()).collect();
        
        if !found_header {
            columns = values.iter().map(|s| s.to_string()).collect();
            found_header = true;
            continue;
        }
        
        if trimmed.chars().all(|c| c == '-' || c == ' ') {
            continue;
        }
        
        let mut row = serde_json::Map::new();
        for (i, col) in columns.iter().enumerate() {
            let val = if i < values.len() { values[i] } else { "" };
            row.insert(col.clone(), serde_json::Value::String(val.to_string()));
        }
        rows.push(serde_json::Value::Object(row));
    }
    
    let row_count = rows.len() as i32;
    Ok(SqlQueryResult { columns, rows, row_count })
}

#[tauri::command]
pub async fn sql_execute_async(
    server: String,
    database: String,
    user: String,
    password: String,
    use_windows_auth: bool,
    sql: String,
) -> Result<SqlQueryResult, String> {
    let server = server.clone();
    let database = database.clone();
    let user = user.clone();
    let password = password.clone();
    let sql = sql.clone();
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_sql_query(&server, &database, &user, &password, use_windows_auth, &sql)
    }).await.map_err(|e| format!("Task error: {}", e))?;
    
    result
}

#[tauri::command]
pub async fn sql_get_tables(
    server: String,
    database: String,
    user: String,
    password: String,
    use_windows_auth: bool,
) -> Result<Vec<SqlTable>, String> {
    let server = server.clone();
    let database = database.clone();
    let user = user.clone();
    let password = password.clone();
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let query = "SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME";
        run_sql_query(&server, &database, &user, &password, use_windows_auth, query)
    }).await.map_err(|e| format!("Task error: {}", e))??;
    
    let tables: Vec<SqlTable> = result.rows.iter().map(|row| {
        let obj = row.as_object().unwrap();
        SqlTable {
            name: obj.get("TABLE_NAME").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            schema: obj.get("TABLE_SCHEMA").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        }
    }).collect();
    
    Ok(tables)
}