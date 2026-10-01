import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("make a quiz with every question type, take it and get a grade", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Nieuw", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Nieuwe quiz" })).toBeVisible();

  await page.getByLabel("Naam van de quiz").fill("WO2 hoofdstuk 4");
  await page.getByLabel("Vak", { exact: true }).fill("Geschiedenis");
  // 1: multiple choice, the second answer is right.
  await page.locator("#q1-first").fill("Wanneer was D-Day?");
  await page.getByLabel("Vraag 1, Antwoord 1").fill("1942");
  await page.getByLabel("Vraag 1, Antwoord 2").fill("1944");
  await page.getByLabel("Vraag 1, Antwoord 3").fill("1945");
  await page.getByLabel("Antwoord 2 is goed").check();
  // 2: fill in.
  await page.getByRole("button", { name: "Vraag toevoegen" }).click();
  await page.locator("li").filter({ hasText: "Vraag 2" }).getByText("Invullen").click();
  await page.locator("#q2-first").fill("De Februaristaking was in [1941] in [Amsterdam].");
  await expect(page.getByText("2 lege plekken")).toBeVisible();
  // 3: open question.
  await page.getByRole("button", { name: "Vraag toevoegen" }).click();
  await page.locator("li").filter({ hasText: "Vraag 3" }).getByText("Open vraag").click();
  await page.locator("#q3-first").fill("Wat is verzet?");
  await page.locator("#q3-answer").fill("Strijd tegen de bezetter.");
  // 4: true or false.
  await page.getByRole("button", { name: "Vraag toevoegen" }).click();
  await page.locator("li").filter({ hasText: "Vraag 4" }).getByText("Waar of niet waar", { exact: true }).click();
  await page.locator("#q4-first").fill("Nederland was neutraal in 1944.");
  await page.locator("li").filter({ hasText: "Vraag 4" }).getByText("Niet waar", { exact: true }).click();
  // An unfinished extra question blocks saving until it is removed. A new question starts as the type before it.
  await page.getByRole("button", { name: "Vraag toevoegen" }).click();
  await expect(page.locator("li").filter({ hasText: "Vraag 5" }).getByLabel("Waar of niet waar")).toBeChecked();
  await page.locator("li").filter({ hasText: "Vraag 5" }).getByText("Meerkeuze").click();
  await page.locator("#q5-first").fill("Half af");
  await page.getByRole("button", { name: "Quiz opslaan" }).click();
  await expect(page.getByText("Vraag 5 heeft minstens twee antwoorden nodig")).toBeVisible();
  await page.getByRole("button", { name: "Vraag 5 weghalen" }).click();
  await page.getByRole("button", { name: "Quiz opslaan" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "WO2 hoofdstuk 4" })).toBeVisible();
  await expect(page.getByText("Geschiedenis · 4 vragen")).toBeVisible();
  await page.getByRole("link", { name: "Start quiz" }).click();

  // 1: pick the right answer by keyboard.
  await expect(page.getByText("Vraag 1 van 4")).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByText("Goed zo!")).toBeVisible();
  await page.keyboard.press("Enter");
  // 2: one blank right, one wrong: half a point.
  await page.getByLabel("Lege plek 1").fill("1941");
  await page.getByLabel("Lege plek 2").fill("Rotterdam");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Deels goed")).toBeVisible();
  await expect(page.getByText("Goed antwoord: De Februaristaking was in 1941 in Amsterdam.")).toBeVisible();
  await page.getByRole("button", { name: "Volgende" }).click();
  // 3: open, graded by yourself.
  await page.getByRole("button", { name: "Bekijk antwoord" }).click();
  await expect(page.getByText("Strijd tegen de bezetter.")).toBeVisible();
  await page.getByRole("button", { name: "Goed", exact: true }).click();
  // 4: wrong on purpose.
  await page.getByRole("button", { name: "Waar", exact: true }).click();
  await expect(page.getByText("Niet goed")).toBeVisible();
  await page.getByRole("button", { name: "Bekijk je cijfer" }).click();

  // 2.5 of 4 points: 1 + 9 × 0.625 = 6.6
  await expect(page.getByRole("heading", { name: "Je cijfer" })).toBeVisible();
  await expect(page.locator(".grade")).toHaveText("6,6");
  await expect(page.getByText("2,5 van 4 punten")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dit ging fout" })).toBeVisible();
  await page.getByRole("link", { name: "Terug naar de quiz" }).click();
  await expect(page.getByText("Laatste cijfer 6,6")).toBeVisible();

  // It survives a reload and shows under Quizzen.
  await page.reload();
  await page.goto("/#/quizzen");
  await expect(page.getByRole("link", { name: /WO2 hoofdstuk 4/ })).toContainText("Laatste cijfer 6,6");
  await check();
});
