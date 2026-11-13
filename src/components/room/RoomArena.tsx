"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Biohazard,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  Dog,
  Eye,
  Feather,
  FlaskConical,
  Heart,
  Mic,
  Moon,
  Music,
  PawPrint,
  RotateCcw,
  Shield,
  Skull,
  SkipForward,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { GAME_ROLES, ROLE_BY_ID } from "@/data/roles";
import { triggerHaptic } from "@/lib/haptics";
import {
  advanceRoomPhase,
  decodeAvatarToProfile,
  getHumanNarratorScript,
  getPhaseLabel,
  isEffectiveWolf,
  markPlayerReady,
  resetRoomToLobby,
  submitCorbeauTarget,
  submitCupidonLovers,
  submitGrandMechantTarget,
  submitHunterShotTarget,
  submitLoupBlancTarget,
  submitPiperTargets,
  submitPlayerReaction,
  submitRenardTargets,
  submitSalvateurTarget,
  submitSeerInspection,
  submitServanteClaim,
  submitVoteTarget,
  submitWildChildModel,
  submitWitchDecision,
  submitWolfInfectToggle,
} from "@/lib/roomService";
import { RoleCard } from "@/components/game/RoleCard";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import type {
  PlayerReactionType,
  RoomPlayerRecord,
  RoomRecord,
} from "@/types/game";

interface RoomArenaProps {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  currentPlayer: RoomPlayerRecord | null;
  isHost: boolean;
  isOwner: boolean;
  onRefresh: () => Promise<void>;
}

const REACTION_OPTIONS: Array<{
  type: PlayerReactionType;
  emoji: string;
  label: string;
}> = [
  { type: "suspect", emoji: "🤔", label: "Suspect" },
  { type: "innocent", emoji: "🛡️", label: "Innocent" },
  { type: "shock", emoji: "😱", label: "Choc" },
  { type: "wolf", emoji: "🐺", label: "Loup !" },
];

const REACTION_BADGE_MAP: Record<PlayerReactionType, string> = {
  suspect: "🤔 Suspect",
  innocent: "🛡️ Innocent",
  shock: "😱 Choc",
  wolf: "🐺 Loup !",
};

interface TargetGridProps {
  players: RoomPlayerRecord[];
  currentPlayerId?: string | null;
  allowSelf?: boolean;
  disabledIds?: Set<string>;
  selectedIds?: string[];
  voteCounts?: Map<string, number>;
  corbeauTargetId?: string | null;
  busy?: boolean;
  accentClass?: string;
  actionLabel?: (player: RoomPlayerRecord) => string;
  extraDisabledTag?: (player: RoomPlayerRecord) => string | null;
  onSelect: (playerId: string) => void;
}

/**
 * Grille unifiée de ciblage : désactive strictement et visuellement soi-même (sauf exception explicite)
 * et tout joueur déjà éliminé (is_alive === false).
 */
