import { expect, test } from "@playwright/test";
import { dayISO, guard } from "./helpers";

test("a test date turns into a daily plan on the list, home and progress screens", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill(Array.from({ length: 12 }, (_, i) => `term ${i + 1};uitleg ${i + 1}`).join("\n"));
  await page.getByLabel("Naam van de nieuwe lijst").fill("Hoofdstuk 4");
  await page.getByRole("button", { name: "12 woorden toevoegen" }).click();
  await page.getByRole("link", { name: "Naar de lijst" }).click();

  // No date yet: a link to set one.
  await page.getByRole("link", { name: "Wanneer is je toets?" }).click();
  await page.getByLabel("Toetsdatum (optioneel)").fill(dayISO(-1));
  await page.getByRole("button", { name: "Lijst opslaan" }).click();
  await expect(page.getByRole("alert")).toContainText("Die datum is al geweest.");
  await page.getByLabel("Toetsdatum (optioneel)").fill(dayISO(3));
  await page.getByRole("button", { name: "Lijst opslaan" }).click();

  // 12 words over 3 days: 4 a day, but at least 5.
  await expect(page.getByText("Toets over 3 dagen")).toBeVisible();
  await expect(page.getByText("Oefen vandaag 5 woorden. Nog 12 woorden te leren.")).toBeVisible();
  await expect(page.getByText("0 van 5 vandaag geoefend")).toBeVisible();

  // Practise from the plan: Leren with a round of 10, then the plan counts what was done.
  await page.locator(".exam").getByRole("link", { name: "Oefenen" }).click();
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("heading", { name: "Klaar!" }).isVisible()) break;
    await expect(page.locator(".qcard .flip:not(.flipped), .qcard .options, .answer-input:not([readonly]), .results").first()).toBeVisible();
    if (await page.locator(".results").isVisible()) break;
    if (await page.locator(".qcard .options").isVisible()) {
      const prompt = (await page.locator(".prompt").first().textContent())!.trim();
      await page.locator(".option", { hasText: new RegExp(`^\\d?\\s*${prompt.replace("term", "uitleg")}$`) }).click();
      await expect(page.locator(".sheet")).toBeVisible();
      await page.getByRole("button", { name: "Volgende" }).click();
    } else {
      const prompt = (await page.locator(".prompt").first().textContent())!.trim();
      await page.keyboard.type(prompt.replace("term", "uitleg"));
      await page.keyboard.press("Enter");
      await expect(page.locator(".sheet")).toBeVisible();
      await page.keyboard.press("Enter");
    }
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await page.getByRole("link", { name: "Terug naar de lijst" }).click();
  await expect(page.getByText("5 van 5 vandaag geoefend")).toBeVisible();
  await expect(page.getByText("Nog 2 woorden te leren.")).toBeVisible();

  // Home lists the test.
  await page.getByRole("link", { name: "Vandaag", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Toetsen" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Hoofdstuk 4 Nog/ })).toBeVisible();

  // Progress shows what comes back in the next week: the 10 practised words, tomorrow and later.
  await page.getByRole("link", { name: "Voortgang" }).click();
  await expect(page.getByRole("heading", { name: "Komende 7 dagen" })).toBeVisible();
  await expect(page.locator(".fc-num").first()).toHaveText("2");
  await check();
});
