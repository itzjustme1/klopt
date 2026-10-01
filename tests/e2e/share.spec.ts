import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("share a list by link and open it", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  await expect(page.getByRole("heading", { name: "Lijst delen" })).toBeVisible();
  const link = await page.getByLabel("Deellink").inputValue();
  expect(link).toMatch(/^http:\/\/localhost:4173\/#\/deel\/[A-Za-z0-9_-]+$/);
  expect(link.length).toBeLessThan(8100);

  // Open the link: preview first, nothing is added until the student agrees.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Gedeelde lijst" })).toBeVisible();
  await expect(page.getByText("la fenêtre")).toBeVisible();
  await page.getByRole("button", { name: "Toevoegen aan mijn lijsten" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Frans: basiswoorden" })).toBeVisible();
  await page.goto("/#/lijsten");
  await expect(page.getByRole("link", { name: /Frans: basiswoorden/ })).toHaveCount(2);

  // A damaged link is refused.
  await page.goto(link.slice(0, -12) + "AAAAAAAAAAAA");
  await expect(page.getByRole("alert")).toHaveText("Deze link is ongeldig of beschadigd. Vraag om een nieuwe link of om het bestand.");

  await check();
});

test("backup reminder after 50 new words", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill(Array.from({ length: 50 }, (_, i) => `term ${i};uitleg ${i}`).join("\n"));
  await page.getByLabel("Naam van de nieuwe lijst").fill("Veel");
  await page.getByRole("button", { name: "50 woorden toevoegen" }).click();
  await expect(page.getByText("50 woorden toegevoegd")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Je hebt 50 woorden gemaakt of aangepast sinds je laatste back-up.")).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByText(/sinds je laatste back-up/)).toHaveCount(0);
  await check();
});
