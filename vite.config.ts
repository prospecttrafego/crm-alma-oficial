import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const normalizedId = id.replace(/\\/g, "/");
          const nodeModulesIndex = normalizedId.lastIndexOf("/node_modules/");
          if (nodeModulesIndex === -1) return;

          const packagePath = normalizedId.slice(nodeModulesIndex + "/node_modules/".length);
          const segments = packagePath.split("/");
          const pkg = segments[0]?.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
          if (!pkg) return;

          // Heavier libs we prefer to keep out of the main vendor chunk.
          if (pkg === "emoji-picker-react") return "vendor-emoji";
          if (pkg === "wavesurfer.js") return "vendor-audio";
          if (pkg === "react-day-picker") return "vendor-day-picker";
          if (pkg === "recharts") return "vendor-recharts";
          if (pkg === "firebase" || pkg.startsWith("@firebase/")) return "vendor-firebase";
          if (pkg === "date-fns") return "vendor-date";

          // UI + state libs split for caching.
          if (
            pkg.startsWith("@radix-ui/") ||
            pkg === "cmdk" ||
            pkg === "vaul" ||
            pkg === "react-resizable-panels" ||
            pkg.startsWith("@floating-ui/") ||
            pkg === "react-remove-scroll" ||
            pkg === "react-remove-scroll-bar" ||
            pkg === "react-style-singleton" ||
            pkg === "use-callback-ref" ||
            pkg === "use-sidecar" ||
            pkg === "aria-hidden"
          ) {
            return "vendor-ui";
          }

          if (pkg.startsWith("@tanstack/")) return "vendor-tanstack";

          if (pkg === "wouter") return "vendor-router";

          if (pkg === "lucide-react") return "vendor-icons";

          if (pkg === "react-hook-form" || pkg === "@hookform/resolvers" || pkg === "input-otp") {
            return "vendor-forms";
          }

          if (pkg === "zod" || pkg === "zod-validation-error" || pkg.startsWith("@standard-schema/")) {
            return "vendor-zod";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Proxy para conectar ao backend remoto durante desenvolvimento
    // Altere a URL abaixo para a URL do seu servidor na Hostinger
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://SEU-DOMINIO.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
