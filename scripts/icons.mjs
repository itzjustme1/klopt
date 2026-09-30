// Renders the PNG icons from the SVG sources in public/. Run once: node scripts/icons.mjs
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

const jobs = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
  ["favicon.svg", "favicon-32.png", 32],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, dest, size] of jobs) {
  const svg = await readFile(`public/${src}`, "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}">`);
  await page.locator("img").screenshot({ path: `public/${dest}`, omitBackground: true });
}
await browser.close();

// favicon.ico with one embedded 32x32 PNG.
const png = await readFile("public/favicon-32.png");
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("public/favicon.ico", Buffer.concat([header, png]));
