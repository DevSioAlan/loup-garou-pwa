"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Crown,
  RotateCcw,
  Shuffle,
  SkipForward,
} from "lucide-react";
import type { DemoGamePhase } from "@/types/game";

interface OwnerControlPanelProps {
  currentPhase: DemoGamePhase;
  onForceNextPhase: () => void;
  onRedealRoles: () => void;
  onResetGame: () => void;
  lastActionNotice: string | null;
}

const PHASE_LABELS: Record<DemoGamePhase, string> = {
  distribution: "Distribution",
  night: "Nuit (Meute & Pouvoirs)",
  dawn: "Aube (Annonce)",
  vote: "Vote du Village",
};

/**
 * Panneau de contrôle discret réservé au Mode Owner :
 * - Forcer le passage à la phase suivante
 * - Relancer la distribution des rôles
 * - Réinitialiser la partie
 */
export function OwnerControlPanel({
  currentPhase,
  onForceNextPhase,
  onRedealRoles,
  onResetGame,
  lastActionNotice,
}: OwnerControlPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full">
      <div className="glass-panel overflow-hidden rounded-2xl border-amber-400/35">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-amber-100">
                Contrôle Owner
              </p>
              <p className="text-[10px] text-amber-200/75">
                Phase : {PHASE_LABELS[currentPhase]}
              </p>
            </div>
          </div>

          <ChevronDown
            className={`h-4 w-4 text-amber-200/80 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={onForceNextPhase}
                    className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-amber-300/30 bg-amber-400/10 px-2 py-1.5 text-[11px] font-medium text-amber-100 transition-transform active:scale-95"
                  >
                    <SkipForward className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    <span>Phase +1</span>
                  </button>

                  <button
                    type="button"
                    onClick={onRedealRoles}
                    className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-purple-300/30 bg-purple-500/15 px-2 py-1.5 text-[11px] font-medium text-purple-100 transition-transform active:scale-95"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
                    <span>Redistribuer</span>
                  </button>

                  <button
                    type="button"
                    onClick={onResetGame}
                    className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-rose-400/30 bg-rose-500/15 px-2 py-1.5 text-[11px] font-medium text-rose-100 transition-transform active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                    <span>Réinitialiser</span>
                  </button>
                </div>

                {lastActionNotice && (
                  <p className="text-center text-[11px] text-amber-200/90">
                    {lastActionNotice}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
