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
