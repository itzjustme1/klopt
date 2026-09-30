import { LIMITS } from "../config";
import { makeShareFile, parseShared, type Parsed, type SharedDeck } from "./backup";
import type { Card, Deck } from "./types";

const B64URL = /^[A-Za-z0-9_-]+$/;
/** Hard cap on a link payload we are willing to decode at all. */
const MAX_PAYLOAD_CHARS = 200_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflates with a byte cap so a crafted link can't expand to gigabytes. */
async function gunzip(bytes: Uint8Array, maxBytes: number): Promise<string | null> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(all);
  } catch {
    return null;
  }
}

export function shareJson(deck: Deck, cards: readonly Card[]): string {
  return JSON.stringify(makeShareFile(deck, cards));
}

/** Returns the link payload, or null if the deck is too big for a link. */
export async function encodeShare(deck: Deck, cards: readonly Card[]): Promise<string | null> {
  const payload = toBase64Url(await gzip(shareJson(deck, cards)));
  return payload.length <= LIMITS.shareLinkChars ? payload : null;
}

export async function decodeShare(payload: string): Promise<Parsed<SharedDeck>> {
  const bad = { ok: false as const, error: { code: "invalid" as const, where: "link" } };
  if (!payload || payload.length > MAX_PAYLOAD_CHARS || !B64URL.test(payload)) return bad;
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(payload);
  } catch {
    return bad;
  }
  const text = await gunzip(bytes, LIMITS.shareInflatedBytes);
  if (text === null) return bad;
  return parseShared(text);
}
