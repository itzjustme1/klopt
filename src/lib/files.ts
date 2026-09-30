/** Saves text as a file via a temporary object URL. Nothing leaves the device. */
export function downloadText(name: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Reads a user-chosen file as text, refusing anything over maxBytes before reading it. */
export async function readTextFile(file: File, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; reason: "tooBig" | "read" }> {
  if (file.size > maxBytes) return { ok: false, reason: "tooBig" };
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, reason: "read" };
  }
}
