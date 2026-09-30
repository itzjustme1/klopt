// Takes screenshots of the main screens at 360px in light and dark. Run: npm run build && node scripts/screens.mjs <outdir>
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const out = process.argv[2] ?? "screens";
const server = spawn("npx", ["vite", "preview", "--port", "4180", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const base = "http://localhost:4180/";
const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, colorScheme: scheme, locale: "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
    const page = await ctx.newPage();
    const shot = async (name, full = true) => page.screenshot({ path: `${out}/${scheme}-${name}.png`, fullPage: full });
    await page.goto(base);
    await page.waitForSelector("h1, h2");
    await shot("1-empty");
    await page.getByRole("button", { name: "Probeer een voorbeeldstapel" }).click();
    await page.waitForSelector(".hero .count");
    await shot("2-today");
    await page.getByRole("link", { name: "Begin met overhoren" }).click();
    await page.waitForSelector(".flipper");
    await shot("3-review-front", false);
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await shot("4-review-back", false);
    await page.keyboard.press("3");
    await page.waitForTimeout(250);
    await shot("5-review-note", false);
    await page.keyboard.press("Space");
    await page.waitForTimeout(450);
    await page.keyboard.press("1");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await page.waitForTimeout(450);
    await page.keyboard.press("2");
    await page.waitForTimeout(300);
    await shot("6-done", false);
    await page.goto(base + "#/stapels");
    await page.waitForSelector("h1");
    await page.locator(".list .name").first().click();
    await page.waitForSelector(".cards");
    await shot("7-deck");
    await page.goto(base + "#/importeren");
    await page.getByLabel("Je lijst").fill("vraag\tde totale hoeveelheid die consumenten willen kopen\nkostprijs;vaste plus variabele kosten per product\nzonder scheiding\nbreak-evenpunt\tafzet waarbij omzet gelijk is aan de totale kosten");
    await page.waitForTimeout(300);
    await shot("8-import");
    await page.goto(base + "#/instellingen");
    await page.waitForSelector("h1");
    await shot("9-settings");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
