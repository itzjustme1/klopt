import { expect, test } from "@playwright/test";
import { VERB_SETS } from "../../src/lib/verbsets";
import { answerFor, createFrenchList, guard, openPractice, practise } from "./helpers";

test("add a ready-made verb set and drill its forms", async ({ page }) => {
  const check = await guard(page);
  const set = VERB_SETS.find((s) => s.id === "fr-present")!;
  await page.goto("/");
  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog", { name: "Nieuwe lijst" }).getByRole("link", { name: "Werkwoorden (kant-en-klaar)" }).click();
  await expect(page.getByRole("heading", { name: "Kant-en-klare rijtjes" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Frans: présent" }).getByRole("button", { name: "Toevoegen" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Frans: présent" })).toBeVisible();
  // Adding it again is not possible: it links to the list instead.
  await page.goto("/#/rijtjes");
  await expect(page.getByRole("listitem").filter({ hasText: "Frans: présent" }).getByRole("link", { name: "Al toegevoegd" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Frans: présent" }).getByRole("link", { name: "Al toegevoegd" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Frans: présent" })).toBeVisible();
  const menu = await openPractice(page);
  await expect(menu.getByRole("link", { name: /^Rijtjes/ })).toContainText("AANBEVOLEN");
  await menu.getByRole("link", { name: /^Rijtjes/ }).click();

  // First row: everything right.
  const verb = (await page.locator(".verb").textContent())!.trim();
  const row = set.verbs.find((v) => v.verb === verb)!;
  for (let i = 0; i < set.columns.length; i++) await page.getByLabel(set.columns[i]!, { exact: true }).fill(row.forms[i]!);
  await page.getByRole("button", { name: "Controleer" }).click();
  await expect(page.getByRole("status")).toContainText("Goed zo!");
  await page.getByRole("button", { name: "Volgende" }).click();

  // Second row: one form wrong, so it shows the right form and counts as almost.
  const verb2 = (await page.locator(".verb").textContent())!.trim();
  expect(verb2).not.toBe(verb);
  const row2 = set.verbs.find((v) => v.verb === verb2)!;
  for (let i = 0; i < set.columns.length; i++) await page.getByLabel(set.columns[i]!, { exact: true }).fill(i === 3 ? "fout" : row2.forms[i]!);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Bijna");
  await expect(page.locator(".right-form")).toHaveText(row2.forms[3]!);
  await check();
});

test("spell words from letter tiles, by tapping and by keyboard", async ({ page }) => {
  const check = await guard(page);
  await createFrenchList(page);
  await practise(page, /^Spelling/);
  for (let n = 0; n < 4; n++) {
    const prompt = (await page.locator(".prompt").first().textContent())!.trim();
    const answer = answerFor(prompt);
    const letters = [...answer].filter((c) => c !== " ");
    const tiles = page.getByRole("group", { name: "Bouw het antwoord met de letters" });
    await expect(tiles.getByRole("button")).toHaveCount(letters.length);
    // The first letter by tapping, a wrong one undone, the rest typed.
    await tiles.getByRole("button", { name: letters[0], exact: true }).and(page.locator(":enabled")).first().click();
    if (n === 0) {
      const other = letters.slice(1).find((c) => c !== letters[1]);
      if (other) {
        await page.keyboard.type(other);
        await page.getByRole("button", { name: "Letter terug" }).click();
      }
    }
    await page.keyboard.type(letters.slice(1).join(""));
    await expect(page.getByRole("status")).toContainText("Goed zo!");
    await page.getByRole("button", { name: "Volgende" }).click();
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await check();
});
