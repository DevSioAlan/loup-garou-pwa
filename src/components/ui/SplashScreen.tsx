"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface SplashScreenProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Écran de chargement d'ouverture (~1,85 s) :
 * - Animation Lune de Sang (éclipse puis illumination)
 * - Révélation du titre "LUNE DE SANG"
 * - Bouton discret "Passer"
 * - Crédit créateur en bas avec lueur dorée/pourpre pulsante
 */
export function SplashScreen({ visible, onDismiss }: SplashScreenProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 1850);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-[#090A0F] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        >
          {/* Halo ambiant Lune de Sang */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0.2, scale: 0.7 }}
            animate={{ opacity: [0.25, 0.85, 0.65], scale: [0.75, 1.15, 1.02] }}
            transition={{ duration: 1.7, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(225, 29, 72, 0.5) 0%, rgba(124, 58, 237, 0.26) 52%, transparent 78%)",
            }}
          />

          {/* Barre supérieure avec bouton Passer */}
          <div className="relative z-10 flex w-full max-w-lg justify-end">
            <button
              type="button"
              onClick={onDismiss}
              className="glass-pill rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide text-slate-200 transition-colors hover:border-amber-300/40 hover:text-amber-100 active:scale-95"
            >
              Passer
            </button>
          </div>

          {/* Animation centrale : Lune qui s'éclipse / s'illumine + Titre */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-7 flex h-36 w-36 items-center justify-center">
              {/* Anneau doré externe */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border border-amber-400/45 shadow-[0_0_32px_rgba(212,175,55,0.28)]"
              />

              {/* Disque lunaire écarlate */}
              <motion.div
                initial={{ scale: 0.82, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="relative h-28 w-28 overflow-hidden rounded-full bg-gradient-to-br from-rose-500 via-rose-800 to-[#2E0616] shadow-[0_0_50px_rgba(225,29,72,0.65)]"
              >
                {/* Ombre d'éclipse glissant pour révéler la lune de sang */}
                <motion.div
                  initial={{ x: 0, y: 0 }}
                  animate={{ x: 26, y: -18 }}
                  transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-1 rounded-full bg-[#090A0F]/90 blur-[1px]"
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.65, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.28em] uppercase text-amber-200/80">
                <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
                <span>La Nuit Tombe</span>
              </span>
              <h1 className="font-display title-aura-text bg-gradient-to-b from-amber-50 via-amber-200 to-amber-500/90 bg-clip-text text-4xl font-bold tracking-[0.08em] text-transparent sm:text-5xl">
                LUNE DE SANG
              </h1>
            </motion.div>
          </div>

          {/* Crédit créateur en bas avec lueur dorée/pourpre pulsante */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="relative z-10 text-center"
          >
            <p className="font-display credit-glow-text text-xs tracking-[0.22em] uppercase text-amber-200/90">
              Créé par Alan Mirat
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
