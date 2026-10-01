import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createFrenchList, dayISO, guard } from "./helpers";

test("plan a test week: add a test, skip a weekday, practise today's part and export to a calendar", async ({ page }) => {
  const check = await guard(page);
  await createFrenchList(page);
  await page.goto("/#/toetsweek");
  await expect(page.getByRole("heading", { level: 1, name: "Toetsweek" })).toBeVisible();
  await expect(page.getByText("Nog geen toetsen gepland.")).toBeVisible();

  await page.getByRole("button", { name: "Toets toevoegen" }).click();
  const sheet = page.getByRole("dialog", { name: "Toets toevoegen" });
  await expect(sheet.getByLabel("Lijst")).toHaveValue(/.+/);
  await sheet.getByLabel("Datum van de toets").fill(dayISO(3));
  await sheet.getByRole("button", { name: "Opslaan" }).click();
  await expect(sheet).toBeHidden();

  // 4 words over today and tomorrow, the day before the test is for a review.
  await expect(page.getByRole("link", { name: /Frans H1/ }).first()).toContainText("Nog 4 woorden te leren.");
  const days = page.locator(".day");
  await expect(days).toHaveCount(4);
  await expect(days.nth(0)).toContainText("Vandaag");
  await expect(days.nth(0)).toContainText("Leer 4 nieuwe woorden");
  await expect(days.nth(2)).toContainText("Herhaal alle 4 woorden");
  await expect(days.nth(3)).toContainText("Toets Frans H1");

  // No time tomorrow: still planned before the test, just not tomorrow.
  const tomorrow = new Date(`${dayISO(1)}T12:00:00Z`).getUTCDay();
  const names = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  await page.getByRole("button", { name: names[tomorrow], exact: true }).click();
  await expect(page.getByRole("button", { name: names[tomorrow], exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(days.nth(1)).toContainText("Vrij");

  // Export to a calendar file.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "In je agenda" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("klopt-toetsweek.ics");
  const ics = await readFile((await file.path())!, "utf8");
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain(`DTSTART;VALUE=DATE:${dayISO(3).replaceAll("-", "")}`);
  expect(ics).toContain("SUMMARY:Toets: Frans H1");
  expect(ics).toContain("SUMMARY:Leer 4 nieuwe woorden · Frans H1");
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);

  // Home links to the planner once there is a test.
  await page.goto("/");
  await page.getByRole("link", { name: "Planner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Toetsweek" })).toBeVisible();

  // Today's part opens practice.
  await days.nth(0).getByRole("link", { name: /Leer 4 nieuwe woorden/ }).click();
  await expect(page).toHaveURL(/#\/oefenen\/.+\/leren\//);
  await check();
});
