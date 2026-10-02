import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("share a list by link and open it", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.getByRole("link", { name: /Frans: basiswoorden/ }).first().click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  await expect(page.getByRole("heading", { name: "Lijst delen" })).toBeVisible();
  const link = await page.getByLabel("Deellink").inputValue();
  expect(link).toMatch(/^http:\/\/localhost:4173\/#\/deel\/[A-Za-z0-9_-]+$/);
  expect(link.length).toBeLessThan(8100);

  // Open the link: preview first, nothing is added until the student agrees.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Gedeeld met jou" })).toBeVisible();
  await expect(page.getByText("la fenêtre")).toBeVisible();
  await page.getByRole("button", { name: "Toevoegen aan mijn lijsten" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Frans: basiswoorden" })).toBeVisible();
  await page.goto("/#/lijsten");
  await expect(page.getByRole("link", { name: /Frans: basiswoorden/ })).toHaveCount(2);

  // A damaged link is refused.
  await page.goto(link.slice(0, -12) + "AAAAAAAAAAAA");
  await expect(page.getByRole("alert")).toHaveText("Deze link is ongeldig of beschadigd. Vraag om een nieuwe link of om het bestand.");

  await check();
});

test("backup reminder after 50 new words", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill(Array.from({ length: 50 }, (_, i) => `term ${i};uitleg ${i}`).join("\n"));
  await page.getByLabel("Naam van de nieuwe lijst").fill("Veel");
  await page.getByRole("button", { name: "50 woorden toevoegen" }).click();
  await expect(page.getByText("50 woorden toegevoegd")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Je hebt 50 woorden gemaakt of aangepast sinds je laatste back-up.")).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByText(/sinds je laatste back-up/)).toHaveCount(0);
  await check();
});

test("send a quiz and a folder by link; the receiver adds them", async ({ page, browser }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();

  await page.goto("/#/quizzen");
  await page.getByRole("link", { name: /WO2: oefentoets/ }).click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  await expect(page.getByRole("heading", { name: "Quiz delen" })).toBeVisible();
  const quizLink = await page.getByLabel("Deellink").inputValue();

  await page.goto("/#/mappen/nieuw");
  await page.getByLabel("Naam van de map").fill("WO2");
  await page.getByLabel(/WO2: begrippen/).check();
  await page.getByLabel(/WO2: oefentoets/).check();
  await page.getByRole("button", { name: "Map maken" }).click();
  await page.getByRole("button", { name: "Meer opties" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delen" }).click();
  await expect(page.getByRole("heading", { name: "Map delen" })).toBeVisible();
  const folderLink = await page.getByLabel("Deellink").inputValue();
  await check();

  // Someone else, with an empty app.
  const other = await browser.newContext({ locale: "nl-NL" });
  const them = await other.newPage();
  await them.goto(quizLink);
  await expect(them.getByRole("heading", { name: "Gedeeld met jou" })).toBeVisible();
  await expect(them.getByText("Quiz · 4 vragen")).toBeVisible();
  await them.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(them.getByRole("heading", { level: 1, name: "WO2: oefentoets" })).toBeVisible();
  // Their copy has no grade of mine.
  await expect(them.getByText(/Laatste cijfer/)).toHaveCount(0);

  await them.goto(folderLink);
  await expect(them.getByText("1 lijst · 1 quiz")).toBeVisible();
  await them.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(them.getByRole("heading", { level: 1, name: "WO2" })).toBeVisible();
  await expect(them.getByRole("link", { name: /WO2: begrippen/ })).toBeVisible();
  await other.close();
});

test("share a list as a QR code that scans back to the same link", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await page.locator(".hero-num").waitFor();
  await page.getByRole("button", { name: "Opties voor Frans: basiswoorden" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  const link = await page.getByLabel("Link").inputValue();
  await page.getByRole("button", { name: "QR-code" }).click();
  const qr = page.getByRole("img", { name: "QR-code met de link naar Frans: basiswoorden" });
  await expect(qr).toBeVisible();
  await expect(page.getByText("Laat je klasgenoot dit scannen")).toBeVisible();
  // Decode the code with the browser's own barcode reader, where there is one.
  const decoded = await page.evaluate(async () => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect(s: ImageBitmapSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) return null;
    const svg = document.querySelector("svg.qr")!;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 800;
    c.getContext("2d")!.drawImage(img, 0, 0, 800, 800);
    const found = await new BD({ formats: ["qr_code"] }).detect(c);
    return found[0]?.rawValue ?? "";
  });
  if (decoded !== null) expect(decoded).toBe(link);
  await check();
});
