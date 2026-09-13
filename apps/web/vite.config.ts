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
    configureServer(server) {
      const serve = sirv(dataAssetsDir, { dev: true, etag: true, maxAge: 0 });
      server.middlewares.use("/assets", (req, res, next) => {
        serve(req, res, next);
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
