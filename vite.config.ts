import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["logo-color.png", "logo-white.png", "mark.png", "apple-touch-icon.png"],
      manifest: {
        name: "Disciply",
        short_name: "Disciply",
        description: "Suivi des âmes et du discipolat",
        lang: "fr",
        theme_color: "#3F025D",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: { clientsClaim: true, skipWaiting: true, cleanupOutdatedCaches: true, navigateFallback: "/index.html", globPatterns: ["**/*.{js,css,html,png,svg,woff2}"] }
    })
  ]
});
