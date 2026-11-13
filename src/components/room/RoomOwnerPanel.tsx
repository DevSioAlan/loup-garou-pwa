"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Crown,
  HeartPulse,
  RotateCcw,
  Skull,
  SkipForward,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import {
  advanceRoomPhase,
  getPhaseLabel,
  ownerTogglePlayerAlive,
  resetRoomToLobby,
} from "@/lib/roomService";
import type { RoomPlayerRecord, RoomRecord } from "@/types/game";

interface RoomOwnerPanelProps {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  onRefresh: () => Promise<void>;
}

/**
 * Panneau de contrôle discret en partie pour le Mode Owner (alucard / 5 clics) :
 * - Passer une phase bloquée
 * - Éliminer / Ressusciter n'importe quel joueur en cas de bug
 * - Relancer la partie (retour au salon)
 */
export function RoomOwnerPanel({
  room,
  players,
  onRefresh,
}: RoomOwnerPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleForceAdvance = async () => {
    setBusy(true);
    triggerHaptic(25);
    try {
      await advanceRoomPhase(room, players);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    triggerHaptic(25);
    try {
      await resetRoomToLobby(room.id);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAlive = async (player: RoomPlayerRecord) => {
    setBusy(true);
    triggerHaptic(25);
    try {
      await ownerTogglePlayerAlive(player.id, !player.is_alive);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border-amber-400/40">
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
              Contrôle Owner (Live)
            </p>
            <p className="text-[10px] text-amber-200/75">
              {getPhaseLabel(room.phase)} • Tour {room.turn_number}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-amber-200/80 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy || room.phase === "LOBBY" || room.phase === "VICTORY"}
                  onClick={handleForceAdvance}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-400/15 px-3 text-xs font-semibold text-amber-100 disabled:opacity-40"
                >
                  <SkipForward className="h-3.5 w-3.5 text-amber-300" />
                  <span>Passer phase</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleReset}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-300" />
                  <span>Relancer partie</span>
                </button>
              </div>

              {room.phase !== "LOBBY" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                    Éliminer / Ressusciter un joueur
                  </p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs"
                      >
                        <span
                          className={
                            p.is_alive
                              ? "text-slate-100"
                              : "text-slate-500 line-through"
                          }
                        >
                          {p.pseudo}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleAlive(p)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${
                            p.is_alive
                              ? "border-rose-400/35 bg-rose-500/15 text-rose-200"
                              : "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {p.is_alive ? (
                            <>
                              <Skull className="h-3 w-3" />
                              <span>Éliminer</span>
                            </>
                          ) : (
                            <>
                              <HeartPulse className="h-3 w-3" />
                              <span>Ressusciter</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
