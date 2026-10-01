import { LIMITS } from "../config";

/**
 * Turns a photo or picture into a small JPEG data URL for a card: at most LIMITS.imagePixels on the
 * longest side, white behind transparent parts. Throws when the browser cannot read the file.
 */
export async function cardImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, LIMITS.imagePixels / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    // Lower the quality until it fits; a 640px photo is normally 40-90 kB at 0.8.
    for (const q of [0.8, 0.65, 0.5, 0.35]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= LIMITS.imageChars) return url;
    }
    throw new Error("Picture too large");
  } finally {
    bitmap.close();
  }
}
