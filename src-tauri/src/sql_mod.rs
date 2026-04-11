use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlColumn {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlTable {
    pub name: String,
    pub schema: String,
    pub columns: Vec<SqlColumn>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub row_count: usize,
}

#[tauri::command]
pub fn sql_get_tables(
    server: String,
    database: String,
    user: String,
    password: String,
    use_windows_auth: bool,
) -> Result<Vec<SqlTable>, String> {
    // Use sqlcmd to get table list
    let query = format!(
        "SELECT TABLE_SCHEMA, TABLE_NAME FROM [{database}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME",
        database = database
    );
    
    let mut cmd = if use_windows_auth {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(&server)
         .arg("-d").arg(&database)
         .arg("-E")
         .arg("-Q").arg(&query)
         .arg("-W");
        c
    } else {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(&server)
         .arg("-d").arg(&database)
         .arg("-U").arg(&user)
         .arg("-P").arg(&password)
         .arg("-Q").arg(&query)
         .arg("-W");
        c
    };
    
    let output = cmd.output().map_err(|e| format!("Failed to execute: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("SQL Error: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tables: Vec<SqlTable> = vec![];
    
    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 2 {
            tables.push(SqlTable {
                schema: parts[0].trim().to_string(),
                name: parts[1].trim().to_string(),
                columns: vec![],
            });
        }
    }
    
    Ok(tables)
}

#[tauri::command]
pub fn sql_execute(
    server: String,
    database: String,
    user: String,
    password: String,
    use_windows_auth: bool,
    sql: String,
) -> Result<SqlQueryResult, String> {
    let query = format!("SET NOCOUNT ON; {}", sql);
    
    // Use -s"," for proper CSV output and -W for trimmed whitespace
    let mut cmd = if use_windows_auth {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(&server)
         .arg("-d").arg(&database)
         .arg("-E")
         .arg("-Q").arg(&query)
         .arg("-s,")
         .arg("-W");
        c
    } else {
        let mut c = Command::new("sqlcmd");
        c.arg("-S").arg(&server)
         .arg("-d").arg(&database)
         .arg("-U").arg(&user)
         .arg("-P").arg(&password)
         .arg("-Q").arg(&query)
         .arg("-s,")
         .arg("-W");
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
        
        // Split by comma
        let values: Vec<&str> = trimmed.split(',').map(|s| s.trim()).collect();
        
        if !found_header {
            // First non-empty line is header
            columns = values.iter().map(|s| s.to_string()).collect();
            found_header = true;
            continue;
        }
        
        // Data row
        // Skip separator lines (lines with mostly dashes)
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
    
    let row_count = rows.len();
    Ok(SqlQueryResult { columns, rows, row_count })
}