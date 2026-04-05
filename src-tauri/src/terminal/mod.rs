use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
pub struct PtyOutput {
    pub id: String,
    pub data: String,
}

pub struct MultiPtyState(pub Mutex<HashMap<String, (Box<dyn portable_pty::MasterPty + Send>, Box<dyn Write + Send>)>>);

#[tauri::command]
pub fn init_pty(app: AppHandle, state: State<MultiPtyState>, id: String, root: String, rows: u16, cols: u16) -> Result<(), String> {
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
pub fn resize_pty(state: State<MultiPtyState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some((master, _)) = guard.get_mut(&id) {
        let _ = master.resize(portable_pty::PtySize { rows, cols, pixel_width: 0, pixel_height: 0 });
    }
    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<MultiPtyState>, id: String, data: String) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some((_, writer)) = guard.get_mut(&id) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}
