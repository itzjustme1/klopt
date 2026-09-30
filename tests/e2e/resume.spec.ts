import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

const NL: Record<string, string> = {
  "la maison": "het huis",
  "le chien": "de hond",
  "l'école": "de school",
  "le livre": "het boek",
  "la fenêtre": "het raam",
  "le garçon": "de jongen",
  "la pomme": "de appel",
  être: "zijn",
};

test("leave a session halfway and continue it later", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  const listUrl = page.url();
  await page.getByRole("link", { name: /^Typen/ }).click();

  const answer = async () => {
    await expect(page.locator(".answer-input:not([readonly])")).toBeFocused();
    const prompt = (await page.locator(".prompt").first().textContent())!.trim();
    await page.keyboard.type(NL[prompt]!);
    await page.keyboard.press("Enter");
    await expect(page.locator(".sheet-title")).toHaveText("Goed zo!");
    await page.keyboard.press("Enter");
  };
  await answer();
  await answer();
  await answer();
  await expect(page.locator(".c-right")).toHaveText("3");

  // Leave, even reload the app, then come back to the same practice.
  await page.getByRole("link", { name: "Stoppen" }).click();
  await page.reload();
  await page.goto(listUrl);
  await page.getByRole("link", { name: /^Typen/ }).click();
  await expect(page.getByRole("heading", { name: "Verder waar je was?" })).toBeVisible();
  await expect(page.getByText("Je was hier nog mee bezig. Nog 5 woorden te gaan.")).toBeVisible();
  await page.getByRole("button", { name: "Verder waar je was" }).click();
  await expect(page.locator(".c-right")).toHaveText("3");
  for (let i = 0; i < 5; i++) await answer();
  await expect(page.getByText("Alles in één keer goed. Sterk.")).toBeVisible();

  // Finished sessions are not offered again.
  await page.getByRole("link", { name: "Terug naar de lijst" }).click();
  await page.getByRole("link", { name: /^Typen/ }).click();
  await expect(page.locator(".answer-input")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verder waar je was?" })).toHaveCount(0);
  await check();
});
