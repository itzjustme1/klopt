import AxeBuilder from "@axe-core/playwright";
import { practise } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const issues = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(issues).toEqual([]);
}

/** No horizontal page scroll, and every visible control is at least 44 by 44 px. */
async function layout(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a.btn, .nav a, input[type=radio], select, input[type=text], input[type=search], textarea")]
      .filter((el) => el.offsetParent !== null || el.matches("input[type=radio]"))
      .map((el) => {
        const target = el.matches("input[type=radio]") ? (el.closest("label") as HTMLElement) : el;
        const r = target.getBoundingClientRect();
        return { text: (target.textContent || target.getAttribute("aria-label") || target.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((b) => b.w > 0 && (b.h < 44 || b.w < 44)),
  );
  expect(small, `${label}: tap targets under 44px`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`accessibility and layout at 360px, ${scheme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: scheme, locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
    const page = await ctx.newPage();
    const base = "http://localhost:4173/";
    const check = async (label: string) => {
      await page.waitForTimeout(450); // let the flip, sheet and toast animations settle
      await audit(page, `${scheme} ${label}`);
      await layout(page, `${scheme} ${label}`);
    };

    await page.goto(base);
    await page.getByRole("heading", { name: "Welkom bij Klopt" }).waitFor();
    // The app is navy by default, also on a light device; light is a choice in the settings.
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    if (scheme === "light") {
      await page.goto(base + "#/instellingen");
      await page.getByText("Licht", { exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.getByRole("link", { name: "Vandaag", exact: true }).click();
      await page.getByRole("heading", { name: "Welkom bij Klopt" }).waitFor();
    }
    await check("welcome");
    await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
    await page.locator(".hero-num").waitFor();
    // The button sits below the fold; the new home screen starts at the top, focus on its heading.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await check("today");
    await page.goto(base + "#/lijsten");
    await check("lists");
    await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    // Test date and a starred word, so the plan and stars are audited too.
    await page.getByRole("link", { name: "Wanneer is je toets?" }).click();
    await page.getByLabel("Toetsdatum (optioneel)").fill(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(Date.now() + 3 * 86_400_000)));
    await page.getByRole("button", { name: "Lijst opslaan" }).click();
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    await page.getByRole("button", { name: "la maison markeren" }).click();
    await check("list");
    await practise(page, /^Leren/);
    await page.locator(".options").waitFor();
    await check("learn: multiple choice");
    await page.keyboard.press("1");
    await page.locator(".sheet").waitFor();
    await check("learn: feedback");
    const deckHash = await page.evaluate(() => location.hash.split("/")[2]);
    await page.goto(`${base}#/oefenen/${deckHash}/typen/front/all`);
    await page.locator(".answer-input").waitFor();
    await check("type");
    await page.keyboard.type("xyz");
    await page.keyboard.press("Enter");
    await page.locator(".sheet").waitFor();
    await check("type: wrong");
    // Confirm the answer so the session is saved for the resume prompt below.
    await page.keyboard.press("Enter");
    await page.locator(".sheet").waitFor({ state: "detached" });
    await page.goto(`${base}#/oefenen/${deckHash}/flashcards/front/all`);
    await page.locator(".flip").waitFor();
    await check("flashcards");
    await page.goto(`${base}#/oefenen/${deckHash}/typen/front/all`);
    await page.getByRole("heading", { name: "Verder waar je was?" }).waitFor();
    await check("resume prompt");
    await page.goto(`${base}#/oefenen/${deckHash}/koppelen/front/all`);
    await page.locator(".tile").first().waitFor();
    await page.locator(".tile").first().click();
    await check("match");
    await page.goto(base);
    await page.locator(".continue").waitFor();
    await check("today with plan and continue card");
    await page.goto(base + "#/uitleg");
    await page.getByRole("heading", { name: "Hoe werkt Klopt?" }).waitFor();
    await check("help");
    await page.goto(`${base}#/lijst/${deckHash}/bewerken`);
    await page.getByRole("heading", { name: "Lijst bewerken" }).waitFor();
    await check("editor");
    await page.goto(`${base}#/lijst/${deckHash}/delen`);
    await page.getByLabel("Deellink").waitFor();
    await check("share");
    await page.goto(base + "#/voortgang");
    await check("progress");
    await page.goto(base + "#/nieuw");
    await check("new list");
    await page.goto(base + "#/foto");
    await check("photo");
    await page.goto(base + "#/importeren");
    await page.getByLabel("Je lijst").fill("a;b\nzonder\nc\td");
    await check("import");
    await page.goto(base + "#/instellingen");
    await check("settings");
    await page.getByText("English", { exact: true }).click();
    await page.goto(base);
    await check("today en");
    await ctx.close();
  });
}

// On a laptop the navigation sits in the blue band, so it gets its own pass in both themes.
test("accessibility on a laptop screen, light and dark", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  const page = await ctx.newPage();
  const base = "http://localhost:4173/";
  await page.goto(base);
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();
  for (const theme of ["Licht", "Donker"]) {
    await page.goto(base + "#/instellingen");
    await page.getByText(theme, { exact: true }).click();
    const screens: [string, string][] = [
      ["today", ""],
      ["lists", "#/lijsten"],
      ["progress", "#/voortgang"],
      ["settings", "#/instellingen"],
    ];
    for (const [label, hash] of screens) {
      await page.goto(base + hash);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.waitForTimeout(300);
      await audit(page, `${theme} 1280 ${label}`);
    }
    await page.goto(base + "#/lijsten");
    await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
    await page.getByRole("heading", { name: "Frans: basiswoorden" }).waitFor();
    await page.waitForTimeout(300); // let the nav colour transition finish
    await audit(page, `${theme} 1280 list`);
  }
  await ctx.close();
});

test("reduced motion: the flashcard swaps without rotating", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 800 }, locale: "nl-NL" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  await practise(page, /^Flashcards/);
  await page.locator(".flip").waitFor();
  await page.keyboard.press("Space");
  await expect(page.locator(".flip.flipped")).toHaveCount(1);
  const t = await page.locator(".face.back").evaluate((el) => getComputedStyle(el).transform);
  expect(t).toBe("none");
  await expect(page.locator(".face.back")).toBeVisible();
  await expect(page.locator(".face.front")).toBeHidden();
  await ctx.close();
});

test("a very long word never widens the page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: "nl-NL" });
  const page = await ctx.newPage();
  const long = "Donaudampfschifffahrtsgesellschaftskapitänswitwe".repeat(3);
  const noOverflow = async (label: string) => {
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, label).toBeLessThanOrEqual(0);
  };
  await page.goto("http://localhost:4173/#/importeren");
  await page.getByLabel("Je lijst").fill(`${long};${long}\nkort;${long}`);
  await page.getByLabel("Naam van de nieuwe lijst").fill(long);
  await noOverflow("import preview");
  await page.getByRole("button", { name: "2 woorden toevoegen" }).click();
  await page.getByRole("link", { name: "Naar de lijst" }).click();
  await noOverflow("list page");
  await page.goto("http://localhost:4173/#/lijsten");
  await noOverflow("lists");
  await page.goto("http://localhost:4173/");
  await noOverflow("today");
  await page.getByRole("link", { name: "Start herhalen" }).click();
  await page.locator(".qcard").waitFor();
  await noOverflow("practice");
  await ctx.close();
});
