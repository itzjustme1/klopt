// Copies the OCR engine and language data into public/ocr so the app serves them itself.
// Runs before dev and build. Source-map comments are stripped: production ships no source maps.
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";

const out = "public/ocr";
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js", true],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [`node_modules/tesseract.js-core/${f}`, `core/${f}`, true]),
  ...["nld", "eng", "fra", "deu", "spa", "ita", "lat"].map((l) => [`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `lang/${l}.traineddata.gz`, false]),
];

await mkdir(`${out}/core`, { recursive: true });
await mkdir(`${out}/lang`, { recursive: true });
for (const [from, to, isText] of files) {
  const dest = `${out}/${to}`;
  const [a, b] = await Promise.all([stat(from), stat(dest).catch(() => null)]);
  if (b && b.mtimeMs >= a.mtimeMs) continue;
  if (isText) {
    const text = (await readFile(from, "utf8")).replace(/\n?\/\/# sourceMappingURL=\S+\s*$/g, "\n");
    await writeFile(dest, text);
  } else {
    await writeFile(dest, await readFile(from));
  }
}
console.log("OCR assets ready in", out);
