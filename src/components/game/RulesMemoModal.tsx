"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Moon, Shield, Skull, Trophy, X } from "lucide-react";

interface RulesMemoModalProps {
  open: boolean;
  onClose: () => void;
}

const NIGHT_CALL_ORDER = [
  {
    step: "1",
    role: "Cupidon & Enfant Sauvage",
    note: "Nuit 1 uniquement : Cupidon lie 2 amoureux ; l'Enfant Sauvage choisit son modèle.",
  },
  {
    step: "2",
    role: "Salvateur (Garde)",
    note: "Protège un joueur contre la morsure des loups (jamais 2 nuits de suite la même cible).",
  },
  {
    step: "3",
    role: "Voyante",
    note: "Observe secrètement l'identité d'un joueur de son choix.",
  },
  {
    step: "4",
    role: "Loups-Garous (+ Petite Fille)",
    note: "La meute choisit une victime ; la Petite Fille peut tenter d'espionner discrètement.",
  },
  {
    step: "5",
    role: "Loup-Garou Blanc & Grand Méchant Loup",
    note: "Le Loup Blanc peut éliminer un loup (1 nuit sur 2) ; le GML ajoute une 2e victime tant qu'aucun loup n'est mort.",
  },
  {
    step: "6",
    role: "Sorcière",
    note: "Découvre la victime des loups et peut utiliser sa potion de vie ou de mort (1 fois chacune).",
  },
  {
    step: "7",
    role: "Aube & Réveil du Village",
    note: "Annonce des victimes (Chasseur tire s'il meurt, Amoureux suit dans la tombe), puis débat et vote.",
  },
];

const VICTORY_CONDITIONS = [
  {
    camp: "Village",
    colorClass: "border-sky-400/35 bg-sky-500/10 text-sky-200",
    icon: Shield,
    rule: "Éliminer tous les Loups-Garous (et le Loup-Garou Blanc s'il est en jeu).",
  },
  {
    camp: "Loups-Garous",
    colorClass: "border-rose-400/35 bg-rose-500/10 text-rose-200",
    icon: Skull,
    rule: "Dévorer le village jusqu'à être au moins autant de loups que d'innocents (ou éliminer le dernier villageois).",
  },
  {
    camp: "Solitaires",
    colorClass: "border-amber-400/35 bg-amber-500/10 text-amber-200",
    icon: Trophy,
    rule: "Loup-Garou Blanc : rester le dernier survivant. Ange : se faire éliminer dès le 1er jour/nuit. Amoureux mixtes : survivre ensemble.",
  },
];

/**
 * Widget compact "Règles & Mémo rapide des rôles" accessible en un clic pendant une soirée.
 */
export function RulesMemoModal({ open, onClose }: RulesMemoModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="memo-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            key="memo-sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-amber-300/20 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/35 bg-amber-400/15 text-amber-200">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-amber-100">
                    Mémo Rapide &amp; Règles
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Ordre de la nuit &amp; conditions de victoire
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le mémo"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Ordre d'appel de la nuit */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-purple-200">
                  <Moon className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
                  <span>Ordre d&apos;appel de la nuit</span>
                </div>

                <ol className="space-y-2">
                  {NIGHT_CALL_ORDER.map((item) => (
                    <li
                      key={item.step}
                      className="flex gap-2.5 rounded-2xl border border-white/10 bg-black/35 p-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300/35 bg-amber-400/15 text-[11px] font-bold text-amber-200">
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-50">
                          {item.role}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300/90">
                          {item.note}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Conditions de victoire */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-amber-200">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  <span>Conditions de victoire</span>
                </div>

                <div className="space-y-2">
                  {VICTORY_CONDITIONS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.camp}
                        className={`rounded-2xl border p-3 ${item.colorClass}`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{item.camp}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-100/90">
                          {item.rule}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
