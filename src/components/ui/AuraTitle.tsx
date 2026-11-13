"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Titre principal avec typographie Cinzel et double aura lumineuse pulsante
 * (halo flouté en arrière-plan + text-shadow animé).
 */
export function AuraTitle() {
  return (
    <header className="relative flex flex-col items-center pt-1 text-center">
      {/* Lueur lunaire renforcée derrière le titre en verre dépoli */}
      <div className="relative flex w-full flex-col items-center">
        <motion.div
          aria-hidden="true"
          animate={{
            opacity: [0.58, 0.92, 0.58],
            scale: [0.96, 1.06, 0.96],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 rounded-full blur-3xl will-change-transform"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(205, 29, 68, 0.48) 0%, rgba(212, 175, 55, 0.24) 40%, rgba(124, 58, 237, 0.24) 68%, transparent 88%)",
          }}
        />

        {/* Capsule Dark Frosted Glass style Apple autour du titre */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel relative flex w-full flex-col items-center overflow-hidden rounded-[26px] px-4 py-3.5 sm:px-7 sm:py-4"
        >
          {/* Reflet spéculaire subtil interne en haut de la capsule */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />

          {/* Halo interne discret derrière LUNE DE SANG */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(225, 29, 72, 0.32) 0%, rgba(212, 175, 55, 0.2) 48%, transparent 78%)",
            }}
          />

          {/* Badge mystique supérieur */}
          <div className="relative z-10 mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-0.5 text-[10px] font-medium tracking-[0.2em] uppercase text-amber-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
            <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
            <span>Le Village s&apos;éveille</span>
          </div>

          <h1 className="relative z-10 whitespace-nowrap font-display title-aura-text bg-gradient-to-b from-amber-50 via-amber-200 to-amber-500/90 bg-clip-text text-[clamp(1.65rem,7.8vw,2.85rem)] leading-tight font-bold tracking-[0.07em] text-transparent">
            LUNE DE SANG
          </h1>

          {/* Filet ornemental doré */}
          <div className="relative z-10 mt-2 flex items-center gap-2.5 opacity-85">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/70" />
            <span className="h-1.5 w-1.5 rotate-45 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.85)]" />
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/70" />
          </div>

          <p className="relative z-10 mt-2 max-w-xs text-[11px] leading-relaxed text-slate-300/85 sm:max-w-sm sm:text-xs">
            Loup-Garou en ligne entre amis &amp; famille. Gardez votre rôle secret sous le regard de la meute.
          </p>
        </motion.div>
      </div>
    </header>
  );
}