function TargetSelectionGrid({
  players,
  currentPlayerId,
  allowSelf = false,
  disabledIds,
  selectedIds = [],
  voteCounts,
  corbeauTargetId,
  busy = false,
  accentClass = "border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.28)]",
  actionLabel,
  extraDisabledTag,
  onSelect,
}: TargetGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => {
        const isSelf = p.id === currentPlayerId;
        const isDead = !p.is_alive;
        const extraTag = extraDisabledTag?.(p) ?? null;
        const isCustomDisabled = Boolean(disabledIds?.has(p.id) || extraTag);
        const disabled =
          busy || isDead || (isSelf && !allowSelf) || isCustomDisabled;
        const selected = selectedIds.includes(p.id);
        const count = voteCounts?.get(p.id) ?? 0;
        const hasCorbeauMark = corbeauTargetId === p.id;

        let badgeText: string | null = null;
        if (isDead) {
          badgeText = "Éliminé";
        } else if (isSelf && !allowSelf) {
          badgeText = "Vous";
        } else if (extraTag) {
          badgeText = extraTag;
        }

        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onSelect(p.id);
            }}
            className={`flex min-h-[46px] items-center justify-between gap-1.5 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
              disabled
                ? "cursor-not-allowed border-white/5 bg-black/20 text-slate-500 opacity-45"
                : selected
                  ? accentClass
                  : "border-white/10 bg-black/35 text-slate-200 hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            <span className="truncate">
              {actionLabel ? actionLabel(p) : p.pseudo}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {hasCorbeauMark && !isDead && (
                <span className="rounded-full bg-violet-500/35 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
                  +2
                </span>
              )}
              {badgeText ? (
                <span className="rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                  {badgeText}
                </span>
              ) : (
                count > 0 && (
                  <span className="rounded-full bg-rose-500/35 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                    {count}
                  </span>
                )
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Arène de jeu tour par tour temps réel avec séparation des sous-étapes de nuit,
 * protection anti-triche des rôles et réactions silencieuses de jour.
 */
export function RoomArena({
  room,
  players,
  currentPlayer,
  isHost,
  isOwner,
  onRefresh,
}: RoomArenaProps) {
  const [showCardExpanded, setShowCardExpanded] = useState(
    room.phase === "ROLE_REVEAL"
  );
  const [showEventLog, setShowEventLog] = useState(false);
  const [cupidSelection, setCupidSelection] = useState<string[]>([]);
  const [piperSelection, setPiperSelection] = useState<string[]>([]);
  const [witchSave, setWitchSave] = useState(false);
  const [witchKillId, setWitchKillId] = useState<string | null>(null);
  const [witchSubmitted, setWitchSubmitted] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const myRole = currentPlayer?.role
    ? ROLE_BY_ID[currentPlayer.role] ?? GAME_ROLES[0]
    : null;
  const isAlive = Boolean(currentPlayer?.is_alive);
  const state = room.game_state;
  const nightStep = state.nightStep;
  const isMyEffectiveWolf = currentPlayer
    ? isEffectiveWolf(currentPlayer, state)
    : false;
  const alivePlayers = players.filter((p) => p.is_alive);

  // Tick temps réel pour minuteur auto + expiration des bulles de réaction (6,5 s)
  const hasActiveReactions = Object.keys(state.reactions ?? {}).length > 0;
  useEffect(() => {
    const needsDeadlineTick =
      room.narrator_mode === "auto" && Boolean(state.phaseDeadline);
    const isDaytime =
      room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE";

    if (!needsDeadlineTick && !isDaytime && !hasActiveReactions) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, [room.narrator_mode, room.phase, state.phaseDeadline, hasActiveReactions]);

  const secondsLeft =
    room.narrator_mode === "auto" && state.phaseDeadline
      ? Math.max(
          0,
          Math.ceil((new Date(state.phaseDeadline).getTime() - nowMs) / 1000)
        )
      : null;

  const runAction = async (fn: () => Promise<void>) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    triggerHaptic(25);
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Action impossible pour le moment."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCupidToggle = (targetId: string) => {
    if (
      targetId === currentPlayer?.id ||
      !players.some((p) => p.id === targetId && p.is_alive)
    ) {
      return;
    }
    setCupidSelection((prev) => {
      if (prev.includes(targetId)) return prev.filter((id) => id !== targetId);
      if (prev.length >= 2) return [prev[1], targetId];
      return [...prev, targetId];
    });
  };

  const handlePiperToggle = (targetId: string) => {
    if (
      targetId === currentPlayer?.id ||
      state.charmedPlayerIds.includes(targetId) ||
      !players.some((p) => p.id === targetId && p.is_alive)
    ) {
      return;
    }
    setPiperSelection((prev) => {
      if (prev.includes(targetId)) return prev.filter((id) => id !== targetId);
      if (prev.length >= 2) return [prev[1], targetId];
      return [...prev, targetId];
    });
  };

  const handleReaction = async (reaction: PlayerReactionType) => {
    if (!currentPlayer || !isAlive || reactionBusy) return;
    setReactionBusy(true);
    triggerHaptic(15);
    try {
      await submitPlayerReaction(room, currentPlayer.id, reaction);
      await onRefresh();
    } finally {
      setReactionBusy(false);
    }
  };

  const isNightPhase = room.phase.startsWith("NIGHT_");
  const narratorScript = getHumanNarratorScript(
    room.phase,
    players,
    state,
    room.turn_number
  );

  // Rôle inspecté par la Voyante
  const seerTarget = state.seerInspectedId
    ? players.find((p) => p.id === state.seerInspectedId)
    : null;
  const seerTargetRole = seerTarget?.role ? ROLE_BY_ID[seerTarget.role] : null;

  // Victime menacée vue par la Sorcière (masquée si déjà protégée par le Salvateur)
  const wolfVictim =
    state.wolfTargetId && state.wolfTargetId !== state.salvateurTargetId
      ? players.find((p) => p.id === state.wolfTargetId)
      : null;

  // Décompte des votes visibles pendant DAY_VOTE ou NIGHT_WEREWOLVES
  const voteCounts = new Map<string, number>();
  for (const p of players) {
    if (p.has_voted && p.target_id) {
      voteCounts.set(p.target_id, (voteCounts.get(p.target_id) ?? 0) + 1);
    }
  }
  if (room.phase === "DAY_VOTE" && state.corbeauTargetId) {
    const corbeauTargetAlive = players.some(
      (p) => p.id === state.corbeauTargetId && p.is_alive
    );
    if (corbeauTargetAlive) {
      voteCounts.set(
        state.corbeauTargetId,
        (voteCounts.get(state.corbeauTargetId) ?? 0) + 2
      );
    }
  }

  const loverPartner =
    state.lovers && currentPlayer
      ? state.lovers[0] === currentPlayer.id
        ? players.find((p) => p.id === state.lovers![1])
        : state.lovers[1] === currentPlayer.id
          ? players.find((p) => p.id === state.lovers![0])
          : null
      : null;

  const wildChildModel =
    currentPlayer?.role === "enfant-sauvage" && state.wildChildModelId
      ? players.find((p) => p.id === state.wildChildModelId)
      : null;

  const isCharmed = Boolean(
    currentPlayer && state.charmedPlayerIds.includes(currentPlayer.id)
  );
  const charmedNames = players
    .filter((p) => state.charmedPlayerIds.includes(p.id))
    .map((p) => p.pseudo);

  const isSparedIdiot = Boolean(
    currentPlayer && state.idiotSparedPlayerIds.includes(currentPlayer.id)
  );

  // Sous-étape active effective pour supporter les anciens/nouveaux états
  const activeStep =
    nightStep ??
    (room.phase === "NIGHT_CUPIDON"
      ? "cupidon"
      : room.phase === "NIGHT_SEER"
        ? "voyante"
        : room.phase === "NIGHT_WEREWOLVES"
          ? "loups"
          : room.phase === "NIGHT_WITCH"
            ? "sorciere"
            : null);

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* En-tête de phase + minuteur */}
      <section className="glass-panel flex items-center justify-between gap-2 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45">
            {isNightPhase ? (
              <Moon className="h-4 w-4 text-purple-300" />
            ) : room.phase === "VICTORY" ? (
              <Trophy className="h-4 w-4 text-amber-300" />
            ) : (
              <Sun className="h-4 w-4 text-amber-300" />
            )}
          </span>
          <div>
            <p className="font-display text-sm font-bold text-amber-100">
              {getPhaseLabel(room.phase, nightStep)}
            </p>
            <p className="text-[11px] text-slate-400">
              Tour {room.turn_number} •{" "}
              {isAlive ? "Vous êtes en vie" : "Vous êtes éliminé"}
            </p>
          </div>
        </div>

        {room.narrator_mode === "auto" && secondsLeft !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-100">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span>{secondsLeft}s</span>
          </span>
        )}
      </section>

      {actionError && (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-950/60 px-3.5 py-2 text-xs text-rose-200">
          {actionError}
        </div>
      )}

      {/* Panneau du Narrateur Humain */}
      {room.narrator_mode === "human" && (isHost || isOwner) && (
        <section className="glass-panel rounded-3xl border-purple-400/40 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-200">
              <Mic className="h-3.5 w-3.5 text-purple-300" />
              <span>Script du Narrateur</span>
            </span>
          </div>

          <p className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-amber-50">
            {narratorScript}
          </p>

          {room.phase !== "VICTORY" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runAction(() => advanceRoomPhase(room, players))}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-rose-700 text-xs font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.4)] active:scale-[0.98] disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
              <span>Valider &amp; passer à l&apos;étape suivante</span>
            </button>
          )}
        </section>
      )}

      {/* Carte 3D secrète du joueur (le rôle n'est jamais affiché en clair dans l'écran hors appui long) */}
      {myRole && room.phase !== "VICTORY" && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCardExpanded((prev) => !prev)}
            className="glass-panel flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold text-amber-100"
          >
            <span>
              {showCardExpanded
                ? "Masquer ma carte secrète"
                : "Consulter ma carte secrète (maintenir 3D)"}
            </span>
            <span className="text-[11px] text-amber-300/90">
              {showCardExpanded ? "Réduire" : "Ouvrir"}
            </span>
          </button>

          {showCardExpanded && (
            <div className="pt-1">
              <RoleCard role={myRole} />
            </div>
          )}

          {loverPartner && (
            <div className="glass-panel flex items-center justify-center gap-2 rounded-2xl border-pink-400/35 px-3 py-2 text-xs text-pink-200">
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              <span>
                Vous êtes lié(e) par Cupidon à{" "}
                <strong>{loverPartner.pseudo}</strong>.
              </span>
            </div>
          )}

          {wildChildModel && (
            <div className="glass-panel flex items-center justify-center gap-2 rounded-2xl border-lime-400/35 px-3 py-2 text-xs text-lime-200">
              <PawPrint className="h-3.5 w-3.5 text-lime-400" />
              <span>
                {state.wildChildTransformed
                  ? "Votre modèle a péri : vous combattez désormais avec les Loups-Garous !"
                  : `Votre modèle secret est ${wildChildModel.pseudo}.`}
              </span>
            </div>
          )}

          {currentPlayer &&
            state.infectedPlayerIds.includes(currentPlayer.id) && (
              <div className="glass-panel flex items-center justify-center gap-2 rounded-2xl border-lime-400/40 px-3 py-2 text-xs text-lime-200">
                <Biohazard className="h-3.5 w-3.5 text-lime-400" />
                <span>
                  L&apos;Infect Père vous a mordu : vous appartenez désormais à la
                  meute tout en gardant vos pouvoirs !
                </span>
              </div>
            )}

          {isCharmed && (
            <div className="glass-panel flex flex-col items-center gap-1 rounded-2xl border-emerald-400/35 px-3 py-2 text-center text-xs text-emerald-200">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Music className="h-3.5 w-3.5 text-emerald-400" />
                Vous êtes envoûté(e) par la Flûte
              </span>
              {charmedNames.length > 1 && (
                <span className="text-[11px] text-emerald-100/80">
                  Joueurs charmés connus : {charmedNames.join(", ")}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== 1. ROLE_REVEAL ==================== */}
      {room.phase === "ROLE_REVEAL" && (
        <section className="glass-panel rounded-3xl p-4 text-center space-y-2.5">
          <p className="text-xs leading-relaxed text-slate-200">
            Maintenez votre doigt sur la carte ci-dessus pour mémoriser votre
            rôle secret. Dès que vous relâchez, votre identité disparaît.
          </p>
          {currentPlayer && (
            <button
              type="button"
              disabled={
                actionBusy ||
                state.readyUserIds.includes(currentPlayer.user_id)
              }
              onClick={() =>
                runAction(() => markPlayerReady(room, currentPlayer.user_id))
              }
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 text-xs font-bold text-emerald-100 disabled:opacity-55"
            >
              <Check className="h-4 w-4" />
              <span>
                {state.readyUserIds.includes(currentPlayer.user_id)
                  ? `Prêt (${state.readyUserIds.length}/${alivePlayers.length})`
                  : "J'ai mémorisé mon rôle (Prêt)"}
              </span>
            </button>
          )}
          {(isHost || isOwner) && room.narrator_mode === "auto" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runAction(() => advanceRoomPhase(room, players))}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/15 px-4 text-xs font-semibold text-amber-100"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span>Commencer la nuit</span>
            </button>
          )}
        </section>
      )}

      {/* ==================== 2. SOUS-ÉTAPES DE NUIT ==================== */}
      {isNightPhase && activeStep === "cupidon" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "cupidon" ? (
            <>
              <div className="flex items-center gap-2 text-pink-200">
                <Heart className="h-4 w-4 text-pink-400" />
                <h3 className="font-display text-sm font-bold">
                  Choisissez 2 amoureux ({cupidSelection.length}/2)
                </h3>
              </div>
              {state.cupidonTargets.length === 2 ? (
                <p className="text-xs text-emerald-200">
                  Les deux âmes sont liées pour la partie !
                </p>
              ) : (
                <>
                  <TargetSelectionGrid
                    players={players}
                    currentPlayerId={currentPlayer.id}
                    allowSelf={false}
                    selectedIds={cupidSelection}
                    busy={actionBusy}
                    accentClass="border-pink-400 bg-pink-500/25 text-pink-100"
                    onSelect={handleCupidToggle}
                  />
                  <button
                    type="button"
                    disabled={cupidSelection.length !== 2 || actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitCupidonLovers(
                          room,
                          [cupidSelection[0], cupidSelection[1]],
                          players,
                          currentPlayer.id
                        )
                      )
                    }
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    <span>Lier ces deux joueurs</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Cupidon s&apos;éveille dans la nuit et désigne deux amoureux...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "enfant-sauvage" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "enfant-sauvage" ? (
            <>
              <div className="flex items-center gap-2 text-lime-200">
                <PawPrint className="h-4 w-4 text-lime-400" />
                <h3 className="font-display text-sm font-bold">
                  Choisissez votre modèle secret
                </h3>
              </div>
              {state.wildChildModelId ? (
                <p className="text-xs text-emerald-200">
                  Votre modèle a été choisi en silence.
                </p>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf={false}
                  busy={actionBusy}
                  accentClass="border-lime-400 bg-lime-500/25 text-lime-100"
                  onSelect={(id) =>
                    runAction(() =>
                      submitWildChildModel(room, players, currentPlayer.id, id)
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              L&apos;Enfant Sauvage choisit secrètement son modèle pour la partie...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "fratrie" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive &&
          (currentPlayer?.role === "soeurs" ||
            currentPlayer?.role === "freres") ? (
            <>
              <div className="flex items-center gap-2 text-sky-200">
                <Users className="h-4 w-4 text-sky-400" />
                <h3 className="font-display text-sm font-bold">
                  Reconnaissance de la Fratrie
                </h3>
              </div>
              <div className="rounded-2xl border border-sky-400/25 bg-black/40 p-3 text-xs text-sky-100">
                <p className="mb-1 text-slate-300">
                  Vos alliés du même sang :
                </p>
                <p className="font-semibold">
                  {players
                    .filter(
                      (p) => p.is_alive && p.role === currentPlayer.role
                    )
                    .map((p) => p.pseudo)
                    .join(" • ")}
                </p>
              </div>
              <button
                type="button"
                disabled={
                  actionBusy ||
                  state.readyUserIds.includes(currentPlayer.user_id)
                }
                onClick={() =>
                  runAction(() => markPlayerReady(room, currentPlayer.user_id))
                }
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-xs font-bold text-white disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>
                  {state.readyUserIds.includes(currentPlayer.user_id)
                    ? "Reconnaissance confirmée"
                    : "C'est noté, refermer les yeux"}
                </span>
              </button>
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Les Deux Sœurs et Trois Frères se reconnaissent en silence...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "salvateur" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "salvateur" ? (
            <>
              <div className="flex items-center gap-2 text-cyan-200">
                <Shield className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-sm font-bold">
                  Bouclier du Salvateur
                </h3>
              </div>
              {state.salvateurTargetId ? (
                <p className="text-xs text-emerald-200">
                  Votre protection sacrée veille jusqu&apos;à l&apos;aube.
                </p>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf
                  busy={actionBusy}
                  accentClass="border-cyan-400 bg-cyan-500/25 text-cyan-100"
                  extraDisabledTag={(p) =>
                    p.id === state.salvateurLastTargetId ? "Nuit préc." : null
                  }
                  onSelect={(id) =>
                    runAction(() =>
                      submitSalvateurTarget(room, players, currentPlayer.id, id)
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Salvateur étend secrètement son bouclier protecteur...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "voyante" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "voyante" ? (
            <>
              <div className="flex items-center gap-2 text-purple-200">
                <Eye className="h-4 w-4 text-purple-400" />
                <h3 className="font-display text-sm font-bold">
                  Vision de l&apos;Oracle
                </h3>
              </div>

              {seerTarget && seerTargetRole ? (
                <div
                  className="rounded-2xl border p-3.5 text-center"
                  style={{
                    borderColor: `${seerTargetRole.aura.primary}80`,
                    backgroundColor: "rgba(10, 10, 18, 0.75)",
                    boxShadow: `0 0 24px ${seerTargetRole.aura.primary}30`,
                  }}
                >
                  <p className="text-xs text-slate-300">
                    La véritable nature de <strong>{seerTarget.pseudo}</strong>{" "}
                    est :
                  </p>
                  <p
                    className="font-display mt-1 text-lg font-bold"
                    style={{ color: seerTargetRole.aura.primary }}
                  >
                    {seerTargetRole.name} ({seerTargetRole.factionLabel})
                  </p>
                </div>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf={false}
                  busy={actionBusy}
                  actionLabel={(p) => `Observer ${p.pseudo}`}
                  accentClass="border-purple-400 bg-purple-500/20 text-purple-100"
                  onSelect={(id) =>
                    runAction(() =>
                      submitSeerInspection(room, id, players, currentPlayer.id)
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              La Voyante scrute les astres à la recherche d&apos;un secret...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "renard" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "renard" ? (
            <>
              <div className="flex items-center gap-2 text-orange-200">
                <Dog className="h-4 w-4 text-orange-400" />
                <h3 className="font-display text-sm font-bold">
                  Flair du Renard (3 voisins)
                </h3>
              </div>

              {state.foxCheckedTonight && state.foxLastResult ? (
                <div
                  className={`rounded-2xl border p-3.5 text-center text-xs ${
                    state.foxLastResult.hasWolf
                      ? "border-rose-400/50 bg-rose-950/50 text-rose-100"
                      : "border-slate-500/40 bg-black/50 text-slate-300"
                  }`}
                >
                  <p className="mb-1 text-[11px] text-slate-300">
                    Zone flairée : {state.foxLastResult.names.join(", ")}
                  </p>
                  <p className="font-bold">
                    {state.foxLastResult.hasWolf
                      ? "Un Loup-Garou se cache parmi ce groupe !"
                      : "Aucun loup détecté — vous perdez votre flair pour la suite."}
                  </p>
                </div>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf={false}
                  busy={actionBusy}
                  actionLabel={(p) => `Flairer ${p.pseudo}`}
                  onSelect={(id) =>
                    runAction(() =>
                      submitRenardTargets(room, players, currentPlayer.id, id)
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Renard sonde l&apos;odeur d&apos;un groupe de villageois...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "loups" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && isMyEffectiveWolf && currentPlayer ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-rose-200">
                  Conseil de la Meute
                </span>
                <span className="text-[11px] text-rose-300">
                  Votez ensemble
                </span>
              </div>

              {/* Reconnaissance privée entre alliés loups (visible uniquement ici) */}
              <div className="rounded-xl border border-rose-500/25 bg-rose-950/35 px-3 py-1.5 text-[11px] text-rose-200">
                Meute :{" "}
                {alivePlayers
                  .filter((p) => isEffectiveWolf(p, state))
                  .map((p) => p.pseudo)
                  .join(" • ")}
              </div>

              {currentPlayer.role === "infect-pere-des-loups" &&
                !state.infectUsed && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitWolfInfectToggle(room, !state.infectTonight)
                      )
                    }
                    className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-bold transition-all ${
                      state.infectTonight
                        ? "border-lime-400 bg-lime-500/25 text-lime-100"
                        : "border-white/15 bg-black/40 text-slate-200"
                    }`}
                  >
                    <Biohazard className="h-4 w-4 text-lime-400" />
                    <span>
                      {state.infectTonight
                        ? "Infection activée : la proie rejoindra la meute"
                        : "Pouvoir d'Infection (1x) : convertir la proie"}
                    </span>
                  </button>
                )}

              <TargetSelectionGrid
                players={players}
                currentPlayerId={currentPlayer.id}
                allowSelf={false}
                selectedIds={
                  currentPlayer.target_id ? [currentPlayer.target_id] : []
                }
                voteCounts={voteCounts}
                busy={actionBusy}
                accentClass="border-rose-400 bg-rose-500/25 text-white shadow-[0_0_16px_rgba(225,29,72,0.35)]"
                extraDisabledTag={(p) =>
                  isEffectiveWolf(p, state) ? "Allié" : null
                }
                onSelect={(id) =>
                  runAction(() => submitVoteTarget(currentPlayer.id, id))
                }
              />
            </>
          ) : isAlive && currentPlayer?.role === "petite-fille" ? (
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-indigo-200">
                Vous écoutez discrètement dans le noir...
              </p>
              <p className="text-[11px] text-slate-400">
                {
                  players.filter((p) => isEffectiveWolf(p, state) && p.has_voted)
                    .length
                }{" "}
                loup(s) ont déjà désigné une proie cette nuit.
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Les Loups-Garous rôdent dans le silence de la nuit...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "loup-blanc" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "loup-garou-blanc" ? (
            <>
              <div className="flex items-center gap-2 text-slate-200">
                <Sparkles className="h-4 w-4 text-slate-100" />
                <h3 className="font-display text-sm font-bold">
                  Trahison du Loup-Garou Blanc
                </h3>
              </div>

              {state.loupBlancTargetId ||
              state.readyUserIds.includes(currentPlayer.user_id) ? (
                <p className="text-xs text-slate-200">
                  Votre décision solitaire est enregistrée.
                </p>
              ) : (
                <>
                  <TargetSelectionGrid
                    players={players}
                    currentPlayerId={currentPlayer.id}
                    allowSelf={false}
                    busy={actionBusy}
                    accentClass="border-slate-200 bg-slate-200/20 text-white"
                    extraDisabledTag={(p) =>
                      !isEffectiveWolf(p, state) ? "Non loup" : null
                    }
                    onSelect={(id) =>
                      runAction(() =>
                        submitLoupBlancTarget(
                          room,
                          players,
                          currentPlayer.id,
                          id
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() => markPlayerReady(room, currentPlayer.user_id))
                    }
                    className="flex min-h-[42px] w-full items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-xs font-semibold text-slate-200"
                  >
                    Épargner la meute cette nuit
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Un loup solitaire observe ses semblables dans la pénombre...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "grand-mechant-loup" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "grand-mechant-loup" ? (
            <>
              <div className="flex items-center gap-2 text-rose-200">
                <Skull className="h-4 w-4 text-rose-400" />
                <h3 className="font-display text-sm font-bold">
                  Seconde Proie du Grand Méchant Loup
                </h3>
              </div>

              {state.grandMechantSecondTargetId ||
              state.readyUserIds.includes(currentPlayer.user_id) ? (
                <p className="text-xs text-rose-200">
                  Votre chasse supplémentaire est scellée.
                </p>
              ) : (
                <>
                  <TargetSelectionGrid
                    players={players}
                    currentPlayerId={currentPlayer.id}
                    allowSelf={false}
                    busy={actionBusy}
                    accentClass="border-rose-400 bg-rose-500/25 text-rose-100"
                    extraDisabledTag={(p) =>
                      isEffectiveWolf(p, state) ? "Allié" : null
                    }
                    onSelect={(id) =>
                      runAction(() =>
                        submitGrandMechantTarget(
                          room,
                          players,
                          currentPlayer.id,
                          id
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() => markPlayerReady(room, currentPlayer.user_id))
                    }
                    className="flex min-h-[42px] w-full items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-xs font-semibold text-slate-200"
                  >
                    Ne pas chasser de seconde cible
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Grand Méchant Loup rôde encore dans l&apos;obscurité...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "sorciere" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "sorciere" ? (
            <>
              <div className="flex items-center gap-2 text-emerald-200">
                <FlaskConical className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold">
                  Laboratoire de la Sorcière
                </h3>
              </div>

              {witchSubmitted ||
              state.readyUserIds.includes(currentPlayer.user_id) ? (
                <p className="text-xs text-emerald-200">
                  Vos choix nocturnes ont été scellés.
                </p>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-slate-200">
                    {wolfVictim ? (
                      <span>
                        Victime menacée cette nuit :{" "}
                        <strong className="text-rose-300">
                          {wolfVictim.pseudo}
                        </strong>
                      </span>
                    ) : (
                      <span>Aucune victime menacée par les loups ce soir.</span>
                    )}
                  </div>

                  {!state.witchLifeUsed && wolfVictim && (
                    <button
                      type="button"
                      onClick={() => setWitchSave((prev) => !prev)}
                      className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border text-xs font-semibold ${
                        witchSave
                          ? "border-emerald-400 bg-emerald-500/25 text-emerald-100"
                          : "border-white/15 bg-white/[0.05] text-slate-200"
                      }`}
                    >
                      <span>
                        {witchSave
                          ? `Potion de Vie activée sur ${wolfVictim.pseudo}`
                          : `Sauver ${wolfVictim.pseudo} (Potion de Vie)`}
                      </span>
                    </button>
                  )}

                  {!state.witchDeathUsed && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-slate-300">
                        Potion de Mort (optionnel) :
                      </p>
                      <TargetSelectionGrid
                        players={players}
                        currentPlayerId={currentPlayer.id}
                        allowSelf={false}
                        selectedIds={witchKillId ? [witchKillId] : []}
                        busy={actionBusy}
                        actionLabel={(p) => `Empoisonner ${p.pseudo}`}
                        accentClass="border-purple-400 bg-purple-500/25 text-purple-100"
                        onSelect={(id) =>
                          setWitchKillId((prev) => (prev === id ? null : id))
                        }
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(async () => {
                        await submitWitchDecision(
                          room,
                          {
                            saveWolfVictim: witchSave,
                            killTargetId: witchKillId,
                          },
                          players,
                          currentPlayer.id
                        );
                        if (!witchSave && !witchKillId) {
                          await markPlayerReady(room, currentPlayer.user_id);
                        }
                        setWitchSubmitted(true);
                      })
                    }
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-xs font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    <span>Valider mes choix</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              La Sorcière observe ses deux fioles sous la lueur lunaire...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "corbeau" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "corbeau" ? (
            <>
              <div className="flex items-center gap-2 text-violet-200">
                <Feather className="h-4 w-4 text-violet-400" />
                <h3 className="font-display text-sm font-bold">
                  Malédiction du Corbeau (+2 voix)
                </h3>
              </div>
              {state.corbeauTargetId ? (
                <p className="text-xs text-violet-200">
                  Une plume noire désignera cette cible au lever du soleil.
                </p>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf={false}
                  busy={actionBusy}
                  accentClass="border-violet-400 bg-violet-500/25 text-violet-100"
                  onSelect={(id) =>
                    runAction(() =>
                      submitCorbeauTarget(room, players, currentPlayer.id, id)
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Corbeau plane silencieusement au-dessus des toits...
            </p>
          )}
        </section>
      )}

      {isNightPhase && activeStep === "joueur-de-flute" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "joueur-de-flute" ? (
            <>
              <div className="flex items-center gap-2 text-emerald-200">
                <Music className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold">
                  Envoûtement de la Flûte ({piperSelection.length}/2)
                </h3>
              </div>
              {state.piperTargetsTonight.length > 0 ? (
                <p className="text-xs text-emerald-200">
                  Votre mélodie s&apos;étend désormais sur de nouveaux villageois.
                </p>
              ) : (
                <>
                  <TargetSelectionGrid
                    players={players}
                    currentPlayerId={currentPlayer.id}
                    allowSelf={false}
                    selectedIds={piperSelection}
                    busy={actionBusy}
                    accentClass="border-emerald-400 bg-emerald-500/25 text-emerald-100"
                    extraDisabledTag={(p) =>
                      state.charmedPlayerIds.includes(p.id) ? "Charmé" : null
                    }
                    onSelect={handlePiperToggle}
                  />
                  <button
                    type="button"
                    disabled={piperSelection.length === 0 || actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitPiperTargets(
                          room,
                          players,
                          currentPlayer.id,
                          piperSelection
                        )
                      )
                    }
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Music className="h-4 w-4" />
                    <span>Charmer ces joueurs</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Une douce mélodie de flûte flotte dans la brume nocturne...
            </p>
          )}
        </section>
      )}

      {/* ==================== 3. DAY_ANNOUNCEMENT ==================== */}
      {room.phase === "DAY_ANNOUNCEMENT" && (
        <section className="glass-panel rounded-3xl border-amber-300/35 p-4 text-center space-y-3">
          <Sun className="mx-auto h-7 w-7 text-amber-300" />
          <p className="font-display text-base font-bold text-amber-100">
            Le Soleil se lève
          </p>
          <p className="text-xs leading-relaxed text-slate-200">
            {state.lastAnnouncement || "Le village se réveille."}
          </p>

          {/* Servante Dévouée : option de reprendre le rôle d'une victime nocturne */}
          {isAlive &&
            currentPlayer?.role === "servante-devouee" &&
            !state.servanteUsed &&
            state.nightVictims.length > 0 && (
              <div className="rounded-2xl border border-rose-400/35 bg-rose-950/35 p-3 text-left space-y-2">
                <p className="text-xs font-bold text-rose-200">
                  Dévotion (1x) : reprendre le destin d&apos;une victime ?
                </p>
                <div className="flex flex-wrap gap-2">
                  {state.nightVictims.map((v) => (
                    <button
                      key={v.playerId}
                      type="button"
                      disabled={actionBusy}
                      onClick={() =>
                        runAction(() =>
                          submitServanteClaim(
                            room,
                            players,
                            currentPlayer.id,
                            v.playerId
                          )
                        )
                      }
                      className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100"
                    >
                      Reprendre le rôle de {v.pseudo}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </section>
      )}

      {/* ==================== 4. DAY_VOTE ==================== */}
      {room.phase === "DAY_VOTE" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-amber-300" />
              <h3 className="font-display text-sm font-bold text-amber-100">
                Vote du Village
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {players.filter((p) => p.is_alive && p.has_voted).length}/
              {alivePlayers.length} votes
            </span>
          </div>

          {!isAlive ? (
            <p className="text-center text-xs text-slate-400">
              Les morts ne peuvent plus voter. Observez le débat en silence.
            </p>
          ) : isSparedIdiot ? (
            <p className="text-center text-xs text-amber-200">
              Épargné par le village, l&apos;Idiot du Village ne peut plus voter.
            </p>
          ) : (
            <TargetSelectionGrid
              players={players}
              currentPlayerId={currentPlayer?.id}
              allowSelf={false}
              selectedIds={
                currentPlayer?.target_id ? [currentPlayer.target_id] : []
              }
              voteCounts={voteCounts}
              corbeauTargetId={state.corbeauTargetId}
              busy={actionBusy}
              onSelect={(id) =>
                currentPlayer
                  ? runAction(() => submitVoteTarget(currentPlayer.id, id))
                  : undefined
              }
            />
          )}
        </section>
      )}

      {/* Réactions rapides silencieuses de jour */}
      {(room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE") &&
        isAlive &&
        currentPlayer && (
          <section className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2.5">
            <span className="text-[11px] font-semibold text-slate-300">
              Réaction rapide :
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {REACTION_OPTIONS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  disabled={reactionBusy}
                  onClick={() => void handleReaction(item.type)}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 text-[11px] font-medium text-amber-100 transition hover:bg-white/10 active:scale-95"
                >
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

      {/* ==================== 5. HUNTER_SHOT ==================== */}
      {room.phase === "HUNTER_SHOT" && (
        <section className="glass-panel rounded-3xl border-amber-400/45 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-200">
            <Crosshair className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold">
              Dernier Tir du Chasseur
            </h3>
          </div>

          {currentPlayer?.id === state.hunterPendingPlayerId ? (
            <TargetSelectionGrid
              players={players}
              currentPlayerId={currentPlayer.id}
              allowSelf={false}
              busy={actionBusy}
              actionLabel={(p) => `Tirer sur ${p.pseudo}`}
              accentClass="border-amber-400 bg-amber-500/20 text-amber-100"
              onSelect={(id) =>
                runAction(() => submitHunterShotTarget(room, players, id))
              }
            />
          ) : (
            <p className="text-xs text-slate-300">
              Le Chasseur vise sa dernière cible avant de succomber...
            </p>
          )}
        </section>
      )}

      {/* ==================== 6. VICTORY ==================== */}
      {room.phase === "VICTORY" && (
        <section className="glass-panel rounded-3xl border-amber-300/45 p-5 text-center space-y-3">
          <Trophy className="mx-auto h-10 w-10 text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.75)]" />
          <h2 className="font-display text-xl font-bold text-amber-100">
            {state.winnerTitle ?? "Partie terminée"}
          </h2>
          <p className="text-xs leading-relaxed text-slate-200">
            {state.winnerReason}
          </p>

          {(isHost || isOwner) && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runAction(() => resetRoomToLobby(room.id))}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 to-amber-600 text-sm font-bold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retourner au salon pour rejouer</span>
            </button>
          )}
        </section>
      )}

      {/* ==================== LISTE DES JOUEURS (ANTI-TRICHE TOTALE) ==================== */}
      <section className="glass-panel rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display font-bold text-amber-100">
            Villageois ({alivePlayers.length}/{players.length} en vie)
          </span>
          <span className="text-[11px] text-slate-400">
            Rôles secrets masqués
          </span>
        </div>

        <div className="space-y-1.5">
          {players.map((p) => {
            const avatarProfile = decodeAvatarToProfile(
              p.avatar_data,
              p.pseudo,
              p.is_owner
            );
            // Confidentialité stricte : aucun rôle vivant (pas même "(Moi)") n'est affiché en clair ici
            const showRole = room.phase === "VICTORY" || !p.is_alive;
            const roleInfo = p.role ? ROLE_BY_ID[p.role] : null;
            const activeReaction = state.reactions?.[p.id];
            const showReactionBubble = Boolean(
              activeReaction && nowMs - activeReaction.sentAt < 6500
            );
            const hasCorbeauCurse =
              p.is_alive &&
              (room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE") &&
              state.corbeauTargetId === p.id;

            return (
              <div
                key={p.id}
                className={`relative flex items-center justify-between rounded-2xl border px-3 py-2 ${
                  p.is_alive
                    ? "border-white/10 bg-black/35"
                    : "border-white/5 bg-black/20 opacity-55"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar profile={avatarProfile} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`truncate text-xs font-semibold ${
                          p.is_alive
                            ? "text-amber-50"
                            : "text-slate-400 line-through"
                        }`}
                      >
                        {p.pseudo}
                        {p.id === currentPlayer?.id ? " (Moi)" : ""}
                      </p>

                      {hasCorbeauCurse && (
                        <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
                          Plume +2
                        </span>
                      )}
                    </div>

                    {showRole && roleInfo && (
                      <p
                        className="text-[10px] font-medium"
                        style={{ color: roleInfo.aura.primary }}
                      >
                        {roleInfo.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <AnimatePresence>
                    {showReactionBubble && activeReaction && (
                      <motion.span
                        key={`${activeReaction.playerId}-${activeReaction.sentAt}`}
                        initial={{ opacity: 0, scale: 0.85, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="rounded-full border border-amber-300/40 bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-amber-100 shadow-md"
                      >
                        {REACTION_BADGE_MAP[activeReaction.reaction]}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {p.is_alive ? (
                    p.has_voted && (
                      <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        A voté
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                      <Skull className="h-3 w-3" />
                      Éliminé
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== JOURNAL DE PARTIE DISCRET ==================== */}
      {state.eventLog.length > 0 && (
        <section className="glass-panel rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowEventLog((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-200"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-300" />
              <span>Journal de Partie ({state.eventLog.length})</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                showEventLog ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {showEventLog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/10 px-4 py-3 space-y-1.5"
              >
                {[...state.eventLog].reverse().map((entry) => (
                  <p
                    key={entry.id}
                    className="text-[11px] leading-relaxed text-slate-300"
                  >
                    • {entry.text}
                  </p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
