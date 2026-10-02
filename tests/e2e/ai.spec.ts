import { expect, test } from "@playwright/test";
import { FakeAccount } from "./fake-account";

const ANNA = { email: "anna@klopt.test", password: "test-wachtwoord-anna" };

test("slim herkennen: a page read with AI after signing in, with a daily limit", async ({ browser }) => {
  test.setTimeout(120_000);
  const fake = new FakeAccount();
  fake.addUser(ANNA.email, ANNA.password, { username: "anna", display_name: "Anna" });
  const ctx = await browser.newContext({ locale: "nl-NL", viewport: { width: 390, height: 844 } });
  await fake.attach(ctx);
  const page = await ctx.newPage();
  // A small picture is enough: the stand-in server answers with fixed terms.
  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#111";
    g.font = "40px serif";
    g.fillText("Industrie & kolonialisme", 60, 100);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  const file = { name: "bladzijde.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") };

  // Not signed in: the switch is there but off, with a way to sign in.
  await page.goto("/#/foto");
  await page.getByText("Tekst met begrippen").click();
  await expect(page.getByRole("switch", { name: "Slim herkennen met AI" })).toBeDisabled();
  await expect(page.getByText("Slim herkennen met AI werkt als je bent ingelogd.")).toBeVisible();

  await page.goto("/#/account");
  await page.getByLabel("E-mailadres").fill(ANNA.email);
  await page.getByLabel("Wachtwoord").fill(ANNA.password);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nu synchroniseren" })).toBeVisible();

  await page.goto("/#/foto");
  await page.getByText("Tekst met begrippen").click();
  await page.getByText("Slim herkennen met AI", { exact: true }).click();
  await expect(page.getByRole("switch", { name: "Slim herkennen met AI" })).toBeChecked();
  await expect(page.getByText("De foto gaat naar Claude (van Anthropic)")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("heading", { name: "3 begrippen gevonden" })).toBeVisible({ timeout: 30_000 });
  // The term is blanked in its own explanation, and the heading names the list.
  await expect(page.locator(".term", { hasText: "Industriële Revolutie" })).toContainText("De overgang naar productie met machines in fabrieken; de … begon in Groot-Brittannië.");
  await expect(page.getByLabel("Naam van de lijst")).toHaveValue("Industrie & kolonialisme");
  expect(fake.aiCalls).toHaveLength(1);
  expect(fake.aiCalls[0]).toMatchObject({ lang: "nl", jpeg: true });

  // The choice is remembered; the second page works, the third is over today's limit.
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("alert")).toContainText("Op deze pagina staan geen nieuwe begrippen.");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("alert")).toContainText("Je hebt de bladzijdes met AI voor vandaag gebruikt.");
  await page.getByRole("button", { name: "Lijst maken met 3 begrippen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Industrie & kolonialisme" })).toBeVisible();
  await ctx.close();
});
