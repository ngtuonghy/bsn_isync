import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig(async () => {
  // @ts-expect-error process is a nodejs global
  const host = process.env.TAURI_DEV_HOST;

  return {
    plugins: [tailwindcss(), vue()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@tauri-apps/plugin-deep-link": fileURLToPath(
          new URL("./node_modules/@tauri-apps/plugin-deep-link/dist-js/index.js", import.meta.url)
        ),
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
