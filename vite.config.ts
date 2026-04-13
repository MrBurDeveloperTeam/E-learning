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
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("react-dom") || id.includes("react/jsx-runtime") || id.match(/[\\/]node_modules[\\/](react|scheduler)[\\/]/)) {
            return "react-vendor";
          }

          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/react-router")) {
            return "tanstack";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("@base-ui") || id.includes("lucide-react") || id.includes("sonner")) {
            return "ui";
          }

          if (id.includes("@mux/mux-player-react")) {
            return "video";
          }

          if (id.includes("@dnd-kit")) {
            return "dnd";
          }
        }
      }
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
