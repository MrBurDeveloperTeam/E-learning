// @ts-nocheck -- Vite executes this Node-side config; the browser app tsconfig intentionally omits Node globals.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore Local shared build integration is JavaScript.
import { sharedGamesPlugin } from "./node_modules/@mrburdeveloperteam/pet-function/scripts/vite-games.mjs";
// @ts-ignore Development-only local package integration is JavaScript.
import { localPetPlugin } from "./scripts/local-pet-vite-plugin.mjs";

export default defineConfig(({ mode }) => {
  const useLocalPet = mode === "production" && process.env.npm_lifecycle_event === "dev:local-pet";
  const localPetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../pet-function");
  const localPetDist = resolve(localPetRoot, "dist");

  return {
  plugins: [react(), ...(useLocalPet ? [localPetPlugin(localPetRoot)] : []), sharedGamesPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      ...(useLocalPet ? [
        { find: "@mrburdeveloperteam/pet-function/styles.css?raw", replacement: `${resolve(localPetDist, "styles.css")}?raw` },
        { find: "@mrburdeveloperteam/pet-function/apps/elearning", replacement: resolve(localPetDist, "elearning.js") },
        { find: "@mrburdeveloperteam/pet-function/apps", replacement: resolve(localPetDist, "apps.js") },
        { find: "@mrburdeveloperteam/pet-function/pet", replacement: resolve(localPetDist, "pet.js") },
        { find: "@mrburdeveloperteam/pet-function/options", replacement: resolve(localPetDist, "options.js") },
        { find: "@mrburdeveloperteam/pet-function/resources", replacement: resolve(localPetDist, "resources.js") },
        { find: "@mrburdeveloperteam/pet-function/styles.css", replacement: resolve(localPetDist, "styles.css") },
      ] : []),
      { find: "@", replacement: "/src" },
    ],
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
    fs: {
      allow: [resolve(dirname(fileURLToPath(import.meta.url)), "..")],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
  };
});
