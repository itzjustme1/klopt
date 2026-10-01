import { expect, test } from "@playwright/test";
import { guard, openPractice } from "./helpers";

test("make a term list for history and learn it with flashcards", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  // From the "Nieuw" menu.
  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog", { name: "Nieuwe lijst" }).getByRole("link", { name: "Begrippenlijst" }).click();
  await expect(page.getByRole("heading", { name: "Nieuwe begrippenlijst" })).toBeVisible();
  await expect(page.getByLabel("Begrippen")).toBeChecked();
  await expect(page.getByLabel("Taal links")).toBeHidden();

  await page.getByLabel("Naam van de lijst").fill("WO2");
  await page.getByLabel("Vak", { exact: true }).fill("Geschiedenis");
  await page.getByLabel("Rij 1, Begrip").fill("Blitzkrieg");
  await page.getByLabel("Rij 1, Uitleg").fill("Een snelle aanval met tanks en vliegtuigen tegelijk.");
  await page.getByLabel("Rij 2, Begrip").fill("Collaboratie");
  // Shift+Enter keeps writing on a new line inside the explanation.
  await page.getByLabel("Rij 2, Uitleg").click();
  await page.keyboard.type("Samenwerken");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("met de bezetter.");
  await page.getByRole("button", { name: "Lijst opslaan" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "WO2" })).toBeVisible();
  await expect(page.getByText("Geschiedenis · 2 begrippen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Begrippen" })).toBeVisible();
  await expect(page.locator(".w-back").nth(1)).toHaveText("Samenwerken\nmet de bezetter.");

  const menu = await openPractice(page);
  await expect(menu.getByRole("link", { name: /^Flashcards/ })).toContainText("AANBEVOLEN");
  await expect(menu.getByRole("link", { name: /^Dictee/ })).toHaveCount(0);
  await menu.getByRole("link", { name: /^Flashcards/ }).click();
  for (let i = 0; i < 2; i++) {
    await expect(page.locator(".flip:not(.flipped)")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator(".flip.flipped")).toBeVisible();
    await page.keyboard.press("2");
    await expect(page.locator(".flip.flipped")).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await check();
});
