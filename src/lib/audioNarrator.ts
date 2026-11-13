import type { GamePhase } from "@/types/game";

let audioCtx: AudioContext | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let speechGeneration = 0;
let serverTtsDisabled = false;

const MAX_CACHE_ENTRIES = 60;
const audioUrlCache = new Map<string, string>();
const inFlightTts = new Map<string, Promise<string | null>>();

const PREFERRED_FEMALE_VOICE_TOKENS = [
  "denise",
  "vivienne",
  "eloise",
  "henriette",
  "celeste",
  "céleste",
  "charline",
  "brigitte",
  "sylvie",
  "google français",
  "google french",
  "amélie",
  "amelie",
  "audrey",
  "aurélie",
  "aurelie",
  "chloé",
  "chloe",
  "virginie",
  "léa",
  "lea",
  "julie",
  "marie",
  "siri",
  "female",
];

const MALE_VOICE_TOKENS = [
  "thomas",
  "paul",
  "henri",
  "alain",
  "nicolas",
  "daniel",
  "claude",
  "rémy",
  "remy",
  "mathieu",
  "martin",
  "guillaume",
  "jerome",
  "jérôme",
  "antoine",
  "male",
];

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * À appeler sur une interaction utilisateur pour débloquer l'audio Web Audio / HTMLAudio sur iOS Safari.
 */
export function unlockAudioPlayback(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
}

/**
 * Effets sonores d'ambiance synthétiques (Web Audio API, 0 dépendance externe).
 */
export function playPhaseSoundEffect(phase: GamePhase): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType,
      peakGain: number
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.04);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + startOffset + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (
      phase === "NIGHT_CUPIDON" ||
      phase === "NIGHT_SEER" ||
      phase === "NIGHT_WEREWOLVES" ||
      phase === "NIGHT_WITCH"
    ) {
      playTone(146.83, 0, 1.1, "sine", 0.08);
      playTone(220.0, 0.12, 1.0, "triangle", 0.05);
      playTone(261.63, 0.25, 0.9, "sine", 0.04);
    } else if (phase === "DAY_ANNOUNCEMENT" || phase === "DAY_VOTE") {
      playTone(440, 0, 0.7, "sine", 0.07);
      playTone(554.37, 0.14, 0.8, "sine", 0.06);
      playTone(659.25, 0.28, 0.95, "triangle", 0.05);
    } else if (phase === "HUNTER_SHOT") {
      playTone(329.63, 0, 0.25, "sawtooth", 0.045);
      playTone(246.94, 0.18, 0.45, "triangle", 0.06);
    } else if (phase === "VICTORY") {
      playTone(392.0, 0, 0.5, "triangle", 0.07);
      playTone(493.88, 0.15, 0.55, "triangle", 0.07);
      playTone(587.33, 0.3, 0.7, "sine", 0.075);
      playTone(783.99, 0.45, 1.1, "sine", 0.08);
    } else if (phase === "ROLE_REVEAL") {
      playTone(293.66, 0, 0.8, "sine", 0.06);
      playTone(440.0, 0.16, 0.8, "sine", 0.045);
    }
  } catch {
    // Repli silencieux si Web Audio est bloqué
  }
}

function rememberCachedAudioUrl(key: string, objectUrl: string): void {
  if (audioUrlCache.has(key)) {
    const existing = audioUrlCache.get(key);
    audioUrlCache.delete(key);
    if (existing && existing !== objectUrl) {
      URL.revokeObjectURL(existing);
    }
  } else if (audioUrlCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = audioUrlCache.keys().next().value;
    if (oldestKey) {
      const oldestUrl = audioUrlCache.get(oldestKey);
      audioUrlCache.delete(oldestKey);
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }
  }
  audioUrlCache.set(key, objectUrl);
}

async function fetchNeuralTtsUrl(text: string): Promise<string | null> {
  const normalizedKey = text.trim();
  if (!normalizedKey || serverTtsDisabled) return null;

  const cached = audioUrlCache.get(normalizedKey);
  if (cached) return cached;

  const pending = inFlightTts.get(normalizedKey);
  if (pending) return pending;

  const job = (async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalizedKey }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || contentType.includes("application/json")) {
        // Aucun fournisseur cloud actif ou quota épuisé : bascule proprement sans spammer le réseau
        serverTtsDisabled = true;
        return null;
      }

      const blob = await res.blob();
      if (!blob.size) return null;

      const url = URL.createObjectURL(blob);
      rememberCachedAudioUrl(normalizedKey, url);
      return url;
    } catch {
      return null;
    } finally {
      inFlightTts.delete(normalizedKey);
    }
  })();

  inFlightTts.set(normalizedKey, job);
  return job;
}

function pickBestFrenchFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const frenchVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("fr")
  );
  if (frenchVoices.length === 0) return null;

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;

  for (const voice of frenchVoices) {
    const lower = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    let score = 0;

    if (voice.lang.toLowerCase() === "fr-fr") score += 12;
    if (lower.includes("natural") || lower.includes("neural") || lower.includes("online")) {
      score += 30;
    }
    if (lower.includes("enhanced") || lower.includes("premium") || lower.includes("studio")) {
      score += 18;
    }

    const femaleIndex = PREFERRED_FEMALE_VOICE_TOKENS.findIndex((token) =>
      lower.includes(token)
    );
    if (femaleIndex >= 0) {
      score += 120 - femaleIndex * 3;
    }

    if (MALE_VOICE_TOKENS.some((token) => lower.includes(token))) {
      score -= 100;
    }

    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

function speakWithWebSpeechFallback(text: string, genId: number): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const runSpeak = () => {
    if (genId !== speechGeneration) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.94;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const bestVoice = pickBestFrenchFemaleVoice(voices);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Repli silencieux
    }
  };

  const initialVoices = window.speechSynthesis.getVoices();
  if (initialVoices.length > 0) {
    runSpeak();
    return;
  }

  let handled = false;
  const handleVoicesChanged = () => {
    if (handled) return;
    handled = true;
    window.speechSynthesis.removeEventListener?.(
      "voiceschanged",
      handleVoicesChanged
    );
    runSpeak();
  };

  window.speechSynthesis.addEventListener?.(
    "voiceschanged",
    handleVoicesChanged
  );
  window.setTimeout(() => {
    if (!handled) {
      handled = true;
      window.speechSynthesis.removeEventListener?.(
        "voiceschanged",
        handleVoicesChanged
      );
      runSpeak();
    }
  }, 260);
}

/**
 * Synthèse vocale féminine naturelle :
 * 1. Utilise /api/tts (Gemini / Google Neural TTS) avec cache client instantané si configuré.
 * 2. Retombe automatiquement sur la meilleure voix féminine française Web Speech API.
 */
export function speakFrenchNarration(text: string): void {
  if (typeof window === "undefined" || !text.trim()) return;

  stopFrenchNarration();
  const currentGen = speechGeneration;

  void (async () => {
    const audioUrl = await fetchNeuralTtsUrl(text);
    if (currentGen !== speechGeneration) return;

    if (audioUrl) {
      try {
        const audio = new Audio(audioUrl);
        currentAudioElement = audio;
        await audio.play();
        return;
      } catch {
        currentAudioElement = null;
      }
    }

    speakWithWebSpeechFallback(text, currentGen);
  })();
}

export function stopFrenchNarration(): void {
  speechGeneration += 1;

  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // Ignore
    }
    currentAudioElement = null;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}
