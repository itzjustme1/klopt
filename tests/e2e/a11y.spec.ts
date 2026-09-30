import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const issues = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(issues).toEqual([]);
}

/** Asserts no horizontal page scroll and every visible control is at least 44px tall and wide (or a text link inside text). */
async function layout(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a.btn, .nav a, input[type=radio], select, input[type=text], textarea")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const target = el.matches("input[type=radio]") ? (el.closest("label") as HTMLElement) : el;
        const r = target.getBoundingClientRect();
        return { text: (target.textContent || target.getAttribute("aria-label") || target.tagName).trim().slice(0, 30), w: r.width, h: r.height };
      })
      .filter((b) => b.h < 44 || b.w < 44),
  );
  expect(small, `${label}: tap targets under 44px`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`accessibility and layout at 360px, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: scheme, locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
    const page = await ctx.newPage();
    const base = "http://localhost:4173/";
    const check = async (label: string) => {
      await page.waitForTimeout(450); // let the flip and toast animations settle
      await audit(page, `${scheme} ${label}`);
      await layout(page, `${scheme} ${label}`);
    };

    await page.goto(base);
    await page.getByRole("heading", { name: "Nog geen kaarten" }).waitFor();
    await check("empty");
    await page.getByRole("button", { name: "Probeer een voorbeeldstapel" }).click();
    await page.locator(".hero .count").waitFor();
    await check("today");
    await page.getByRole("link", { name: "Begin met overhoren" }).click();
    await check("review front");
    await page.keyboard.press("Space");
    await check("review back");
    for (const key of ["3", "Space", "1", "Space", "2"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(450);
    }
    await page.getByRole("heading", { name: "Klaar" }).waitFor();
    await check("done");
    await page.goto(base + "#/stapels");
    await check("decks");
    await page.getByRole("link", { name: "Voorbeeldstapel" }).first().click();
    await check("deck");
    await page.getByRole("link", { name: "Delen" }).click();
    await page.getByLabel("Deellink").waitFor();
    await check("share");
    await page.goto(base + "#/importeren");
    await page.getByLabel("Je lijst").fill("a;b\nzonder\nc\td");
    await check("import");
    await page.goto(base + "#/instellingen");
    await check("settings");
    await page.getByLabel("English").check();
    await page.goto(base);
    await check("today en");
    await ctx.close();
  });
}

test("reduced motion: the card swaps without rotating", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/");
  await page.getByRole("button", { name: /voorbeeldstapel|sample deck/i }).click();
  await page.getByRole("link", { name: /Begin met overhoren|Start reviewing/ }).click();
  await page.locator(".flipper").waitFor();
  await page.keyboard.press("Space");
  await expect(page.locator(".flipper.flipped")).toHaveCount(1);
  const t = await page.locator(".face.back").evaluate((el) => getComputedStyle(el).transform);
  expect(t).toBe("none");
  await expect(page.locator(".face.back")).toBeVisible();
  await expect(page.locator(".face.front")).toBeHidden();
  await ctx.close();
});
