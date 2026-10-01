import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { guard, practise } from "./helpers";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
}

/** A small PNG drawn in the page: a red square on white. */
async function png(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 900;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 1200, 900);
    x.fillStyle = "#c00";
    x.fillRect(300, 200, 600, 500);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

test("a picture as the question: add it in the editor, see it on the list and in practice", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/lijst/nieuw/begrippen");
  await page.getByLabel("Naam van de lijst").fill("Biologie: dieren");
  // Row 1: only a picture and its name.
  await page.getByRole("button", { name: "Plaatje toevoegen aan rij 1" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "vos.png", mimeType: "image/png", buffer: await png(page) });
  await expect(page.locator(".pic img")).toHaveCount(1);
  // Downscaled to a small JPEG.
  const src = await page.locator(".pic img").getAttribute("src");
  expect(src).toMatch(/^data:image\/jpeg;base64,/);
  expect(src!.length).toBeLessThan(120_000);
  await page.getByLabel("Rij 1, Uitleg").fill("Vos");
  await page.getByLabel("Rij 2, Begrip").fill("Zoogdier");
  await page.getByLabel("Rij 2, Uitleg").fill("Een dier dat zijn jongen melk geeft.");
  await axe(page);
  await page.getByRole("button", { name: "Lijst opslaan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Biologie: dieren" })).toBeVisible();
  await expect(page.locator(".w-img")).toHaveCount(1);

  // Reload: the picture is stored.
  await page.reload();
  await expect(page.locator(".w-img")).toHaveCount(1);

  await practise(page, /^Flashcards/);
  await axe(page);
  for (let i = 0; i < 2; i++) {
    await expect(page.locator(".flip:not(.flipped)")).toBeFocused();
    const picture = await page.locator(".face.front .q-img").count();
    if (picture) await expect(page.locator(".face.front .q-img")).toHaveAttribute("alt", "Plaatje bij de vraag");
    await page.keyboard.press("Space");
    await expect(page.locator(".flip.flipped")).toBeVisible();
    if (picture) await expect(page.locator(".face.back .prompt")).toHaveText("Vos");
    await page.keyboard.press("2");
    await expect(page.locator(".flip.flipped")).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Klaar!" })).toBeVisible();
  await check();
});
