"use client";

import { motion } from "framer-motion";

const STARS = [
  { top: "7%", left: "14%", size: 1.8, delay: 0.2 },
  { top: "13%", left: "82%", size: 2.2, delay: 1.1 },
  { top: "19%", left: "28%", size: 1.4, delay: 0.6 },
  { top: "24%", left: "67%", size: 1.8, delay: 1.7 },
  { top: "32%", left: "10%", size: 1.4, delay: 2.3 },
  { top: "37%", left: "89%", size: 1.8, delay: 0.9 },
  { top: "48%", left: "18%", size: 1.6, delay: 1.4 },
  { top: "54%", left: "78%", size: 1.4, delay: 2.0 },
  { top: "68%", left: "12%", size: 1.8, delay: 0.4 },
  { top: "73%", left: "86%", size: 2.2, delay: 1.8 },
  { top: "82%", left: "34%", size: 1.4, delay: 1.2 },
  { top: "88%", left: "71%", size: 1.8, delay: 2.5 },
];

// Braises discrètes et poussière lunaire (coordonnées déterministes anti-hydratation)
const FLOATING_PARTICLES = [
  { top: "92%", left: "12%", size: 2.4, kind: "ember", duration: 12, delay: 0, driftX: 14 },
  { top: "86%", left: "28%", size: 2, kind: "dust", duration: 14, delay: 1.2, driftX: -12 },
  { top: "94%", left: "44%", size: 2.6, kind: "ember", duration: 13, delay: 2.1, driftX: 10 },
  { top: "84%", left: "62%", size: 2, kind: "dust", duration: 15, delay: 0.5, driftX: -14 },
  { top: "91%", left: "78%", size: 2.4, kind: "ember", duration: 12.5, delay: 3.0, driftX: 12 },
  { top: "88%", left: "90%", size: 1.8, kind: "dust", duration: 13.5, delay: 1.8, driftX: -10 },
  { top: "70%", left: "20%", size: 2, kind: "dust", duration: 16, delay: 2.6, driftX: 14 },
  { top: "75%", left: "54%", size: 2.2, kind: "ember", duration: 14, delay: 4.1, driftX: -12 },
];

/**
 * Arrière-plan atmosphérique Dark Frosted Glass / Lune de Sang :
 * - Nébuleuse & aurore sombre en dégradés radiaux GPU-composités qui respirent lentement
 * - Halo de Lune de Sang renforcé mais doux, sans saturation criarde
 * - Brume lumineuse mobile pour révéler la profondeur du verre dépoli
 */
export function BloodMoonBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07080D]"
    >
      {/* Socle abyssal profond avec léger dégradé nocturne */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 85% at 50% -6%, rgba(162, 24, 52, 0.44) 0%, rgba(92, 30, 145, 0.26) 40%, rgba(9, 10, 15, 0.94) 78%, #06070B 100%)",
        }}
      />

      {/* Aurore sombre gauche — volute cramoisie / prune en dérive lente (GPU) */}
      <div
        className="animate-aurora-drift-left absolute -left-24 top-[14%] h-[460px] w-[460px] rounded-full blur-3xl sm:h-[600px] sm:w-[600px]"
        style={{
          background:
            "radial-gradient(circle, rgba(182, 26, 62, 0.34) 0%, rgba(114, 34, 174, 0.18) 48%, transparent 74%)",
        }}
      />

      {/* Aurore sombre droite — nébuleuse indigo / améthyste en respiration lente (GPU) */}
      <div
        className="animate-aurora-drift-right absolute -right-24 top-[32%] h-[480px] w-[480px] rounded-full blur-3xl sm:h-[640px] sm:w-[640px]"
        style={{
          background:
            "radial-gradient(circle, rgba(102, 36, 168, 0.34) 0%, rgba(172, 24, 82, 0.18) 46%, transparent 74%)",
        }}
      />

      {/* Brume lumineuse subtile en mouvement au centre pour sublimer le verre dépoli */}
      <div
        className="animate-mist-glide absolute left-[-15%] top-[42%] h-[380px] w-[130%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse 70% 52% at 50% 50%, rgba(202, 28, 66, 0.2) 0%, rgba(124, 58, 237, 0.2) 42%, rgba(212, 175, 55, 0.1) 64%, transparent 78%)",
        }}
      />

      {/* Couronne renforcée et enveloppante de la Lune de Sang en haut de l'écran */}
      <div
        className="animate-aurora-breathe absolute left-1/2 -top-28 h-[420px] w-[420px] rounded-full blur-3xl sm:-top-32 sm:h-[560px] sm:w-[560px]"
        style={{
          background:
            "radial-gradient(circle, rgba(220, 32, 72, 0.5) 0%, rgba(148, 28, 92, 0.32) 38%, rgba(98, 36, 188, 0.2) 62%, transparent 76%)",
        }}
      />

      {/* Disque subtil d'éclipse lunaire avec lueur de limbe raffinée */}
      <div className="absolute left-1/2 -top-12 h-40 w-40 -translate-x-1/2 rounded-full border border-rose-200/25 bg-gradient-to-b from-rose-500/35 via-rose-900/40 to-transparent shadow-[0_0_100px_rgba(215,32,74,0.48),inset_0_0_32px_rgba(255,220,225,0.16)] sm:h-48 sm:w-48">
        <div className="absolute right-2.5 top-2.5 h-32 w-32 rounded-full bg-[#07080D]/86 blur-[1.5px] sm:h-38 sm:w-38" />
      </div>

      {/* Brume ambrée/pourpre douce en bas pour ancrer la barre d'actions */}
      <div
        className="absolute inset-x-0 bottom-0 h-64 opacity-75"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 108%, rgba(212, 175, 55, 0.14) 0%, rgba(124, 58, 237, 0.11) 42%, rgba(155, 27, 48, 0.08) 62%, transparent 78%)",
        }}
      />

      {/* Étoiles scintillantes */}
      {STARS.map((star, index) => (
        <motion.span
          key={`star-${index}`}
          className="absolute rounded-full bg-amber-100/65"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.14, 0.65, 0.14], scale: [1, 1.25, 1] }}
          transition={{
            duration: 4.5 + (index % 3),
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Particules flottantes discrètes : braises & poussière lunaire */}
      {FLOATING_PARTICLES.map((p, index) => (
        <motion.span
          key={`particle-${index}`}
          className="absolute rounded-full will-change-transform"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.kind === "ember" ? "rgba(251, 113, 133, 0.85)" : "rgba(253, 230, 138, 0.85)",
            boxShadow:
              p.kind === "ember"
                ? "0 0 10px rgba(225, 29, 72, 0.55)"
                : "0 0 10px rgba(253, 230, 138, 0.5)",
          }}
          animate={{
            y: [0, -180, -320],
            x: [0, p.driftX, p.driftX * 0.35],
            opacity: [0, 0.48, 0],
            scale: [0.75, 1.05, 0.6],
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
