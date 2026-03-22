fn main() {
    dotenvy::dotenv().ok();
    
    // Provide a way to fail build if variables are missing
    for key in ["BACKLOG_HOST", "BACKLOG_CLIENT_ID", "BACKLOG_CLIENT_SECRET", "BACKLOG_REDIRECT_URI"] {
        if let Ok(val) = std::env::var(key) {
            println!("cargo:rustc-env={}={}", key, val);
        } else {
            // Check for VITE_ prefixed version as well during build
            let vite_key = format!("VITE_{}", key);
            if let Ok(val) = std::env::var(&vite_key) {
                println!("cargo:rustc-env={}={}", key, val);
            }
        }
    }

    tauri_build::build()
}
