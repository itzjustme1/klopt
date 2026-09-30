import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("share a deck by link and open it", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer een voorbeeldstapel" }).click();
  await page.getByRole("link", { name: "Voorbeeldstapel" }).click();
  await page.getByRole("link", { name: "Delen" }).click();
  await expect(page.getByRole("heading", { name: "Stapel delen" })).toBeVisible();
  const link = await page.getByLabel("Deellink").inputValue();
  expect(link).toMatch(/^http:\/\/localhost:4173\/#\/deel\/[A-Za-z0-9_-]+$/);
  expect(link.length).toBeLessThan(8100);

  // Open the link: preview first, nothing is added until the student agrees.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Gedeelde stapel" })).toBeVisible();
  await expect(page.getByText("Wat is de dekkingsbijdrage per product?")).toBeVisible();
  await page.getByRole("button", { name: "Toevoegen aan mijn stapels" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Voorbeeldstapel" })).toBeVisible();
  await page.goto("/#/stapels");
  await expect(page.getByRole("link", { name: "Voorbeeldstapel" })).toHaveCount(2);

  // A damaged link is refused.
  await page.goto(link.slice(0, -12) + "AAAAAAAAAAAA");
  await expect(page.getByRole("alert")).toHaveText("Deze link is ongeldig of beschadigd. Vraag om een nieuwe link of om het bestand.");

  await check();
});

test("backup reminder after 50 new cards", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill(Array.from({ length: 50 }, (_, i) => `term ${i};uitleg ${i}`).join("\n"));
  await page.getByLabel("Naam van de nieuwe stapel").fill("Veel");
  await page.getByRole("button", { name: "50 kaarten importeren" }).click();
  await expect(page.getByText("50 kaarten toegevoegd")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Je hebt 50 kaarten gemaakt of aangepast sinds je laatste back-up.")).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByText(/sinds je laatste back-up/)).toHaveCount(0);
  await check();
});
