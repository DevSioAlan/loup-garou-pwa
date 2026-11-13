"use client";

import { motion } from "framer-motion";

const STARS = [
  { top: "8%", left: "14%", size: 2, delay: 0.2 },
  { top: "13%", left: "82%", size: 2.5, delay: 1.1 },
  { top: "19%", left: "28%", size: 1.5, delay: 0.6 },
  { top: "24%", left: "67%", size: 2, delay: 1.7 },
  { top: "32%", left: "10%", size: 1.5, delay: 2.3 },
  { top: "37%", left: "89%", size: 2, delay: 0.9 },
  { top: "48%", left: "18%", size: 2, delay: 1.4 },
  { top: "54%", left: "78%", size: 1.5, delay: 2.0 },
  { top: "68%", left: "12%", size: 2, delay: 0.4 },
  { top: "73%", left: "86%", size: 2.5, delay: 1.8 },
  { top: "82%", left: "34%", size: 1.5, delay: 1.2 },
  { top: "88%", left: "71%", size: 2, delay: 2.5 },
];

// Braises rougeâtres et poussière lunaire dorée (coordonnées déterministes anti-hydratation)
const FLOATING_PARTICLES = [
  { top: "92%", left: "12%", size: 3, kind: "ember", duration: 9, delay: 0, driftX: 16 },
  { top: "86%", left: "28%", size: 2.5, kind: "dust", duration: 11, delay: 1.2, driftX: -14 },
  { top: "94%", left: "44%", size: 3.5, kind: "ember", duration: 10, delay: 2.1, driftX: 12 },
  { top: "84%", left: "62%", size: 2.5, kind: "dust", duration: 12, delay: 0.5, driftX: -18 },
  { top: "91%", left: "78%", size: 3, kind: "ember", duration: 9.5, delay: 3.0, driftX: 14 },
  { top: "88%", left: "90%", size: 2, kind: "dust", duration: 10.5, delay: 1.8, driftX: -12 },
  { top: "70%", left: "20%", size: 2.5, kind: "dust", duration: 13, delay: 2.6, driftX: 18 },
  { top: "75%", left: "54%", size: 3, kind: "ember", duration: 11, delay: 4.1, driftX: -16 },
  { top: "66%", left: "82%", size: 2.5, kind: "dust", duration: 12.5, delay: 0.9, driftX: 10 },
  { top: "60%", left: "38%", size: 3, kind: "ember", duration: 10.2, delay: 3.4, driftX: -10 },
];

/**
 * Arrière-plan atmosphérique Dark Fantasy / Lune de Sang.
 * Inclut braises rougeâtres flottantes et poussière lunaire dorée (GPU-composité 60fps).
 */
export function BloodMoonBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#090A0F]"
    >
      {/* Brume pourpre et abyssale */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% -8%, rgba(155, 27, 48, 0.34) 0%, rgba(88, 28, 135, 0.16) 36%, rgba(9, 10, 15, 0.98) 76%)",
        }}
      />

      {/* Halo de la Lune de Sang en haut de l'écran */}
      <motion.div
        initial={{ opacity: 0.55, scale: 0.96 }}
        animate={{ opacity: [0.55, 0.78, 0.55], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 -top-24 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl sm:h-96 sm:w-96"
        style={{
          background:
            "radial-gradient(circle, rgba(225, 29, 72, 0.42) 0%, rgba(124, 58, 237, 0.2) 52%, transparent 75%)",
        }}
      />

      {/* Disque subtil d'éclipse lunaire */}
      <div className="absolute left-1/2 -top-14 h-36 w-36 -translate-x-1/2 rounded-full border border-rose-300/15 bg-gradient-to-b from-rose-700/25 via-rose-950/30 to-transparent shadow-[0_0_60px_rgba(225,29,72,0.28)] sm:h-44 sm:w-44">
        <div className="absolute right-2 top-2 h-28 w-28 rounded-full bg-[#090A0F]/80 blur-[2px] sm:h-36 sm:w-36" />
      </div>

      {/* Brume dorée discrète en bas pour ancrer les contrôles du pouce */}
      <div
        className="absolute inset-x-0 bottom-0 h-56 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 110%, rgba(212, 175, 55, 0.14) 0%, rgba(124, 58, 237, 0.08) 45%, transparent 75%)",
        }}
      />

      {/* Étoiles scintillantes */}
      {STARS.map((star, index) => (
        <motion.span
          key={`star-${index}`}
          className="absolute rounded-full bg-amber-100/70"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.18, 0.8, 0.18], scale: [1, 1.35, 1] }}
          transition={{
            duration: 3.8 + (index % 3),
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Particules flottantes : braises rougeâtres et poussière lunaire dorée */}
      {FLOATING_PARTICLES.map((p, index) => (
        <motion.span
          key={`particle-${index}`}
          className="absolute rounded-full will-change-transform"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.kind === "ember" ? "#FB7185" : "#FDE68A",
            boxShadow:
              p.kind === "ember"
                ? "0 0 8px rgba(244, 63, 94, 0.8)"
                : "0 0 8px rgba(253, 230, 138, 0.75)",
          }}
          animate={{
            y: [0, -190, -340],
            x: [0, p.driftX, p.driftX * 0.4],
            opacity: [0, 0.72, 0],
            scale: [0.7, 1.15, 0.5],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
