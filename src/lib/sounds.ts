/**
 * Feedback sounds made with WebAudio (no audio files, nothing downloaded) and a short vibration on
 * wrong answers where the device supports it. Everything is skipped quietly when unavailable.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, length: number, type: OscillatorType, volume: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** Two quick rising notes. */
export function playRight(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 880, t, 0.12, "sine", 0.12);
  tone(ac, 1318.5, t + 0.09, 0.18, "sine", 0.12);
}

/** A soft low double tone, and a short buzz on phones. */
export function playWrong(): void {
  const ac = audio();
  if (ac) {
    const t = ac.currentTime;
    tone(ac, 220, t, 0.16, "triangle", 0.14);
    tone(ac, 174.6, t + 0.12, 0.22, "triangle", 0.14);
  }
  try {
    navigator.vibrate?.(60);
  } catch {
    // Not supported.
  }
}
