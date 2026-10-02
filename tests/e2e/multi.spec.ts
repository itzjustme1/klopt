import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("practise several lists together, and a whole folder", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();

  // Pick two lists on the Lists screen.
  await page.goto("/#/lijsten");
  await page.getByRole("button", { name: "Selecteren" }).click();
  await page.getByRole("checkbox", { name: /WO2: begrippen/ }).check();
  await page.getByRole("checkbox", { name: /Economie: begrippen/ }).check();
  await page.getByRole("button", { name: "Oefen 2 lijsten" }).click();
  const sheet = page.getByRole("dialog", { name: "Oefen met" });
  await expect(sheet).toContainText("11 woorden uit 2 lijsten");
  await sheet.getByRole("link", { name: /^Flashcards/ }).click();
  for (let i = 0; i < 11; i++) {
    await expect(page.locator(".flip:not(.flipped)")).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("2");
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await page.getByRole("link", { name: "Terug naar je lijsten" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lijsten" })).toBeVisible();

  // Put both in a folder and practise the folder.
  for (const name of ["WO2: begrippen", "Economie: begrippen"]) {
    await page.getByRole("button", { name: `Opties voor ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Naar map/ }).click();
    const picker = page.getByRole("dialog");
    const existing = picker.getByRole("radio", { name: "Toets 1" });
    if (await existing.count()) await existing.check();
    else {
      await picker.getByRole("radio", { name: "Nieuwe map…" }).check();
      await picker.getByRole("textbox").fill("Toets 1");
    }
    await picker.getByRole("button", { name: "Verplaatsen", exact: true }).click();
    await expect(page.locator(".toast")).toContainText("Toets 1");
  }
  await page.goto("/#/map/Toets%201");
  await page.getByRole("button", { name: "Oefen deze map" }).click();
  await expect(page.getByRole("dialog", { name: "Oefen met" })).toContainText("11 woorden uit 2 lijsten");
  await page.getByRole("dialog").getByRole("link", { name: /^Meerkeuze/ }).click();
  await expect(page.locator(".options")).toBeVisible();
  await page.getByRole("link", { name: "Stoppen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Toets 1" })).toBeVisible();
  await check();
});
