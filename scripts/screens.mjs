// Screenshots of every screen, light and dark.
// Run: npm run build && node scripts/screens.mjs <outdir> [width]
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const out = process.argv[2] ?? "screens";
const width = Number(process.argv[3] ?? 390);
const server = spawn("npx", ["vite", "preview", "--port", "4180", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const base = "http://localhost:4180/";
const browser = await chromium.launch();

function iso(offset) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Amsterdam" }).format(d);
}

try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
    const page = await ctx.newPage();
    const shot = (name, full = false) => page.screenshot({ path: `${out}/${scheme}-${width}-${name}.png`, fullPage: full });
    if (scheme === "dark") {
      // Light is the default; dark is chosen in the settings.
      await page.goto(base + "#/instellingen");
      await page.getByText("Donker", { exact: true }).click();
      await page.getByRole("link", { name: "Vandaag", exact: true }).click();
    } else {
      await page.goto(base);
    }
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shot("01-welcome", true);
    await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
    await page.getByRole("link", { name: "Start herhalen" }).waitFor();

    // Give the French list a test date so the plan shows up everywhere.
    await page.goto(base + "#/lijsten");
    await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
    const deckHash = await page.evaluate(() => location.hash);
    await page.getByRole("link", { name: "Toetsdatum instellen" }).click();
    await page.getByLabel("Toetsdatum (optioneel)").fill(iso(4));
    await page.getByRole("button", { name: "Lijst opslaan" }).click();
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    await page.getByRole("button", { name: "la maison markeren" }).click();

    // Leave a typing session halfway, for the continue card and prompt.
    const deckId = deckHash.split("/")[2];
    await page.goto(`${base}#/oefenen/${deckId}/typen/front/all`);
    await page.locator(".answer-input").waitFor();
    await page.keyboard.type("xyz");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    await page.goto(base);
    await page.locator(".hero-num").waitFor();
    await shot("02-home", true);
    await page.goto(base + "#/lijsten");
    await shot("03-lists", true);
    await page.goto(base + deckHash);
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    await shot("04-list", true);
    await page.goto(`${base}#/oefenen/${deckId}/typen/front/all`);
    await page.getByRole("heading", { name: "Verder waar je was?" }).waitFor();
    await shot("05-resume");
    await page.goto(`${base}#/oefenen/${deckId}/leren/front/all`);
    await page.locator(".qcard .options").waitFor();
    await shot("06-learn-mc");
    await page.keyboard.press("1");
    await page.locator(".sheet").waitFor();
    await page.waitForTimeout(350);
    await shot("07-learn-feedback");
    await page.goto(`${base}#/oefenen/${deckId}/flashcards/front/all`);
    await page.locator(".flip").waitFor();
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await shot("08-flashcard");
    await page.goto(`${base}#/oefenen/${deckId}/koppelen/front/all`);
    await page.locator(".tile").first().waitFor();
    await page.locator(".tile").first().click();
    await shot("09-match");
    await page.goto(`${base}#/oefenen/${deckId}/toets/front/all`);
    await page.locator(".answer-input").waitFor();
    await shot("10-test");
    await page.goto(base + deckHash.replace(/$/, "/delen"));
    await page.getByLabel("Deellink").waitFor();
    await shot("11-share", true);
    await page.goto(base + deckHash + "/bewerken");
    await page.getByRole("heading", { name: "Lijst bewerken" }).waitFor();
    await shot("12-editor", true);
    await page.goto(base + "#/voortgang");
    await page.getByRole("heading", { name: "Voortgang" }).waitFor();
    await shot("13-progress", true);
    await page.goto(base + "#/nieuw");
    await shot("14-new");
    await page.goto(base + "#/foto");
    await page.getByRole("heading", { name: "Foto van je boek" }).waitFor();
    await shot("15-photo");
    await page.goto(base + "#/importeren");
    await page.getByLabel("Je lijst").fill("la maison\thet huis\nle chien;de hond\nzonder scheiding");
    await page.waitForTimeout(300);
    await shot("16-import", true);
    await page.goto(base + "#/instellingen");
    await page.getByRole("heading", { name: "Instellingen" }).waitFor();
    await shot("17-settings", true);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
