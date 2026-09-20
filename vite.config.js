import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Две страницы: / — выбор версии (отдельно от приложения), /app/ — само приложение */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        launcher: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app/index.html")
      }
    }
  },
  server: {
    port: 5177,
    strictPort: true
  }
});
