import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("a photo of a two-column word list becomes a list, on the device", async ({ page }) => {
  test.setTimeout(120_000);
  const check = await guard(page);
  await page.goto("/#/foto");
  await expect(page.getByRole("heading", { name: "Foto van je boek" })).toBeVisible();

  // Draw a clean "textbook" word list and turn it into a PNG, like a phone photo would be.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 620;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#111111";
    ctx.font = "56px Georgia, serif";
    const rows = [
      ["la maison", "het huis"],
      ["le chien", "de hond"],
      ["le livre", "het boek"],
      ["la pomme", "de appel"],
    ];
    rows.forEach(([a, b], i) => {
      ctx.fillText(a!, 80, 120 + i * 130);
      ctx.fillText(b!, 800, 120 + i * 130);
    });
    return c.toDataURL("image/png").split(",")[1]!;
  });

  await page.getByLabel("Taal links").selectOption("fr");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.locator('input[type="file"]').setInputFiles({ name: "lijst.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });

  // Recognition runs locally, then the import screen opens with the rows for checking.
  await expect(page.getByRole("heading", { name: "Lijst plakken" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Herkend uit je foto.", { exact: false })).toBeVisible();
  const text = await page.getByLabel("Je lijst").inputValue();
  const lines = text.split("\n");
  const expected = ["la maison\thet huis", "le chien\tde hond", "le livre\thet boek", "la pomme\tde appel"];
  const hits = expected.filter((e) => lines.includes(e)).length;
  expect(hits, `recognised:\n${text}`).toBeGreaterThanOrEqual(3);
  await expect(page.getByText(/woorden herkend/)).toBeVisible();

  await check();
});
