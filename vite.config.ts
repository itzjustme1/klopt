/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import { APP_NAME } from "./src/config.ts";

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Puts the app name into index.html and adds the CSP meta tag to production builds only (dev needs inline styles for HMR). */
function htmlPlugin(): Plugin {
  let isBuild = false;
  return {
    name: "klopt-html",
    configResolved(c) {
      isBuild = c.command === "build";
    },
    generateBundle() {
      // Real HTTP headers for hosts that read a _headers file (Netlify, Cloudflare Pages). Ignored elsewhere.
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: [
          "/*",
          `  Content-Security-Policy: ${CSP}; frame-ancestors 'none'`,
          "  X-Content-Type-Options: nosniff",
          "  Referrer-Policy: no-referrer",
          "  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()",
          "  Cross-Origin-Opener-Policy: same-origin",
          "",
        ].join("\n"),
      });
    },
    transformIndexHtml(html) {
      let out = html.replaceAll("%APP_NAME%", APP_NAME);
      if (isBuild) out = out.replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
      else out = out.replace("<!--CSP-->", "");
      return out;
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    htmlPlugin(),
    svelte(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: "Flashcards for Dutch exam subjects, using the Leitner box method.",
        lang: "nl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#E8EDF0",
        theme_color: "#E8EDF0",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    sourcemap: false,
    target: "es2022",
    assetsInlineLimit: 0,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { TZ: "Europe/Amsterdam" },
  },
});
