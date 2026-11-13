"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Users, X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { ensurePlayerIdentity } from "@/lib/playerIdentity";
import { joinRoomInSupabase } from "@/lib/roomService";
import type { PlayerProfile } from "@/types/game";

interface JoinRoomModalProps {
  open: boolean;
  profile: PlayerProfile;
  onClose: () => void;
}

/**
 * Modale de jonction de salon par code à 4 lettres.
 */
export function JoinRoomModal({ open, profile, onClose }: JoinRoomModalProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 4) {
      setError("Veuillez saisir un code à 4 lettres.");
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic(25);

    try {
      const identity = await ensurePlayerIdentity();
      await joinRoomInSupabase({
        code: cleaned,
        userId: identity.userId,
        profile,
      });
      onClose();
      router.push(`/room/${cleaned}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de rejoindre ce salon."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="join-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            key="join-sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-md rounded-t-3xl border-amber-300/25 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/35 bg-amber-400/15 text-amber-200">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-amber-100">
                    Rejoindre un salon
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Entrez le code à 4 lettres partagé par l&apos;hôte
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-amber-200/80"
                >
                  Code du salon
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .replace(/[^a-zA-Z]/g, "")
                        .toUpperCase()
                        .slice(0, 4)
                    )
                  }
                  placeholder="ABCD"
                  autoFocus
                  maxLength={4}
                  className="font-display min-h-[56px] w-full rounded-2xl border border-amber-300/30 bg-black/50 px-4 text-center text-2xl font-bold tracking-[0.45em] uppercase text-amber-100 placeholder:text-slate-600 focus:border-amber-300 focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 4}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-sm font-bold text-white shadow-[0_8px_24px_rgba(155,27,48,0.45)] transition-transform active:scale-[0.98] disabled:opacity-45"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connexion au village...</span>
                  </>
                ) : (
                  <>
                    <span>Entrer dans le salon</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
