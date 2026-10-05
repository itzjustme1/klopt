import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { guard } from "./helpers";

test("a photo of a two-column word list becomes a list, on the device", async ({ page }) => {
  test.setTimeout(120_000);
  const check = await guard(page);
  await page.goto("/#/foto");
  await expect(page.getByRole("heading", { name: "Foto van je boek" })).toBeVisible();

  // Draw a clean "textbook" word list and turn it into a PNG, like a phone photo would be.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 620;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#111111";
    ctx.font = "56px Georgia, serif";
    const rows = [
      ["la maison", "het huis"],
      ["le chien", "de hond"],
      ["le livre", "het boek"],
      ["la pomme", "de appel"],
    ];
    rows.forEach(([a, b], i) => {
      ctx.fillText(a!, 80, 120 + i * 130);
      ctx.fillText(b!, 800, 120 + i * 130);
    });
    return c.toDataURL("image/png").split(",")[1]!;
  });

  await page.getByLabel("Taal links").selectOption("fr");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.locator('input[type="file"]').setInputFiles({ name: "lijst.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });

  // Recognition runs locally, then the import screen opens with the rows for checking.
  await expect(page.getByRole("heading", { name: "Lijst plakken" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Herkend uit je foto.", { exact: false })).toBeVisible();
  const text = await page.getByLabel("Je lijst").inputValue();
  const lines = text.split("\n");
  const expected = ["la maison\thet huis", "le chien\tde hond", "le livre\thet boek", "la pomme\tde appel"];
  const hits = expected.filter((e) => lines.includes(e)).length;
  expect(hits, `recognised:\n${text}`).toBeGreaterThanOrEqual(3);
  await expect(page.getByText(/woorden herkend/)).toBeVisible();

  await check();
});

test("on a laptop a photo can be dropped on the page", async ({ page }) => {
  test.setTimeout(120_000);
  const check = await guard(page);
  await page.goto("/#/foto");
  await page.getByRole("heading", { level: 1, name: "Foto van je boek" }).waitFor();
  // Drop a text file first: refused politely. Then a drawn word list.
  await page.evaluate(async () => {
    const zone = document.querySelector("section.photo")!;
    const drop = (file: File) => {
      const dt = new DataTransfer();
      dt.items.add(file);
      zone.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    };
    drop(new File(["hallo"], "notitie.txt", { type: "text/plain" }));
  });
  await expect(page.getByRole("alert")).toContainText("Dat is geen foto");
  await page.getByLabel("Taal links").selectOption("fr");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 360;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#111";
    ctx.font = "56px Georgia, serif";
    [["la maison", "het huis"], ["le chien", "de hond"]].forEach(([a, b], i) => {
      ctx.fillText(a!, 80, 120 + i * 130);
      ctx.fillText(b!, 800, 120 + i * 130);
    });
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "lijst.png", { type: "image/png" }));
    document.querySelector("section.photo")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("heading", { name: "Lijst plakken" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Je lijst")).toHaveValue(/la maison\thet huis/);
  await check();
});

test("on a laptop, take the photo of a word list with the camera", async ({ browser, playwright }) => {
  test.setTimeout(120_000);
  // A fake webcam that shows a two-column word list (Chrome plays a JPEG as a camera stream).
  const page0 = await browser.newPage();
  const jpeg = await page0.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 620;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fbfaf6";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#111";
    ctx.font = "56px Georgia, serif";
    [["la maison", "het huis"], ["le chien", "de hond"], ["le livre", "het boek"], ["la pomme", "de appel"]].forEach(([a, b], i) => {
      ctx.fillText(a!, 80, 120 + i * 130);
      ctx.fillText(b!, 800, 120 + i * 130);
    });
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  });
  await page0.close();
  const cam = test.info().outputPath("camera.mjpeg");
  await writeFile(cam, Buffer.from(jpeg, "base64"));
  const camBrowser = await playwright.chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${cam}`] });
  const ctx = await camBrowser.newContext({ viewport: { width: 1280, height: 860 }, locale: "nl-NL", permissions: ["camera"] });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:4173/#/foto");
  await page.getByLabel("Taal links").selectOption("fr");
  await page.getByLabel("Taal rechts").selectOption("nl");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Foto maken" });
  await expect(dialog.getByRole("button", { name: "Foto maken" })).toBeEnabled({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Foto maken" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Lijst plakken" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Je lijst")).toHaveValue(/la maison\thet huis/);
  expect(errors).toEqual([]);
  await camBrowser.close();
});

test("the camera window explains a refused camera", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: () => Promise.reject(new DOMException("no", "NotAllowedError")), enumerateDevices: () => Promise.resolve([]) } });
    // Act as a laptop: no touch points.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/plaatje");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Foto maken" }).getByRole("alert")).toContainText("Je browser mag de camera niet gebruiken");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
