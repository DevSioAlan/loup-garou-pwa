export const HAPTIC_PULSE_EVENT = "lune-de-sang-haptic-pulse";

/**
 * Déclenche une courte vibration tactile sur Android / Chrome,
 * ainsi qu'une micro-impulsion visuelle personnalisée pour iOS Safari / desktop.
 */
export function triggerHaptic(pattern: number | number[] = 25): boolean {
  let vibrated = false;

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      vibrated = Boolean(navigator.vibrate(pattern));
    } catch {
      vibrated = false;
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(HAPTIC_PULSE_EVENT));
    } catch {
      // Ignore si CustomEvent bloqué
    }
  }

  return vibrated;
}
