import { expect, test } from "@playwright/test";
import { answerFor, createFrenchList, dayLabel, guard, practise } from "./helpers";

test("make a list, learn it with the keyboard, persist, work offline", async ({ page, context }) => {
  const check = await guard(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welkom bij Klopt" })).toBeVisible();
  await createFrenchList(page);
  await expect(page.getByText("4 woorden").first()).toBeVisible();

  // Leren: multiple choice first, then typing. "le chien" is answered wrong once and has to come back.
  await practise(page, /^Leren/);
  const seen = new Map<string, number>();
  for (let step = 0; step < 30; step++) {
    if (await page.getByRole("heading", { name: "Klaar!" }).isVisible()) break;
    const prompt = (await page.locator(".prompt").first().textContent())!.trim();
    const n = (seen.get(prompt) ?? 0) + 1;
    seen.set(prompt, n);
    const wrongOnPurpose = prompt === "le chien" && n === 1;
    if (await page.locator(".options").isVisible()) {
      const options = await page.locator(".option .opt-text").allTextContents();
      const right = options.findIndex((o) => o === answerFor(prompt));
      const pick = wrongOnPurpose ? (right + 1) % options.length : right;
      await page.keyboard.press(String(pick + 1));
    } else {
      await expect(page.locator(".answer-input")).toBeFocused();
      await page.keyboard.type(wrongOnPurpose ? "de kat" : answerFor(prompt));
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(".sheet")).toBeVisible();
    await expect(page.locator(".sheet-title")).toHaveText(wrongOnPurpose ? "Niet goed" : "Goed zo!");
    await page.keyboard.press("Enter");
    if (wrongOnPurpose) await expect(page.locator(".c-wrong")).toHaveText("1");
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await expect(page.getByText("3 van 4 in één keer goed")).toBeVisible();
  // Counters updated during the session: 1 wrong, and every question after that right.
  await expect(page.locator(".c-wrong")).toHaveCount(0);
  await expect(page.locator(".mistakes")).toContainText("le chien");
  expect(seen.get("le chien")).toBeGreaterThanOrEqual(3);

  // Only the first answer of today counted: le chien in box 1 (tomorrow), the rest in box 2 (in 3 days).
  await page.getByRole("link", { name: "Terug naar de lijst" }).click();
  const legend = page.getByRole("list", { name: "Kaarten per vak" });
  await expect(legend.locator("li").nth(0).locator(".num")).toHaveText("1");
  await expect(legend.locator("li").nth(1).locator(".num")).toHaveText("3");
  // Wrong once and then right: "sometimes wrong", not "often wrong".
  await expect(page.locator(".diff .d-soms .d-num")).toHaveText("1");
  await expect(page.locator(".diff .d-goed .d-num")).toHaveText("3");

  // Home shows the streak and the answers for today.
  await page.getByRole("link", { name: "Vandaag", exact: true }).click();
  await expect(page.getByRole("link", { name: "1 dag op rij" })).toBeVisible();
  await expect(page.getByText("Alles herhaald voor vandaag.")).toBeVisible();
  await expect(page.getByText(`Je volgende kaarten komen op ${dayLabel(1)}.`)).toBeVisible();

  // Reload: everything persisted in IndexedDB.
  await page.reload();
  await expect(page.getByRole("link", { name: "1 dag op rij" })).toBeVisible();

  // Offline: the service worker serves the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.goto("/#/lijsten");
  await expect(page.getByRole("heading", { name: "Lijsten" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Frans H1/ })).toBeVisible();
  await context.setOffline(false);

  await check();
});

test("review the daily queue by keyboard, typing short answers and self-checking long ones", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await expect(page.locator(".hero-num")).toHaveText("11");
  await page.getByRole("link", { name: "Start herhalen" }).click();

  const french: Record<string, string> = {
    "la maison": "het huis",
    "le chien": "de hond",
    "l'école": "de school",
    "le livre": "het boek",
    "la fenêtre": "het raam",
    "le garçon": "de jongen",
    "la pomme": "de appel",
    "être": "zijn",
  };
  let typed = 0;
  let flipped = 0;
  for (let step = 0; step < 30; step++) {
    // Wait for the next question (or the end) to be on screen before reading it.
    await expect(page.locator(".flip:not(.flipped), .answer-input:not([readonly]), .results").first()).toBeVisible();
    if (await page.locator(".results").isVisible()) break;
    if (await page.locator(".flip").isVisible()) {
      await page.keyboard.press("Space");
      await expect(page.locator(".flip.flipped")).toBeVisible();
      await page.keyboard.press("3");
      await expect(page.locator(".flip.flipped")).toHaveCount(0);
      flipped++;
    } else {
      const prompt = (await page.locator(".prompt").first().textContent())!.trim();
      expect(french[prompt], `unexpected prompt ${prompt}`).toBeDefined();
      await page.keyboard.type(french[prompt]!);
      await page.keyboard.press("Enter");
      await expect(page.locator(".sheet-title")).toHaveText("Goed zo!");
      await page.keyboard.press("Enter");
      await expect(page.locator(".sheet")).toHaveCount(0);
      typed++;
    }
  }
  expect(typed).toBe(8);
  expect(flipped).toBe(3);
  await expect(page.getByText("Alles in één keer goed. Sterk.")).toBeVisible();
  await page.getByRole("link", { name: "Terug naar Vandaag" }).click();
  await expect(page.getByText("Alles herhaald voor vandaag.")).toBeVisible();
  await check();
});

test("a test gives a Dutch grade", async ({ page }) => {
  const check = await guard(page);
  await createFrenchList(page, "Toetslijst");
  await practise(page, "Toets");
  for (let i = 0; i < 4; i++) {
    await expect(page.getByText(`Vraag ${i + 1} van 4`)).toBeVisible();
    await expect(page.locator(".answer-input")).toBeFocused();
    const prompt = (await page.locator(".prompt").first().textContent())!.trim();
    // Two right, one with a typo (half a point), one wrong.
    const answer = i < 2 ? answerFor(prompt) : i === 2 ? answerFor(prompt).slice(0, -1) : "weet niet";
    await page.keyboard.type(answer);
    await page.keyboard.press("Enter");
    // No feedback during a test.
    await expect(page.locator(".sheet")).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Je cijfer" })).toBeVisible();
  // (1 + 1 + 0.5 + 0) / 4 = 0.625, so 1 + 9 x 0.625 = 6.6.
  await expect(page.locator(".cijfer")).toHaveText("6,6");
  await expect(page.locator(".mistakes li")).toHaveCount(2);
  await check();
});
