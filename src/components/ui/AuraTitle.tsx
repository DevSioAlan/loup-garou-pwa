"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Titre principal avec typographie Cinzel et double aura lumineuse pulsante
 * (halo flouté en arrière-plan + text-shadow animé).
 */
export function AuraTitle() {
  return (
    <header className="relative flex flex-col items-center text-center pt-2">
      {/* Badge mystique supérieur */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase text-amber-200/90 backdrop-blur-md"
      >
        <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
        <span>Le Village s&apos;éveille</span>
      </motion.div>

      {/* Halo flouté pulsant derrière le titre */}
      <div className="relative inline-flex flex-col items-center">
        <motion.div
          aria-hidden="true"
          animate={{
            opacity: [0.45, 0.85, 0.45],
            scale: [0.95, 1.07, 0.95],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute -inset-x-8 -inset-y-3 -z-10 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(225, 29, 72, 0.48) 0%, rgba(212, 175, 55, 0.28) 45%, rgba(124, 58, 237, 0.18) 75%, transparent 100%)",
          }}
        />

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="font-display title-aura-text bg-gradient-to-b from-amber-50 via-amber-200 to-amber-500/90 bg-clip-text text-4xl font-bold tracking-[0.06em] text-transparent sm:text-5xl"
        >
          LUNE DE SANG
        </motion.h1>
      </div>

      {/* Filet ornemental doré */}
      <div className="mt-2 flex items-center gap-2.5 opacity-80">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/70" />
        <span className="h-1.5 w-1.5 rotate-45 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/70" />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mt-2.5 max-w-xs text-xs leading-relaxed text-slate-300/85 sm:max-w-sm sm:text-sm"
      >
        Loup-Garou en ligne entre amis &amp; famille. Gardez votre rôle secret sous le regard de la meute.
      </motion.p>
    </header>
  );
}
