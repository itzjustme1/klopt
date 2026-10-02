import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser } from "@playwright/test";
import { ECONOMICS_HTML, ECONOMICS_TERMS, TEXTBOOK_HTML, TEXTBOOK_TERMS } from "../fixtures/textbook";
import { guard } from "./helpers";

/** Renders a textbook page and turns it into what a phone photo looks like: tilted, slightly blurred, uneven light, JPEG. */
async function photoOf(browser: Browser, html: string, scale: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 1260, height: 1300 }, deviceScaleFactor: scale });
  await page.setContent(html);
  const png = (await page.locator(".page").screenshot()).toString("base64");
  const jpeg = await page.evaluate(async (png) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#cfc9bd";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((-1.8 * Math.PI) / 180);
    ctx.translate(-c.width / 2, -c.height / 2);
    ctx.filter = "blur(1.1px)";
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,40,0,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1]!;
  }, png);
  await page.close();
  return Buffer.from(jpeg, "base64");
}

test("a photo of a textbook page: its bold and italic words become a term list", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const check = await guard(page);
  const history = await photoOf(browser, TEXTBOOK_HTML, 2);
  const economics = await photoOf(browser, ECONOMICS_HTML, 2);

  await page.goto("/");
  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Foto van je boek" }).click();
  await page.getByText("Tekst met begrippen").click();
  await expect(page.getByLabel("Taal van de tekst")).toHaveValue("nl");
  await page.locator('input[type="file"]').setInputFiles({ name: "bladzijde.jpg", mimeType: "image/jpeg", buffer: history });

  // Recognised on the device; every term with the sentence it stands in, the term itself blanked.
  await expect(page.getByRole("heading", { name: "6 begrippen gevonden" })).toBeVisible({ timeout: 120_000 });
  for (const term of TEXTBOOK_TERMS) await expect(page.locator(".t-front", { hasText: new RegExp(`^${term}$`) })).toBeVisible();
  await expect(page.locator(".term", { hasText: "Blitzkrieg" })).toContainText("De Duitsers gebruikten de …, een snelle aanval met tanks en vliegtuigen tegelijk.");
  await expect(page.locator(".term", { hasText: "collaboratie" })).toContainText("werkten sommige Nederlanders samen met de Duitsers");
  await expect(page.getByLabel("Naam van de lijst")).toHaveValue("Nederland in de oorlog");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
  await page.screenshot({ path: "test-results/photo-terms-review.png", fullPage: true });

  // Fix an explanation before saving.
  await page.getByRole("button", { name: "Blitzkrieg bewerken" }).click();
  await expect(page.getByLabel("Uitleg")).toBeFocused();
  await page.getByLabel("Uitleg").fill("Een snelle aanval met tanks en vliegtuigen tegelijk.");
  await page.getByRole("button", { name: "Klaar" }).click();
  await expect(page.locator(".term", { hasText: "Blitzkrieg" })).toContainText("Een snelle aanval met tanks en vliegtuigen tegelijk.");

  // A term the photo missed can be typed in; it only counts once both sides are filled.
  await page.getByRole("button", { name: "Begrip toevoegen" }).click();
  await expect(page.getByLabel("Begrip", { exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Lijst maken met 6 begrippen" })).toBeVisible();
  await page.getByLabel("Begrip", { exact: true }).fill("D-Day");
  await page.getByLabel("Uitleg").fill("De landing in Normandië op 6 juni 1944.");
  await page.getByRole("button", { name: "Klaar" }).click();
  await expect(page.getByRole("button", { name: "Lijst maken met 7 begrippen" })).toBeVisible();

  // A second page adds its terms; untick one.
  await page.locator('input[type="file"]').setInputFiles({ name: "bladzijde2.jpg", mimeType: "image/jpeg", buffer: economics });
  await expect(page.getByRole("heading", { name: "11 begrippen gevonden" })).toBeVisible({ timeout: 120_000 });
  for (const term of ECONOMICS_TERMS) await expect(page.locator(".t-front", { hasText: new RegExp(`^${term}$`) })).toBeVisible();
  await page.locator(".term", { hasText: "marktwerking" }).getByRole("checkbox").uncheck();
  await page.getByLabel("Vak", { exact: true }).fill("Geschiedenis");
  await page.getByRole("button", { name: "Lijst maken met 10 begrippen" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Nederland in de oorlog" })).toBeVisible();
  await expect(page.getByText("Geschiedenis · 10 begrippen")).toBeVisible();
  await expect(page.getByText("Februaristaking", { exact: true })).toBeVisible();
  await expect(page.getByText("Een snelle aanval met tanks en vliegtuigen tegelijk.", { exact: true })).toBeVisible();
  await check();
});

test("a photo too blurry to tell bold from regular says so instead of guessing", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const check = await guard(page);
  const blurry = await photoOf(browser, ECONOMICS_HTML, 1);
  await page.goto("/#/foto");
  await page.getByText("Tekst met begrippen").click();
  await page.locator('input[type="file"]').setInputFiles({ name: "wazig.jpg", mimeType: "image/jpeg", buffer: blurry });
  await expect(page.getByRole("alert")).toContainText("niet scherp genoeg", { timeout: 90_000 });
  await check();
});
