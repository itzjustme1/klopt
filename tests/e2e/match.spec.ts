import { expect, test } from "@playwright/test";
import { guard, practise } from "./helpers";

const PAIRS: Record<string, string> = {
  "la maison": "het huis",
  "le chien": "de hond",
  "l'école": "de school",
  "le livre": "het boek",
  "la fenêtre": "het raam",
  "le garçon": "de jongen",
  "la pomme": "de appel",
  être: "zijn",
};

test("match words to translations over two rounds, with a timer and a record", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  await practise(page, /^Koppelen/);
  await expect(page.getByText("Ronde 1 van 2")).toBeVisible();

  const playRound = async (withMistake: boolean) => {
    const tiles = page.locator(".tile:not(.gone)");
    const texts = await tiles.allTextContents();
    const fronts = texts.filter((x) => x in PAIRS);
    if (withMistake) {
      const [a, b] = fronts;
      await page.getByRole("button", { name: a, exact: true }).click();
      await page.getByRole("button", { name: PAIRS[b!], exact: true }).click();
      await expect(page.locator(".tile.wrong")).toHaveCount(2);
    }
    for (const f of fronts) {
      await page.getByRole("button", { name: f, exact: true }).click();
      await page.getByRole("button", { name: PAIRS[f], exact: true }).click();
    }
  };

  await playRound(true);
  await page.getByRole("button", { name: "Volgende ronde" }).click();
  await expect(page.getByText("Ronde 2 van 2")).toBeVisible();
  await playRound(false);

  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await expect(page.getByText(/^Alles gekoppeld in \d+,\d seconden\.$/)).toBeVisible();
  await expect(page.getByText("1 keer fout gekoppeld")).toBeVisible();
  await expect(page.getByText(/^Record: \d+,\d seconden$/)).toBeVisible();

  // Every pair was logged: the list now shows practised words.
  await page.getByRole("link", { name: "Terug naar de lijst" }).click();
  await expect(page.locator(".diff .d-nieuw .d-num")).toHaveText("0");
  await check();
});
