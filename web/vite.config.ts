import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
// Development reads the same built manifest/ABIs as production. Build once first.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "attested-development-assets",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const path = (req.url ?? "").split("?")[0];
          if (
            !/^\/(imd-deployment\.json|history\.json|constitution\.md|connector\.tar\.gz|abi\/[A-Za-z]+\.json)$/.test(
              path,
            )
          )
            return next();
          try {
            const bytes = await readFile(
              resolve(import.meta.dirname, "../dist", path.slice(1)),
            );
            res.setHeader(
              "Content-Type",
              path.endsWith(".json")
                ? "application/json"
                : path.endsWith(".gz")
                  ? "application/gzip"
                  : "text/plain",
            );
            res.end(bytes);
          } catch {
            res.statusCode = 503;
            res.end("Run npm run build in web/ first.");
          }
        });
      },
    },
  ],
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 700 },
});
