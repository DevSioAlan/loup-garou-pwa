/**
 * Déclenche une courte vibration tactile sur les appareils compatibles (Android),
 * avec repli silencieux sur iOS Safari et navigateurs desktop.
 */
export function triggerHaptic(pattern: number | number[] = 25): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // Repli silencieux si bloqué par la politique du navigateur
  }
}
