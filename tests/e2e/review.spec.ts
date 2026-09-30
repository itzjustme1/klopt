import { expect, test } from "@playwright/test";
import { dayLabel, guard } from "./helpers";

const CARDS = [
  { front: "Wat is inflatie?", back: "Een stijging van het algemeen prijspeil.", grade: "goed", box: 2, days: 3 },
  { front: "Wat is de dekkingsbijdrage per product?", back: "Verkoopprijs min de variabele kosten per product.", grade: "fout", box: 1, days: 1 },
  { front: "Stack of queue: LIFO?", back: "Stack.", grade: "twijfel", box: 1, days: 1 },
] as const;
const KEY = { fout: "1", twijfel: "2", goed: "3" } as const;

test("create a deck, review with the keyboard, persist, work offline", async ({ page, context }) => {
  const check = await guard(page);
  await page.goto("/");

  // Empty state, then create a deck.
  await expect(page.getByRole("heading", { name: "Nog geen kaarten" })).toBeVisible();
  await page.getByRole("link", { name: "Stapel maken" }).click();
  await page.getByLabel("Naam").fill("Economie H5");
  await page.getByLabel("Schoolvak (optioneel)").fill("Economie");
  await page.getByRole("button", { name: "Stapel maken" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Economie H5" })).toBeVisible();

  // Three cards.
  for (const c of CARDS) {
    await page.getByLabel("Voorkant: vraag of term").fill(c.front);
    await page.getByLabel("Achterkant: antwoord of uitleg").fill(c.back);
    await page.getByRole("button", { name: "Toevoegen" }).click();
    await expect(page.locator(".cards .front", { hasText: c.front })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "3 kaarten" })).toBeVisible();

  // Home shows 3 due.
  await page.getByRole("navigation", { name: "Hoofdmenu" }).getByRole("link", { name: "Vandaag" }).click();
  await expect(page.locator(".hero .count")).toHaveText("3");
  await page.getByRole("link", { name: "Begin met overhoren" }).click();

  // Review entirely with the keyboard: Space flips, 1/2/3 grades.
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByText(`Kaart ${i} van 3`)).toBeVisible();
    const front = (await page.locator(".face.front .q").textContent())!.trim();
    const card = CARDS.find((c) => c.front === front)!;
    expect(card, `unknown card ${front}`).toBeTruthy();
    await expect(page.getByRole("button", { name: "Goed" })).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(page.locator(".face.back .a")).toHaveText(card.back);
    await page.keyboard.press(KEY[card.grade]);
    // Every card starts in box 1, so only goed moves it.
    const note = card.box === 1 ? "Blijft in vak 1" : `Naar vak ${card.box}`;
    await expect(page.locator(".note")).toHaveText(note);
  }

  // End screen.
  await expect(page.getByRole("heading", { name: "Klaar" })).toBeVisible();
  await expect(page.getByText("Je hebt 3 kaarten herhaald.")).toBeVisible();
  await expect(page.getByText("De kaart die fout ging, komt morgen terug.")).toBeVisible();

  // The cards moved to the right boxes with the right due dates.
  const assertBoxes = async () => {
    for (const c of CARDS) {
      const item = page.locator(".cards .card", { hasText: c.front });
      await expect(item.locator(".meta")).toHaveText(`Vak ${c.box}, weer op ${dayLabel(c.days)}`);
    }
  };
  await page.getByRole("link", { name: "Naar Vandaag" }).click();
  await expect(page.locator(".hero .count")).toHaveText("0");
  await page.getByRole("link", { name: "Economie H5" }).click();
  await assertBoxes();

  // Reload: data persisted in IndexedDB.
  await page.reload();
  await assertBoxes();

  // Offline: the service worker serves the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.goto("/#/stapels");
  await expect(page.getByRole("heading", { name: "Stapels" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Economie H5" })).toBeVisible();
  await context.setOffline(false);

  await check();
});
