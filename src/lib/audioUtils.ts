/**
 * Web Audio API utilities for reliable sound playback.
 * Browsers limit HTML Audio elements; Web Audio API allows many simultaneous plays.
 * Safari has Web Audio bugs (shorter sounds, long sounds not playing) - we fall back to HTML Audio.
 */

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) ||
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator as unknown as { webkit?: unknown }).webkit !== undefined;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
  }
  return audioContext;
}

export async function getDecodedBuffer(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf);
}

const bufferCache = new Map<string, AudioBuffer>();

export async function loadSound(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const buf = await getDecodedBuffer(url);
  bufferCache.set(url, buf);
  return buf;
}

export function playBuffer(
  buffer: AudioBuffer,
  volume = 0.6,
  onEnded?: () => void,
): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().then(() => playBuffer(buffer, volume, onEnded));
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    if (onEnded) source.onended = onEnded;
    source.start(0);
  } catch {
    onEnded?.();
  }
}

function playSoundHtmlAudio(url: string, volume = 0.6, onEnded?: () => void): void {
  try {
    const audio = new Audio(url);
    audio.volume = volume;
    if (onEnded) audio.onended = onEnded;
    audio.play().catch(() => onEnded?.());
  } catch {
    onEnded?.();
  }
}

/**
 * Play a sound by URL. Loads and caches the buffer on first use.
 * Safe to call many times rapidly (e.g. for click sounds).
 * Safari: uses HTML Audio (Web Audio has bugs with short/long sounds).
 */
export function playSound(url: string, volume = 0.6): void {
  if (isSafari()) {
    playSoundHtmlAudio(url, volume);
    return;
  }
  getAudioContext().resume().catch(() => {});
  loadSound(url)
    .then((buf) => playBuffer(buf, volume))
    .catch(() => {});
}

/** Generate minimal WAV data URL for a sine tone (Safari fallback for synthesized sounds) */
function makeWavDataUrl(freq: number, durationSec: number, volume: number): string {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const bytes = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(bytes);
  const samples = new Int16Array(bytes, 44, numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.floor(Math.sin(2 * Math.PI * freq * t) * volume * 32767);
  }
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  let binary = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function playSafariTick(): void {
  playSoundHtmlAudio(makeWavDataUrl(800, 0.05, 0.2), 1);
}

function playSafariCelebration(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playSoundHtmlAudio(makeWavDataUrl(freq, 0.22, 0.25), 0.8);
    }, i * 150);
  });
}

function playSafariCard(): void {
  playSoundHtmlAudio(makeWavDataUrl(200, 0.08, 0.15), 1);
}

function playWebAudioTick(): void {
  try {
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});
    if (ctx.state === "suspended") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch { /* ignore */ }
}

function playWebAudioCelebration(): void {
  try {
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});
    if (ctx.state === "suspended") return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.25);
    });
  } catch { /* ignore */ }
}

function playWebAudioCard(): void {
  try {
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});
    if (ctx.state === "suspended") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 200;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* ignore */ }
}

/** Wheel tick when crossing sectors. Call from user gesture context (spin). */
export function playTickSound(): void {
  if (isSafari()) playSafariTick();
  else playWebAudioTick();
}

/** Celebration chime when wheel lands. */
export function playCelebrationSound(): void {
  if (isSafari()) playSafariCelebration();
  else playWebAudioCelebration();
}

/** Card deal sound in blackjack. */
export function playCardDealSound(): void {
  if (isSafari()) playSafariCard();
  else playWebAudioCard();
}

/** Resume AudioContext – call from user gesture (e.g. before spin) so Safari allows playback. */
export function resumeAudioContext(): void {
  getAudioContext().resume().catch(() => {});
}

/**
 * Play a sound and call onEnded when it finishes. For sequential playback.
 * Safari: uses HTML Audio for reliability.
 */
export function playSoundWithCallback(
  url: string,
  onEnded: () => void,
  volume = 0.6,
): void {
  if (isSafari()) {
    playSoundHtmlAudio(url, volume, onEnded);
    return;
  }
  getAudioContext().resume().catch(() => {});
  loadSound(url)
    .then((buf) => playBuffer(buf, volume, onEnded))
    .catch(() => onEnded());
}
