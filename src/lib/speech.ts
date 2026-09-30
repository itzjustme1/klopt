import type { ContentLang } from "./types";

/**
 * Pronunciation with the device's own voices only. Voices that stream from a server
 * (localService === false, e.g. Chrome's "Google" voices) are never used, so no text leaves the device.
 */

const BCP47: Partial<Record<ContentLang, string>> = { nl: "nl", en: "en", fr: "fr", de: "de", es: "es", it: "it" };

let voices: SpeechSynthesisVoice[] = [];
let ready: Promise<void> | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

export function loadVoices(): Promise<void> {
  const s = synth();
  if (!s) return Promise.resolve();
  if (ready) return ready;
  ready = new Promise((resolve) => {
    const read = () => {
      voices = s.getVoices().filter((v) => v.localService);
      if (voices.length) resolve();
    };
    read();
    s.addEventListener?.("voiceschanged", read);
    // Some browsers never fire voiceschanged when there are no voices.
    setTimeout(resolve, 1500);
  });
  return ready;
}

export function voiceFor(lang: ContentLang): SpeechSynthesisVoice | undefined {
  const code = BCP47[lang];
  if (!code) return undefined;
  const matching = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(code));
  const preferred: Record<string, string> = { nl: "nl-nl", en: "en-gb", fr: "fr-fr", de: "de-de", es: "es-es", it: "it-it" };
  return matching.find((v) => v.lang.toLowerCase().replace("_", "-") === preferred[code]) ?? matching.find((v) => v.default) ?? matching[0];
}

export function canSpeak(lang: ContentLang): boolean {
  return !!synth() && !!voiceFor(lang);
}

export function speak(text: string, lang: ContentLang, rate = 0.9): void {
  const s = synth();
  const voice = voiceFor(lang);
  if (!s || !voice) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  s.speak(u);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
