/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import { APP_NAME } from "./src/config.ts";

export const CSP = [
  "default-src 'self'",
  // WebAssembly compilation only (on-device OCR). This is not 'unsafe-eval': JS eval and new Function stay blocked.
  "script-src 'self' 'wasm-unsafe-eval'",
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

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
        description: "Oefen woordjes en begrippen voor je toetsen. Werkt offline, zonder account.",
        lang: "nl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#0B1736",
        theme_color: "#0B1736",
        share_target: {
          action: "./",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        // The OCR engine (about 4 MB plus language data) is only downloaded when a student uses it,
        // then kept for offline use.
        globIgnores: ["ocr/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/ocr/") || /\/assets\/tesseract/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "ocr", expiration: { maxEntries: 20 } },
          },
        ],
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
