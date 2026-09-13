import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import sirv from "sirv";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataAssetsDir = path.resolve(root, "../../data/assets");

/** Serve curated dataset images at /assets in dev (mock mode without API). */
function localDataAssetsPlugin(): Plugin {
  return {
    name: "local-data-assets",
    enforce: "pre",
    configureServer(server) {
      const serve = sirv(dataAssetsDir, { dev: true, etag: true, maxAge: 0 });
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        if (!pathname.startsWith("/assets/")) return next();
        const saved = req.url;
        req.url = pathname.slice("/assets".length) || "/";
        serve(req, res, () => {
          req.url = saved;
          next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localDataAssetsPlugin()],
  resolve: {
    alias: {
      "@shared": path.resolve(root, "../../shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
