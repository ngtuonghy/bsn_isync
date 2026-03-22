import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const pkgPath = path.join(root, "package.json");
const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
const docsPath = path.join(root, "docs", "index.html");

function bump() {
  const args = process.argv.slice(2);
  let newVersion = args[0];

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf-8"));

  if (!newVersion) {
    // Auto increment patch version
    const parts = pkg.version.split(".").map(Number);
    parts[2] += 1;
    newVersion = parts.join(".");
  }

  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`✅ Updated package.json to v${newVersion}`);

  // Update tauri.conf.json
  tauri.version = newVersion;
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");
  console.log(`✅ Updated tauri.conf.json to v${newVersion}`);

  // Update docs/index.html
  if (fs.existsSync(docsPath)) {
    let docs = fs.readFileSync(docsPath, "utf-8");
    const versionRegex = /(Phiên bản mới nhất:.*?v)[0-9.]+/g;
    docs = docs.replace(versionRegex, `$1${newVersion}`);
    fs.writeFileSync(docsPath, docs);
    console.log(`✅ Updated docs/index.html to v${newVersion}`);
  }

  console.log("\n🚀 Version synchronization complete.");
}

bump();
