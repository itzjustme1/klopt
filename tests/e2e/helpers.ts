import { expect, type Page } from "@playwright/test";

/** Fails the test on any request to another origin, any CSP violation and any console error. */
export async function guard(page: Page) {
  const foreign: string[] = [];
  const errors: string[] = [];
  page.context().on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== "http://localhost:4173") foreign.push(req.url());
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return async () => {
    const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(foreign, "requests to other origins").toEqual([]);
    expect(csp, "CSP violations").toEqual([]);
    expect(errors, "console errors").toEqual([]);
  };
}

export function dayLabel(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("nl", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" }).format(d);
}

export const WORDS: [string, string][] = [
  ["la maison", "het huis"],
  ["le chien", "de hond"],
  ["l'école", "de school"],
  ["le livre", "het boek"],
];

/** Creates a French list through the table editor, using the keyboard to move between cells. */
export async function createFrenchList(page: Page, name = "Frans H1") {
  await page.goto("/#/lijst/nieuw");
  await page.getByLabel("Naam van de lijst").fill(name);
  await page.getByLabel("Vak", { exact: true }).fill("Frans");
  await page.getByLabel("Taal links").selectOption("fr");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.getByLabel("Rij 1, Woord of begrip").click();
  for (const [fr, nl] of WORDS) {
    await page.keyboard.type(fr);
    await page.keyboard.press("Enter");
    await page.keyboard.type(nl);
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: "Lijst opslaan" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export function answerFor(prompt: string): string {
  const pair = WORDS.find(([fr, nl]) => fr === prompt || nl === prompt);
  if (!pair) throw new Error(`Unknown prompt ${prompt}`);
  return pair[0] === prompt ? pair[1] : pair[0];
}

/** Local calendar date (YYYY-MM-DD) in Amsterdam, `offsetDays` from now. */
export function dayISO(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Amsterdam" }).format(d);
}

/** Opens "Oefen met" on a list page; returns the menu. */
export async function openPractice(page: Page) {
  await page.getByRole("button", { name: /^Oefen / }).click();
  return page.getByRole("dialog", { name: "Oefen met" });
}

/** Opens "Oefen met" on a list page and starts a mode (e.g. /^Leren/, "Toets"). */
export async function practise(page: Page, mode: RegExp | string) {
  const menu = await openPractice(page);
  await menu.getByRole("link", { name: mode, exact: typeof mode === "string" }).click();
}
