// Screenshots of the main screens at phone width, light and dark.
// Run: npm run build && node scripts/screens.mjs <outdir> [width]
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const out = process.argv[2] ?? "screens";
const width = Number(process.argv[3] ?? 390);
const server = spawn("npx", ["vite", "preview", "--port", "4180", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const base = "http://localhost:4180/";
const browser = await chromium.launch();

try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
    const page = await ctx.newPage();
    const shot = (name, full = false) => page.screenshot({ path: `${out}/${scheme}-${width}-${name}.png`, fullPage: full });
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shot("01-welcome", true);
    await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
    await page.getByRole("link", { name: "Start herhalen" }).waitFor();
    await shot("02-home", true);
    await page.goto(base + "#/lijsten");
    await page.getByRole("heading", { name: "Lijsten" }).waitFor();
    await shot("03-lists", true);
    await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    await shot("04-deck", true);
    await page.getByRole("link", { name: /^Leren/ }).click();
    await page.locator(".qcard").waitFor();
    await page.waitForTimeout(300);
    await shot("05-learn-mc");
    // Answer the multiple choice question right.
    const answer = await page.evaluate(() => document.querySelector(".prompt")?.textContent ?? "");
    const map = { "la maison": "het huis", "le chien": "de hond", "l'école": "de school", "le livre": "het boek", "la fenêtre": "het raam", "le garçon": "de jongen", "la pomme": "de appel", "être": "zijn" };
    await page.getByRole("button", { name: map[answer.trim()] }).click();
    await page.waitForTimeout(400);
    await shot("06-learn-feedback");
    await page.goto(base + "#/oefenen/" + (await page.evaluate(() => location.hash.split("/")[2])) + "/typen/front/all");
    await page.locator(".answer-input").waitFor();
    await page.locator(".answer-input").fill("xyz");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await shot("07-type-wrong");
    await page.goto(base + "#/lijsten");
    await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
    await page.getByRole("link", { name: "Bewerken" }).first().click();
    await page.getByRole("heading", { name: "Lijst bewerken" }).waitFor();
    await shot("08-editor", true);
    await page.goto(base + "#/voortgang");
    await page.getByRole("heading", { name: "Voortgang" }).waitFor();
    await shot("09-progress", true);
    await page.goto(base + "#/nieuw");
    await shot("10-new");
    await page.goto(base + "#/foto");
    await page.getByRole("heading", { name: "Foto van je boek" }).waitFor();
    await shot("11-photo");
    await page.goto(base + "#/instellingen");
    await page.getByRole("heading", { name: "Instellingen" }).waitFor();
    await shot("12-settings", true);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
