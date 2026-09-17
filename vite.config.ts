import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-ignore Local shared build integration is JavaScript.
import { sharedGamesPlugin } from "../@mrburdeveloperteam/pet-function/scripts/vite-games.mjs";

export default defineConfig({
  plugins: [react(), sharedGamesPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": "/src"
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Retaining default Rollup chunking to prevent chunk circular dependencies
      // which cause `createContext` undefined issues when deployed
    }
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
  },
  server: {
    port: 3000,
    host: "127.0.0.1",
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
