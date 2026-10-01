import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { FakeAccount } from "./fake-account";

// Test accounts on the stand-in server only; nothing reaches a real one.
const ANNA = { email: "anna@klopt.test", password: "test-wachtwoord-anna" };
const BRAM = { email: "bram@klopt.test", password: "test-wachtwoord-bram" };

async function phone(browser: Browser, fake: FakeAccount): Promise<Page> {
  const ctx = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam", viewport: { width: 390, height: 844 } });
  await fake.attach(ctx);
  return ctx.newPage();
}

async function axe(page: Page, label: string) {
  await page.waitForTimeout(300);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
}

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/#/account");
  await page.getByLabel("E-mailadres").fill(who.email);
  await page.getByLabel("Wachtwoord").fill(who.password);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nu synchroniseren" })).toBeVisible();
}

async function syncNow(page: Page) {
  await page.goto("/#/account");
  await page.getByRole("button", { name: "Nu synchroniseren" }).click();
  await expect(page.getByText(/Gesynchroniseerd om/)).toBeVisible();
}

test("sign in on two phones and sync, send a list by name, share a quiz in a group", async ({ browser }) => {
  test.setTimeout(120_000);
  const fake = new FakeAccount();
  fake.addUser(ANNA.email, ANNA.password, { username: "anna", display_name: "Anna" });
  fake.addUser(BRAM.email, BRAM.password, { username: "bram", display_name: "Bram" });

  // Anna's phone: some lists, then sign in. Her profile is made from the name chosen at sign-up.
  const a = await phone(browser, fake);
  await a.goto("/");
  await a.getByRole("button", { name: "Probeer met voorbeeldlijsten" }).click();
  await a.locator(".hero-num").waitFor();
  await a.goto("/#/account");
  await axe(a, "sign-in form");
  await a.getByText("Account maken").click();
  await axe(a, "sign-up form");
  await a.getByText("Inloggen", { exact: true }).click();
  await signIn(a, ANNA);
  await expect(a.getByText("@anna")).toBeVisible();
  await axe(a, "account");
  await syncNow(a);
  expect(fake.tables.records!.length).toBeGreaterThan(20);

  // Anna's laptop: empty, signs in, gets everything.
  const b = await phone(browser, fake);
  await signIn(b, ANNA);
  await syncNow(b);
  await b.goto("/#/lijsten");
  await expect(b.getByRole("link", { name: /Frans: basiswoorden/ })).toBeVisible();
  await b.goto("/#/quizzen");
  await expect(b.getByRole("link", { name: /WO2: oefentoets/ })).toBeVisible();

  // A change on the laptop reaches the phone.
  await b.goto("/#/lijsten");
  await b.getByRole("link", { name: /Frans: basiswoorden/ }).click();
  await b.getByRole("button", { name: "la maison markeren" }).click();
  await syncNow(b);
  await syncNow(a);
  await a.goto("/#/lijsten");
  await a.getByRole("link", { name: /Frans: basiswoorden/ }).click();
  await expect(a.getByRole("button", { name: "Markering bij la maison weghalen" })).toBeVisible();

  // Bram signs in on his phone (that makes his profile), then Anna sends him the history list by username.
  const c = await phone(browser, fake);
  await signIn(c, BRAM);
  // A name nobody has gets a clear message.
  await a.goto("/#/lijsten");
  await a.getByRole("link", { name: /WO2: begrippen/ }).click();
  await a.getByRole("button", { name: "Meer opties" }).click();
  await a.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  await a.getByLabel("Naar een klasgenoot sturen").fill("@niemand");
  await a.getByRole("button", { name: "Sturen" }).click();
  await expect(a.getByText("Niemand met die gebruikersnaam.")).toBeVisible();

  await a.goto("/#/lijsten");
  await a.getByRole("link", { name: /WO2: begrippen/ }).click();
  await a.getByRole("button", { name: "Meer opties" }).click();
  await a.getByRole("dialog").getByRole("link", { name: "Delen" }).click();
  await a.getByLabel("Naar een klasgenoot sturen").fill("@bram");
  await a.getByRole("button", { name: "Sturen" }).click();
  await expect(a.getByText("Verstuurd.")).toBeVisible();

  // On Bram's phone the list waits under "Gedeeld met jou".
  await c.goto("/#/inbox");
  await c.getByRole("button", { name: /WO2: begrippen/ }).waitFor();
  await axe(c, "inbox");
  await c.getByRole("button", { name: /WO2: begrippen/ }).click();
  await expect(c.getByText("Van Anna (@anna)")).toBeVisible();
  await c.getByRole("button", { name: "Toevoegen aan mijn lijsten" }).click();
  await expect(c.getByRole("heading", { level: 1, name: "WO2: begrippen" })).toBeVisible();
  expect(fake.tables.shares).toEqual([]);

  // Anna makes a group; Bram joins with the code; Anna shares the quiz there; Bram adds it.
  await a.goto("/#/groepen");
  await a.getByLabel("Nieuwe groep").fill("4 havo geschiedenis");
  await a.getByRole("button", { name: "Groep maken" }).click();
  const code = (await a.locator(".the-code").textContent())!.trim();
  await c.goto("/#/groepen");
  await c.getByLabel("Code van een groep").fill(code);
  await c.getByRole("button", { name: "Erbij gaan" }).click();
  await expect(c.getByRole("heading", { level: 1, name: "4 havo geschiedenis" })).toBeVisible();
  await expect(c.getByText("2 leden")).toBeVisible();
  await axe(c, "group");

  await a.reload();
  await a.getByRole("button", { name: "Iets delen" }).click();
  await a.getByRole("dialog").getByRole("button", { name: "WO2: oefentoets" }).click();
  await expect(a.locator(".toast")).toHaveText("Gedeeld in de groep.");
  await c.reload();
  await c.getByRole("button", { name: /WO2: oefentoets/ }).click();
  await c.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(c.getByRole("heading", { level: 1, name: "WO2: oefentoets" })).toBeVisible();

  // Signing out keeps everything on the phone.
  await a.goto("/#/account");
  await a.getByRole("button", { name: /Uitloggen/ }).click();
  await expect(a.getByRole("button", { name: "Inloggen", exact: true })).toBeVisible();
  await a.goto("/#/lijsten");
  await expect(a.getByRole("link", { name: /Frans: basiswoorden/ })).toBeVisible();
});
