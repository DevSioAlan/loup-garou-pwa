"use client";

import type { GamePhase, TtsVoiceName } from "@/types/game";

export type TtsTone = "night" | "day" | "victory";

export interface NarrationOptions {
  voice?: TtsVoiceName;
  tone?: TtsTone;
}

const SESSION_CACHE_PREFIX = "lds_tts_v2_";
const MAX_SESSION_AUDIO_CHARS = 260_000;
const ttsMemoryCache = new Map<string, string>();
const pendingTtsFetches = new Map<string, Promise<string | null>>();

let currentAudio: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let ttsCooldownUntil = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume().catch(() => undefined);
  }
  return sharedAudioContext;
}

export function unlockAudioPlayback(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.getVoices();
    } catch {
      // Ignore sur certains navigateurs mobiles
    }
  }
}

function buildCacheKey(
  text: string,
  voice: TtsVoiceName,
  tone: TtsTone
): string {
  return `${voice}::${tone}::${text.trim()}`;
}

function makeSessionKey(cacheKey: string): string {
  let hash = 2166136261;
  for (let i = 0; i < cacheKey.length; i++) {
    hash ^= cacheKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${SESSION_CACHE_PREFIX}${(hash >>> 0).toString(36)}`;
}

function readCachedDataUrl(cacheKey: string): string | null {
  const memHit = ttsMemoryCache.get(cacheKey);
  if (memHit) return memHit;

  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(makeSessionKey(cacheKey));
    if (stored && stored.startsWith("data:audio/")) {
      ttsMemoryCache.set(cacheKey, stored);
      return stored;
    }
  } catch {
    // sessionStorage indisponible
  }
  return null;
}

function writeCachedDataUrl(cacheKey: string, dataUrl: string): void {
  ttsMemoryCache.set(cacheKey, dataUrl);
  if (typeof window === "undefined") return;
  if (dataUrl.length > MAX_SESSION_AUDIO_CHARS) return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(SESSION_CACHE_PREFIX)) keys.push(k);
    }
    if (keys.length >= 12) {
      window.sessionStorage.removeItem(keys[0]);
    }
    window.sessionStorage.setItem(makeSessionKey(cacheKey), dataUrl);
  } catch {
    // Quota sessionStorage atteint
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Audio conversion failed"));
    };
    reader.onerror = () => reject(new Error("Audio read failed"));
    reader.readAsDataURL(blob);
  });
}

async function fetchOrLoadCachedAudio(
  text: string,
  voice: TtsVoiceName,
  tone: TtsTone
): Promise<string | null> {
  const clean = text.trim();
  if (!clean) return null;

  const cacheKey = buildCacheKey(clean, voice, tone);
  const existing = readCachedDataUrl(cacheKey);
  if (existing) return existing;

  if (Date.now() < ttsCooldownUntil) return null;

  const inflight = pendingTtsFetches.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice, tone }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("audio/")) {
        if (response.status >= 429) {
          ttsCooldownUntil = Date.now() + 45_000;
        }
        return null;
      }

      const blob = await response.blob();
      if (blob.size < 128) return null;

      const dataUrl = await blobToDataUrl(blob);
      writeCachedDataUrl(cacheKey, dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      pendingTtsFetches.delete(cacheKey);
    }
  })();

  pendingTtsFetches.set(cacheKey, task);
  return task;
}

function selectBestFrenchFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  const frVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("fr")
  );
  if (frVoices.length === 0) return null;

  const preferredKeywords = [
    "google français",
    "denise",
    "vivienne",
    "eloise",
    "hortense",
    "julie",
    "amelie",
    "audrey",
    "aurelie",
    "virginie",
    "sylvie",
    "celine",
    "lea",
    "natural",
    "online",
  ];

  for (const kw of preferredKeywords) {
    const match = frVoices.find((v) => v.name.toLowerCase().includes(kw));
    if (match) return match;
  }

  const nonMale = frVoices.find(
    (v) =>
      !/thomas|paul|henri|nicolas|alain|daniel|guillaume|remy|claude|mathieu/i.test(
        v.name
      )
  );
  return nonMale ?? frVoices[0];
}

function speakWithBrowserFallback(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.94;
    utterance.pitch = 1.04;
    utterance.volume = 0.95;

    const voice = selectBestFrenchFemaleVoice();
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Web Speech API bloquée ou indisponible
  }
}

export function stopFrenchNarration(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export function preloadFrenchNarration(
  text: string,
  options?: NarrationOptions
): void {
  if (typeof window === "undefined") return;
  const clean = text.trim();
  if (!clean) return;

  const voice = options?.voice ?? "Aoede";
  const tone = options?.tone ?? "night";
  void fetchOrLoadCachedAudio(clean, voice, tone);
}

export async function speakFrenchNarration(
  text: string,
  options?: NarrationOptions
): Promise<void> {
  if (typeof window === "undefined") return;
  const clean = text.trim();
  if (!clean) return;

  stopFrenchNarration();

  const voice = options?.voice ?? "Aoede";
  const tone = options?.tone ?? "night";
  const dataUrl = await fetchOrLoadCachedAudio(clean, voice, tone);

  if (dataUrl) {
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 0.95;
      currentAudio = audio;
      await audio.play();
      return;
    } catch {
      // Repli automatique vers synthèse vocale si autoplay bloqué sur audio element
    }
  }

  speakWithBrowserFallback(clean);
}

export function playPhaseSoundEffect(phase: GamePhase): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const playTone = (
    freq: number,
    startOffset: number,
    duration: number,
    gainPeak: number,
    type: OscillatorType = "sine"
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.04);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + startOffset + duration
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.03);
  };

  if (phase.startsWith("NIGHT_")) {
    playTone(220, 0, 0.7, 0.055, "sine");
    playTone(261.63, 0.14, 0.75, 0.045, "sine");
    playTone(329.63, 0.28, 0.85, 0.04, "triangle");
    return;
  }

  if (phase === "DAY_ANNOUNCEMENT" || phase === "DAY_VOTE") {
    playTone(392, 0, 0.55, 0.05, "triangle");
    playTone(493.88, 0.12, 0.65, 0.055, "sine");
    playTone(587.33, 0.24, 0.85, 0.045, "sine");
    return;
  }

  if (phase === "HUNTER_SHOT") {
    playTone(146.83, 0, 0.5, 0.08, "triangle");
    playTone(293.66, 0.08, 0.45, 0.05, "sine");
    return;
  }

  if (phase === "VICTORY") {
    playTone(392, 0, 0.5, 0.055, "triangle");
    playTone(493.88, 0.12, 0.55, 0.055, "sine");
    playTone(587.33, 0.24, 0.65, 0.06, "sine");
    playTone(783.99, 0.36, 1.0, 0.065, "triangle");
  }
}

export function playCountdownTickSound(secondsLeft: number): void {
  const ctx = getAudioContext();
  if (!ctx || secondsLeft < 1 || secondsLeft > 5) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(secondsLeft === 1 ? 1046.5 : 880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(
    secondsLeft === 1 ? 0.045 : 0.025,
    now + 0.01
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}
