import type { GamePhase } from "@/types/game";

let audioCtx: AudioContext | null = null;

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
      // Accord mystique grave de la nuit
      playTone(146.83, 0, 1.1, "sine", 0.08);
      playTone(220.0, 0.12, 1.0, "triangle", 0.05);
      playTone(261.63, 0.25, 0.9, "sine", 0.04);
    } else if (phase === "DAY_ANNOUNCEMENT" || phase === "DAY_VOTE") {
      // Cloche claire de l'aube
      playTone(440, 0, 0.7, "sine", 0.07);
      playTone(554.37, 0.14, 0.8, "sine", 0.06);
      playTone(659.25, 0.28, 0.95, "triangle", 0.05);
    } else if (phase === "HUNTER_SHOT") {
      // Signal d'alerte vif
      playTone(329.63, 0, 0.25, "sawtooth", 0.045);
      playTone(246.94, 0.18, 0.45, "triangle", 0.06);
    } else if (phase === "VICTORY") {
      // Arpège solennel de victoire
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

/**
 * Synthèse vocale française (window.speechSynthesis) pour le Mode Narrateur Automatique.
 */
export function speakFrenchNarration(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.96;
    utterance.pitch = 0.92;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith("fr")
    );
    if (frVoice) {
      utterance.voice = frVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Repli silencieux
  }
}

export function stopFrenchNarration(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore
  }
}
