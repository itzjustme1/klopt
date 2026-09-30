import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("paste a list, back up, wipe, restore", async ({ page }) => {
  const check = await guard(page);
  await page.goto("/#/importeren");

  const list = [
    "inflatie\tstijging van het algemeen prijspeil",
    "",
    "bbp;bruto binnenlands product",
    "zonder scheidingsteken",
    "<b>vet</b>;<script>alert(1)</script>",
    "bbp;bruto binnenlands product",
  ].join("\n");
  await page.getByLabel("Je lijst").fill(list);
  await expect(page.getByText("3 woorden herkend")).toBeVisible();
  await expect(page.getByText("Regel 4 overgeslagen. Zet een tab of puntkomma tussen woord en vertaling.")).toBeVisible();
  await expect(page.getByText("Regel 6 overgeslagen. Dit woord staat al in de lijst.")).toBeVisible();
  // HTML shows as literal text, not markup.
  await expect(page.locator("tbody td", { hasText: "<script>alert(1)</script>" })).toBeVisible();

  // A new list needs a name.
  await page.getByRole("button", { name: "3 woorden toevoegen" }).click();
  await expect(page.getByRole("alert")).toHaveText("Geef de lijst een naam.");
  await page.getByLabel("Naam van de nieuwe lijst").fill("Begrippen");
  await page.getByLabel("Taal links").selectOption("nl");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.getByRole("button", { name: "3 woorden toevoegen" }).click();
  await expect(page.getByText('3 woorden toegevoegd aan "Begrippen".')).toBeVisible();
  await page.getByRole("link", { name: "Naar de lijst" }).click();
  await expect(page.locator(".w-front", { hasText: "<b>vet</b>" })).toBeVisible();

  // Back up.
  await page.goto("/#/instellingen");
  await expect(page.getByText("Je hebt nog geen back-up gemaakt.")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Back-up downloaden" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^klopt-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const json = JSON.parse(await readFile(file, "utf8"));
  expect(json).toMatchObject({ format: "klopt-backup", version: 2 });
  expect(json.cards).toHaveLength(3);
  await expect(page.getByText(/^Laatste back-up:/)).toBeVisible();

  // Wipe with typed confirmation.
  const wipe = page.getByRole("button", { name: "Alles definitief wissen" });
  await expect(wipe).toBeDisabled();
  await page.getByLabel("Typ WISSEN om te bevestigen").fill("wissen");
  await expect(wipe).toBeDisabled();
  await page.getByLabel("Typ WISSEN om te bevestigen").fill("WISSEN");
  await wipe.click();
  await expect(page.getByRole("heading", { name: "Welkom bij Klopt" })).toBeVisible();

  // A broken file is rejected with a clear message and changes nothing.
  await page.goto("/#/instellingen");
  await page.getByLabel("Back-up terugzetten").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"format":"klopt-backup","version":2,"decks":[{"id":"x"}],"cards":[],"reviews":[]}') });
  await expect(page.getByRole("alert")).toHaveText("Dit bestand is beschadigd (decks[0].name). Er is niets veranderd.");

  // Restore with replace, after confirming.
  await page.getByLabel("Back-up terugzetten").setInputFiles(file);
  await expect(page.getByText("In dit bestand: 1 lijst, 3 woorden en 0 antwoorden.")).toBeVisible();
  await page.getByRole("button", { name: "Alles vervangen" }).click();
  await page.getByRole("button", { name: "Ja, alles vervangen" }).click();
  await expect(page.getByText("Back-up teruggezet.").first()).toBeVisible();
  await page.goto("/#/lijsten");
  await expect(page.getByRole("link", { name: /Begrippen/ })).toBeVisible();

  // Merging the same file again adds nothing.
  await page.goto("/#/instellingen");
  await page.getByLabel("Back-up terugzetten").setInputFiles(file);
  await page.getByRole("button", { name: "Samenvoegen" }).click();
  await expect(page.getByText("Samengevoegd: 0 lijsten en 0 woorden erbij of bijgewerkt.").first()).toBeVisible();

  // Language switch applies immediately, without reload.
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await check();
});
