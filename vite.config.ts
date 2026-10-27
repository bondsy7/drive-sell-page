import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      strategies: "generateSW",
      manifest: {
        name: "autohaus.ai",
        short_name: "autohaus.ai",
        description: "Fahrzeugmarketing aus einem Foto",
        start_url: "/",
        display: "standalone",
        background_color: "#f4f2ef",
        theme_color: "#174f6b",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: { cacheName: "pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: ({ url, request }) =>
              request.destination === "image" &&
              (url.pathname.includes("/storage/v1/object/public/") ||
                url.origin === (globalThis as unknown as { location: { origin: string } }).location.origin),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "vehicle-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
