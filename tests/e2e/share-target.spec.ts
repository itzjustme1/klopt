import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("text shared from another app opens in the paste screen", async ({ page }) => {
  const check = await guard(page);
  const shared = "la maison\thet huis\nle chien\tde hond\n<b>vet</b>\tgewoon";
  await page.goto(`/?title=Quizlet&text=${encodeURIComponent(shared)}`);
  await expect(page.getByRole("heading", { name: "Lijst plakken" })).toBeVisible();
  await expect(page.getByText("Gedeeld vanuit een andere app.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Je lijst")).toHaveValue(shared);
  await expect(page.getByText("3 woorden herkend")).toBeVisible();
  // The query is gone from the address bar, so a reload doesn't import twice.
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("#/importeren");
  await check();
});
