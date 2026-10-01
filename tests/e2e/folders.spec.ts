import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("put lists and a quiz in a folder, move one out, rename and remove the folder", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();

  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Map" }).click();
  await page.getByLabel("Naam van de map").fill("WO2");
  await page.getByLabel(/WO2: begrippen/).check();
  await page.getByLabel(/WO2: oefentoets/).check();
  await page.getByRole("button", { name: "Map maken" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "WO2" })).toBeVisible();
  await expect(page.getByText("1 lijst · 1 quiz")).toBeVisible();

  // Move the French list in from its own page.
  await page.goto("/#/lijsten");
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Naar map verplaatsen" }).click();
  await page.getByRole("dialog").getByLabel("WO2").check();
  await page.getByRole("button", { name: "Verplaatsen" }).click();
  await expect(page.locator(".toast")).toHaveText("Verplaatst naar WO2.");

  await page.goto("/#/mappen");
  await expect(page.getByRole("link", { name: /WO2/ })).toContainText("2 lijsten · 1 quiz");
  await page.getByRole("link", { name: /WO2/ }).click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Naam wijzigen" }).click();
  await page.getByLabel("Naam van de map").fill("Geschiedenis H4");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Geschiedenis H4" })).toBeVisible();

  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Map opheffen" }).click();
  await page.getByRole("button", { name: "Ja, opheffen" }).click();
  await expect(page.getByText("Nog geen mappen.")).toBeVisible();
  // The lists themselves stay.
  await page.goto("/#/lijsten");
  await expect(page.getByRole("link", { name: /WO2: begrippen/ })).toBeVisible();
  await check();
});
