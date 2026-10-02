import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

/** A simple biology-style diagram: a shape with lines to four labels. */
async function drawDiagram(page: import("@playwright/test").Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#e9a3a3";
    ctx.beginPath();
    ctx.ellipse(700, 470, 230, 280, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.font = "44px Arial, sans-serif";
    ctx.fillStyle = "#111";
    const labels: [string, number, number, number, number][] = [
      ["aorta", 80, 160, 560, 260],
      ["longader", 1040, 160, 860, 300],
      ["linker kamer", 1000, 760, 820, 640],
      ["rechter boezem", 60, 760, 560, 600],
    ];
    for (const [text, x, y, lx, ly] of labels) {
      ctx.fillText(text, x, y);
      ctx.beginPath();
      ctx.moveTo(x < 700 ? x + ctx.measureText(text).width + 10 : x - 10, y - 14);
      ctx.lineTo(lx, ly);
      ctx.stroke();
    }
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

test("a labelled picture: names are found, covered, and quizzed one by one", async ({ page }) => {
  test.setTimeout(150_000);
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Plaatje met namen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plaatje met namen" })).toBeVisible();
  const png = await drawDiagram(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "hart.png", mimeType: "image/png", buffer: png });

  await expect(page.getByRole("heading", { name: /vakjes?$/ })).toBeVisible({ timeout: 120_000 });
  const values = await page.locator(".labels input").evaluateAll((els) => (els as HTMLInputElement[]).map((e) => e.value));
  for (const name of ["aorta", "longader", "linker kamer", "rechter boezem"]) expect(values, values.join(" | ")).toContain(name);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
  await page.screenshot({ path: "test-results/diagram-editor.png", fullPage: true });

  // Remove one, and draw one by hand over the shape.
  await page.getByRole("button", { name: `Vakje ${values.indexOf("longader") + 1} weghalen` }).click();
  const stage = page.locator(".stage");
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByPlaceholder("Wat staat er hier?").or(page.getByPlaceholder("Wat staat hier?")).last()).toBeFocused();
  await page.keyboard.type("hartspier");
  await page.getByLabel("Vak", { exact: true }).fill("Biologie");
  await page.getByRole("button", { name: "Lijst maken met 4 vragen" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Plaatje" })).toBeVisible();
  await expect(page.getByText("Biologie · 4 woorden")).toBeVisible();
  // Practise by typing: each question is the picture with one box marked.
  await page.getByRole("button", { name: /^Oefen / }).click();
  await page.getByRole("dialog", { name: "Oefen met" }).getByRole("link", { name: /^Typen/ }).click();
  await expect(page.locator("img.q-img")).toBeVisible();
  const src = await page.locator("img.q-img").getAttribute("src");
  expect(src).toMatch(/^data:image\/jpeg;base64,/);
  await page.screenshot({ path: "test-results/diagram-question.png" });
  await page.locator(".answer-input").fill("weet ik niet");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /Niet goed|Bijna/ })).toBeVisible();
  await check();
});
