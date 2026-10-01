import { practise } from "./helpers";
import { expect, test } from "@playwright/test";

test("the CSP blocks inline script and third-party requests, and never allows eval", async ({ page }) => {
  await page.goto("/");
  await page.locator("h1, h2").first().waitFor();
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).toContain("style-src 'self'");
  // 'wasm-unsafe-eval' only allows compiling WebAssembly (on-device OCR); JS eval stays blocked.
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toMatch(/https?:/);

  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (e) => violations.push(e.violatedDirective));
    const w = window as unknown as { __ran?: boolean };

    const s = document.createElement("script");
    s.textContent = "window.__ran = true";
    document.head.append(s);

    let fetchBlocked = false;
    try {
      await fetch("https://example.com/");
    } catch {
      fetchBlocked = true;
    }
    await new Promise((r) => setTimeout(r, 100));
    return { ran: w.__ran === true, fetchBlocked, violations };
  });

  expect(result.ran).toBe(false);
  expect(result.fetchBlocked).toBe(true);
  expect(result.violations).toEqual(expect.arrayContaining(["script-src-elem", "connect-src"]));
});

test("card text with HTML is shown as text everywhere", async ({ page }) => {
  await page.goto("/#/importeren");
  await page.getByLabel("Je lijst").fill('<img src=x onerror="document.title=\'pwned\'">;<b>vet</b>');
  await page.getByLabel("Naam van de nieuwe lijst").fill("<i>XSS</i>");
  await page.getByRole("button", { name: "1 woord toevoegen" }).click();
  await page.getByRole("link", { name: "Naar de lijst" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("<i>XSS</i>");
  await expect(page.locator(".w-front")).toHaveText('<img src=x onerror="document.title=\'pwned\'">');
  await practise(page, /^Flashcards/);
  await page.locator(".flip").waitFor();
  await page.keyboard.press("Space");
  await expect(page.locator(".face.back .prompt")).toHaveText("<b>vet</b>");
  expect(await page.locator("main img, main b, main i").count()).toBe(0);
  expect(await page.title()).not.toBe("pwned");
});
