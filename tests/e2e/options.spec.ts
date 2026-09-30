import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("choose how many words, star words, practise only starred ones", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill(Array.from({ length: 24 }, (_, i) => `woord ${i + 1};betekenis ${i + 1}`).join("\n"));
  await page.getByLabel("Naam van de nieuwe lijst").fill("Groot");
  await page.getByRole("button", { name: "24 woorden toevoegen" }).click();
  await page.getByRole("link", { name: "Naar de lijst" }).click();

  // Search within the list.
  await page.getByLabel("Zoek in deze lijst").fill("woord 2");
  await expect(page.locator(".word")).toHaveCount(6); // woord 2, 20-24
  await page.getByLabel("Zoek in deze lijst").fill("bestaat niet");
  await expect(page.getByText('Geen woorden gevonden voor "bestaat niet".')).toBeVisible();
  await page.getByLabel("Zoek in deze lijst").fill("");
  await expect(page.locator(".word")).toHaveCount(24);

  // Big lists start with a round of 20; pick 10 and take a test.
  const counts = page.getByRole("group", { name: "Aantal woorden" });
  await expect(counts.getByLabel("20")).toBeChecked();
  await counts.getByText("10", { exact: true }).click();
  await page.getByRole("link", { name: /^Toets / }).click();
  await expect(page.getByText("Vraag 1 van 10")).toBeVisible();
  await page.getByRole("link", { name: "Stoppen" }).click();

  // Star one word; "Gemarkeerd" becomes available and holds exactly that word.
  await page.getByRole("button", { name: "woord 3 markeren" }).click();
  await expect(page.getByRole("button", { name: "Markering bij woord 3 weghalen" })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Gemarkeerd (1)").click();
  await page.getByRole("link", { name: /^Flashcards/ }).click();
  await expect(page.locator(".face.front .prompt")).toHaveText("woord 3");
  await page.keyboard.press("Space");
  await page.keyboard.press("2");
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await expect(page.getByText("Alles in één keer goed. Sterk.")).toBeVisible();
  await check();
});

test("ignore accents when that setting is on", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.goto("/#/instellingen");
  await page.getByText("Accenten niet meetellen").click();
  await page.getByRole("link", { name: "Lijsten", exact: true }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).click();
  await page.locator("label", { hasText: "Nederlands naar Frans" }).click();
  await expect(page.getByLabel("Nederlands naar Frans")).toBeChecked();
  await page.getByRole("link", { name: /^Typen/ }).click();
  const french: Record<string, string> = { "het huis": "la maison", "de hond": "le chien", "de school": "l'ecole", "het boek": "le livre", "het raam": "la fenetre", "de jongen": "le garcon", "de appel": "la pomme", zijn: "etre" };
  for (let i = 0; i < 8; i++) {
    await expect(page.locator(".answer-input:not([readonly])")).toBeFocused();
    const prompt = (await page.locator(".prompt").first().textContent())!.trim();
    await page.keyboard.type(french[prompt]!);
    await page.keyboard.press("Enter");
    await expect(page.locator(".sheet-title")).toHaveText("Goed zo!");
    if (["de school", "het raam", "de jongen", "zijn"].includes(prompt)) await expect(page.locator(".sheet")).toContainText("Let op de accenten.");
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("Alles in één keer goed. Sterk.")).toBeVisible();
  await check();
});

test("swipe a flipped flashcard to grade it", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  await page.getByRole("link", { name: /^Flashcards/ }).click();
  const swipe = async (dx: number) => {
    await page.locator(".flip").evaluate((el, dx) => {
      const ev = (type: string, x: number) => el.dispatchEvent(new PointerEvent(type, { pointerType: "touch", pointerId: 7, clientX: x, clientY: 300, bubbles: true }));
      ev("pointerdown", 100);
      ev("pointermove", 100 + dx / 2);
      ev("pointermove", 100 + dx);
      ev("pointerup", 100 + dx);
    }, dx);
  };
  const first = await page.locator(".face.front .prompt").textContent();
  await page.keyboard.press("Space");
  await expect(page.locator(".flip.flipped")).toBeVisible();
  await swipe(40); // too short: nothing happens
  await expect(page.locator(".face.front .prompt")).toHaveText(first!);
  await swipe(160); // right: knew it
  await expect(page.locator(".c-right")).toHaveText("1");
  await page.keyboard.press("Space");
  await swipe(-160); // left: didn't know
  await expect(page.locator(".c-wrong")).toHaveText("1");
  await check();
});
