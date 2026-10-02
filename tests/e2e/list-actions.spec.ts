import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("rename, copy, move and delete a list from its ⋯ menu in an overview", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();

  await page.getByRole("button", { name: "Opties voor Frans: basiswoorden" }).click();
  const sheet = page.getByRole("dialog", { name: "Frans: basiswoorden" });
  await sheet.getByRole("button", { name: "Naam wijzigen" }).click();
  await expect(sheet.getByLabel("Nieuwe naam")).toHaveValue("Frans: basiswoorden");
  await sheet.getByLabel("Nieuwe naam").fill("Frans H1");
  await sheet.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.locator(".toast")).toHaveText("Naam gewijzigd.");
  await expect(page.getByRole("link", { name: /Frans H1/ })).toBeVisible();

  await page.goto("/#/lijsten");
  await page.getByRole("button", { name: "Opties voor Frans H1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kopie maken" }).click();
  await expect(page.getByRole("link", { name: /Frans H1 \(kopie\)/ })).toBeVisible();

  await page.getByRole("button", { name: "Opties voor Frans H1 (kopie)" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Verwijderen" }).click();
  await expect(page.getByRole("dialog")).toContainText("verwijderen, met alle woorden");
  await page.getByRole("dialog").getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(page.locator(".toast")).toHaveText("Lijst verwijderd.");
  await expect(page.getByRole("link", { name: /Frans H1 \(kopie\)/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Frans H1/ })).toHaveCount(1);
  await check();
});

test("the sidebar folds to icons on a laptop and remembers it", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: "nl-NL" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/");
  const nav = page.getByRole("navigation", { name: "Hoofdmenu" });
  const width = () => nav.evaluate((el) => el.getBoundingClientRect().width);
  expect(await width()).toBe(232);
  await page.getByRole("button", { name: "Zijbalk inklappen" }).click();
  await expect.poll(width).toBe(76);
  // Names stay for screen readers and show as a tooltip.
  await expect(nav.getByRole("link", { name: "Lijsten" })).toHaveAttribute("title", "Lijsten");
  await page.reload();
  await expect.poll(width).toBe(76);
  await expect(page.getByRole("button", { name: "Zijbalk uitklappen" })).toHaveAttribute("aria-expanded", "false");
  // The page never touches the sidebar.
  const gap = await page.evaluate(() => document.querySelector("main h1, main .topline, main .welcome")!.getBoundingClientRect().left - document.querySelector("nav")!.getBoundingClientRect().right);
  expect(gap).toBeGreaterThanOrEqual(24);
  await page.getByRole("button", { name: "Zijbalk uitklappen" }).click();
  await expect.poll(width).toBe(232);
  await ctx.close();
});

test("make a practice test from a list and take it", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();
  await page.getByRole("button", { name: "Opties voor WO2: begrippen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Oefentoets maken" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "WO2: begrippen: oefentoets" })).toBeVisible();
  await expect(page.getByText("Geschiedenis · 8 vragen")).toBeVisible();
  await page.getByRole("link", { name: "Start quiz" }).click();
  // Answer every question somehow and get a grade.
  for (let i = 0; i < 8; i++) {
    await expect(page.getByText(`Vraag ${i + 1} van 8`)).toBeVisible();
    if (await page.locator(".blank").count()) {
      for (const blank of await page.locator(".blank").all()) await blank.fill("x");
      await page.keyboard.press("Enter");
    } else if (await page.getByRole("button", { name: "Bekijk antwoord" }).count()) {
      await page.getByRole("button", { name: "Bekijk antwoord" }).click();
      await page.getByRole("button", { name: "Goed", exact: true }).click();
      continue;
    } else {
      await page.keyboard.press("1");
    }
    await page.locator(".next").click();
  }
  await expect(page.getByRole("heading", { name: "Je cijfer" })).toBeVisible();
  await check();
});
