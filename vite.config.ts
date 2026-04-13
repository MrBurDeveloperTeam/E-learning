import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
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
    port: 5173
  }
});
