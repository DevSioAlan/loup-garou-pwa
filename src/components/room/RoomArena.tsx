"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Biohazard,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  Crown,
  Dog,
  Drama,
  Eye,
  Feather,
  FlameKindling,
  FlaskConical,
  Gavel,
  Heart,
  Mic,
  Moon,
  Music,
  PawPrint,
  Radio,
  RotateCcw,
  RotateCw,
  Shield,
  Skull,
  SkipForward,
  Sparkles,
  Sun,
  Trophy,
  Users,
  VenetianMask,
  Volume2,
  VolumeX,
  Vote,
  Wand2,
} from "lucide-react";
import { GAME_ROLES, ROLE_BY_ID } from "@/data/roles";
import { playCountdownTickSound } from "@/lib/audioNarrator";
import { didPlayerWinVictory } from "@/lib/gameEngine";
import { triggerHaptic } from "@/lib/haptics";
import {
  advanceRoomPhase,
  decodeAvatarToProfile,
  getHumanNarratorScript,
  getPhaseLabel,
  isBotPlayer,
  isEffectiveWolf,
  markPlayerReady,
  resetRoomToLobby,
  submitComedianMaskAction,
  submitCorbeauTarget,
  submitCupidonLovers,
  submitGrandMechantTarget,
  submitHunterShotTarget,
  submitJugeBegueArm,
  submitLoupBlancTarget,
  submitLoupMystiqueInspection,
  submitMayorSuccessor,
  submitPiperTargets,
  submitPlayerReaction,
  submitPyromaneIgnite,
  submitPyromaneOil,
  submitRenardTargets,
  submitSalvateurTarget,
  submitSeerInspection,
  submitServanteClaim,
  submitVoleurChoice,
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
  currentUserId: string | null;
  isHost: boolean;
  isOwner: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  lastAnnouncementText: string;
  onReplayNarration: () => void;
  onTogglePrimaryAudio: () => Promise<void>;
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
  currentUserId,
  isHost,
  isOwner,
  soundEnabled,
  onToggleSound,
  lastAnnouncementText,
  onReplayNarration,
  onTogglePrimaryAudio,
  onRefresh,
}: RoomArenaProps) {
  const [showCardExpanded, setShowCardExpanded] = useState(
    room.phase === "ROLE_REVEAL"
  );
  const [showEventLog, setShowEventLog] = useState(false);
  const [cupidSelection, setCupidSelection] = useState<string[]>([]);
  const [piperSelection, setPiperSelection] = useState<string[]>([]);
  const [pyroSelection, setPyroSelection] = useState<string[]>([]);
  const [comedianSelectedMask, setComedianSelectedMask] = useState<
    string | null
  >(null);
  const [witchSave, setWitchSave] = useState(false);
  const [witchKillId, setWitchKillId] = useState<string | null>(null);
  const [witchSubmitted, setWitchSubmitted] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastTickSecondRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (
      room.narrator_mode !== "auto" ||
      secondsLeft === null ||
      secondsLeft < 1 ||
      secondsLeft > 5 ||
      !soundEnabled
    ) {
      return;
    }
    const isPrimaryAudio =
      !state.primaryAudioUserId || state.primaryAudioUserId === currentUserId;
    if (!isPrimaryAudio) return;

    if (lastTickSecondRef.current !== secondsLeft) {
      lastTickSecondRef.current = secondsLeft;
      playCountdownTickSound(secondsLeft);
    }
  }, [
    room.narrator_mode,
    secondsLeft,
    soundEnabled,
    state.primaryAudioUserId,
    currentUserId,
  ]);

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

  const handlePyroToggle = (targetId: string) => {
    if (
      targetId === currentPlayer?.id ||
      state.oiledPlayerIds.includes(targetId) ||
      !players.some((p) => p.id === targetId && p.is_alive)
    ) {
      return;
    }
    setPyroSelection((prev) => {
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

  // Rôle inspecté par le Loup-Garou Noir (Mystique) ou le masque Voyante du Comédien
  const mystiqueTarget = state.mystiqueInspectedId
    ? players.find((p) => p.id === state.mystiqueInspectedId)
    : null;
  const mystiqueTargetRole = mystiqueTarget?.role
    ? ROLE_BY_ID[mystiqueTarget.role]
    : null;
  const comedianPeekTarget = state.comedianPeekedPlayerId
    ? players.find((p) => p.id === state.comedianPeekedPlayerId)
    : null;
  const comedianPeekRole = comedianPeekTarget?.role
    ? ROLE_BY_ID[comedianPeekTarget.role]
    : null;
  const oiledAlivePlayers = alivePlayers.filter((p) =>
    state.oiledPlayerIds.includes(p.id)
  );

  // Victime menacée vue par la Sorcière (masquée si déjà protégée par le Salvateur)
  const wolfVictim =
    state.wolfTargetId && state.wolfTargetId !== state.salvateurTargetId
      ? players.find((p) => p.id === state.wolfTargetId)
      : null;

  const isMayorElection =
    room.phase === "DAY_VOTE" && state.voteMode === "MAYOR_ELECTION";
  const isUnlimitedDayDebate =
    room.phase === "DAY_VOTE" &&
    !isMayorElection &&
    state.dayDebateSeconds === null;

  // Décompte des votes visibles pendant DAY_VOTE ou NIGHT_WEREWOLVES
  const voteCounts = new Map<string, number>();
  for (const p of players) {
    if (p.has_voted && p.target_id) {
      const weight =
        room.phase === "DAY_VOTE" &&
        !isMayorElection &&
        state.mayorPlayerId === p.id
          ? 2
          : 1;
      voteCounts.set(p.target_id, (voteCounts.get(p.target_id) ?? 0) + weight);
    }
  }
  if (room.phase === "DAY_VOTE" && !isMayorElection && state.corbeauTargetId) {
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

  const primaryAudioPlayer = state.primaryAudioUserId
    ? players.find((p) => p.user_id === state.primaryAudioUserId) ?? null
    : null;
  const isMePrimaryAudio = Boolean(
    currentUserId && state.primaryAudioUserId === currentUserId
  );
  const pendingSuccessorMayor = state.mayorPendingSuccessorFromId
    ? players.find((p) => p.id === state.mayorPendingSuccessorFromId) ?? null
    : null;

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* Barre Audio & Confort rapide en haut d'écran */}
      <section className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSound}
            className={`glass-subcard inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition ${
              soundEnabled
                ? "border-amber-300/40 text-amber-100"
                : "text-slate-400"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span>{soundEnabled ? "Son actif" : "Muet"}</span>
          </button>

          <button
            type="button"
            disabled={!lastAnnouncementText}
            onClick={onReplayNarration}
            className="glass-subcard inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-slate-200 transition hover:text-white disabled:opacity-40"
          >
            <RotateCw className="h-3.5 w-3.5 text-purple-300" />
            <span>Répéter</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void onTogglePrimaryAudio()}
          className={`glass-subcard inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition ${
            isMePrimaryAudio
              ? "border-emerald-400/55 bg-emerald-500/20 text-emerald-100"
              : state.primaryAudioUserId
                ? "border-amber-400/35 text-amber-200"
                : "text-slate-300 hover:text-white"
          }`}
        >
          <Radio
            className={`h-3.5 w-3.5 ${
              isMePrimaryAudio
                ? "text-emerald-300"
                : state.primaryAudioUserId
                  ? "text-amber-300"
                  : "text-slate-400"
            }`}
          />
          <span>
            {isMePrimaryAudio
              ? "Audio Principal (Moi)"
              : primaryAudioPlayer
                ? `Audio : ${primaryAudioPlayer.pseudo}`
                : "Appareil Audio Principal"}
          </span>
        </button>
      </section>

      {/* En-tête de phase + minuteur */}
      <section className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3">
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
              {getPhaseLabel(room.phase, nightStep, state)}
            </p>
            <p className="text-[11px] text-slate-400">
              Tour {room.turn_number} •{" "}
              {isAlive ? "Vous êtes en vie" : "Vous êtes éliminé"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {room.narrator_mode === "auto" && secondsLeft !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                secondsLeft <= 5
                  ? "border-rose-400/70 bg-rose-500/25 text-rose-100"
                  : "border-amber-300/35 bg-amber-400/15 text-amber-100"
              }`}
            >
              <Clock
                className={`h-3.5 w-3.5 ${
                  secondsLeft <= 5 ? "text-rose-300" : "text-amber-300"
                }`}
              />
              <span>{secondsLeft}s</span>
            </span>
          )}

          {isUnlimitedDayDebate && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
              <Clock className="h-3 w-3 text-amber-300" />
              <span>Illimité</span>
            </span>
          )}

          {(isHost || isOwner) &&
            room.phase !== "VICTORY" &&
            room.narrator_mode === "auto" && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => runAction(() => advanceRoomPhase(room, players))}
                title="Forcer le passage à la phase suivante"
                className="glass-subcard inline-flex min-h-[30px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-amber-300/45 hover:text-amber-100 disabled:opacity-50"
              >
                <SkipForward className="h-3 w-3 text-amber-300" />
                <span>Forcer la phase</span>
              </button>
            )}
        </div>
      </section>

      {/* Succession du Maire en cas de décès du Maire */}
      {state.mayorPendingSuccessorFromId && alivePlayers.length >= 2 && (
        <section className="glass-panel rounded-3xl border-amber-400/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-200">
            <Crown className="h-4 w-4 text-amber-300" />
            <h3 className="font-display text-sm font-bold">
              Succession du Maire
            </h3>
          </div>

          {currentPlayer &&
          (currentPlayer.id === state.mayorPendingSuccessorFromId ||
            isHost ||
            isOwner) ? (
            <>
              <p className="text-xs text-slate-200">
                {pendingSuccessorMayor
                  ? `${pendingSuccessorMayor.pseudo} a succombé.`
                  : "Le Maire est tombé."}{" "}
                Désignez immédiatement le nouveau Maire (voix ×2) :
              </p>
              <TargetSelectionGrid
                players={players}
                currentPlayerId={currentPlayer.id}
                allowSelf={currentPlayer.is_alive}
                busy={actionBusy}
                accentClass="border-amber-400 bg-amber-500/20 text-amber-100"
                onSelect={(id) =>
                  runAction(() =>
                    submitMayorSuccessor(room, players, currentPlayer.id, id)
                  )
                }
              />
            </>
          ) : (
            <p className="text-xs text-slate-300">
              {pendingSuccessorMayor?.pseudo ?? "Le Maire"} désigne son
              successeur avant de rendre l&apos;âme...
            </p>
          )}
        </section>
      )}

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
      {isNightPhase && activeStep === "voleur" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "voleur" ? (
            <>
              <div className="flex items-center gap-2 text-teal-200">
                <VenetianMask className="h-4 w-4 text-teal-400" />
                <h3 className="font-display text-sm font-bold">
                  Choix du Voleur (Nuit 1)
                </h3>
              </div>
              {state.thiefResolved ? (
                <p className="text-xs text-emerald-200">
                  Votre destin pour cette partie est scellé.
                </p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-300">
                    Deux cartes secrètes vous attendent sur la table. Choisissez
                    d&apos;endosser l&apos;une d&apos;elles ou conservez votre rôle :
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(state.thiefOptions ?? []).map((optRoleId) => {
                      const optRole = ROLE_BY_ID[optRoleId];
                      if (!optRole) return null;
                      return (
                        <button
                          key={optRoleId}
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            runAction(() =>
                              submitVoleurChoice(
                                room,
                                players,
                                currentPlayer.id,
                                optRoleId
                              )
                            )
                          }
                          className="glass-subcard flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition hover:border-teal-300/60"
                          style={{
                            borderColor: `${optRole.aura.primary}55`,
                          }}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span
                              className="font-display text-sm font-bold"
                              style={{ color: optRole.aura.primary }}
                            >
                              {optRole.name}
                            </span>
                            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                              {optRole.factionLabel}
                            </span>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-300">
                            {optRole.ability}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitVoleurChoice(room, players, currentPlayer.id, null)
                      )
                    }
                    className="flex min-h-[40px] w-full items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-xs font-semibold text-slate-200 hover:bg-white/5"
                  >
                    Conserver mon rôle (Voleur)
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Voleur examine silencieusement deux cartes secrètes dans la pénombre...
            </p>
          )}
        </section>
      )}

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

      {isNightPhase && activeStep === "comedien" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "comedien" ? (
            <>
              <div className="flex items-center gap-2 text-purple-200">
                <Drama className="h-4 w-4 text-purple-300" />
                <h3 className="font-display text-sm font-bold">
                  Loge du Comédien ({state.comedianMasks.length - state.comedianUsedMasks.length} masques neufs)
                </h3>
              </div>

              {state.comedianActedTonight ? (
                <div className="space-y-2">
                  {comedianPeekTarget && comedianPeekRole ? (
                    <div
                      className="rounded-2xl border p-3 text-center"
                      style={{
                        borderColor: `${comedianPeekRole.aura.primary}80`,
                        backgroundColor: "rgba(10, 10, 18, 0.78)",
                      }}
                    >
                      <p className="text-xs text-slate-300">
                        Masque Voyante — Rôle de <strong>{comedianPeekTarget.pseudo}</strong> :
                      </p>
                      <p
                        className="font-display mt-1 text-base font-bold"
                        style={{ color: comedianPeekRole.aura.primary }}
                      >
                        {comedianPeekRole.name} ({comedianPeekRole.factionLabel})
                      </p>
                    </div>
                  ) : state.foxLastResult ? (
                    <div className="rounded-2xl border border-orange-400/45 bg-orange-950/35 p-3 text-center text-xs text-orange-100">
                      Masque Renard ({state.foxLastResult.names.join(", ")}) :{" "}
                      <strong>
                        {state.foxLastResult.hasWolf
                          ? "Loup détecté !"
                          : "Aucun loup dans ce trio."}
                      </strong>
                    </div>
                  ) : (
                    <p className="text-xs text-purple-200">
                      Votre rôle d&apos;emprunt a été joué avec brio cette nuit.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {state.comedianMasks.map((maskId) => {
                      const maskRole = ROLE_BY_ID[maskId];
                      const used = state.comedianUsedMasks.includes(maskId);
                      const selected = comedianSelectedMask === maskId;
                      if (!maskRole) return null;
                      return (
                        <button
                          key={maskId}
                          type="button"
                          disabled={used || actionBusy}
                          onClick={() => setComedianSelectedMask(maskId)}
                          className={`rounded-2xl border px-2 py-2 text-center text-[11px] font-bold transition ${
                            used
                              ? "border-white/5 bg-black/25 text-slate-500 line-through opacity-45"
                              : selected
                                ? "border-purple-400 bg-purple-500/25 text-purple-100 shadow-[0_0_16px_rgba(192,132,252,0.3)]"
                                : "border-white/15 bg-black/40 text-slate-200 hover:border-purple-300/45"
                          }`}
                        >
                          {maskRole.name}
                        </button>
                      );
                    })}
                  </div>

                  {comedianSelectedMask && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-purple-200">
                        Cible du masque{" "}
                        <strong>
                          {ROLE_BY_ID[comedianSelectedMask]?.name ?? comedianSelectedMask}
                        </strong>{" "}
                        :
                      </p>
                      <TargetSelectionGrid
                        players={players}
                        currentPlayerId={currentPlayer.id}
                        allowSelf={comedianSelectedMask === "salvateur"}
                        busy={actionBusy}
                        accentClass="border-purple-400 bg-purple-500/25 text-purple-100"
                        extraDisabledTag={(p) =>
                          comedianSelectedMask === "salvateur" &&
                          p.id === state.salvateurLastTargetId
                            ? "Nuit préc."
                            : null
                        }
                        onSelect={(targetId) =>
                          runAction(() =>
                            submitComedianMaskAction(
                              room,
                              players,
                              currentPlayer.id,
                              {
                                maskId: comedianSelectedMask,
                                targetPlayerId: targetId,
                              }
                            )
                          )
                        }
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitComedianMaskAction(room, players, currentPlayer.id, {
                          maskId: null,
                        })
                      )
                    }
                    className="flex min-h-[40px] w-full items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-xs font-semibold text-slate-200"
                  >
                    Garder mes masques cette nuit
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Le Comédien répète dans l&apos;ombre devant ses trois masques...
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

      {isNightPhase && activeStep === "loup-mystique" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "loup-mystique" ? (
            <>
              <div className="flex items-center gap-2 text-fuchsia-200">
                <Wand2 className="h-4 w-4 text-fuchsia-400" />
                <h3 className="font-display text-sm font-bold">
                  Vision du Loup-Garou Noir (Mystique)
                </h3>
              </div>

              {mystiqueTarget && mystiqueTargetRole ? (
                <div
                  className="rounded-2xl border p-3.5 text-center"
                  style={{
                    borderColor: `${mystiqueTargetRole.aura.primary}80`,
                    backgroundColor: "rgba(18, 10, 24, 0.78)",
                    boxShadow: `0 0 24px ${mystiqueTargetRole.aura.primary}30`,
                  }}
                >
                  <p className="text-xs text-slate-300">
                    Pouvoir secret de <strong>{mystiqueTarget.pseudo}</strong> :
                  </p>
                  <p
                    className="font-display mt-1 text-lg font-bold"
                    style={{ color: mystiqueTargetRole.aura.primary }}
                  >
                    {mystiqueTargetRole.name} ({mystiqueTargetRole.factionLabel})
                  </p>
                </div>
              ) : (
                <TargetSelectionGrid
                  players={players}
                  currentPlayerId={currentPlayer.id}
                  allowSelf={false}
                  busy={actionBusy}
                  actionLabel={(p) => `Sonder ${p.pseudo}`}
                  extraDisabledTag={(p) =>
                    isEffectiveWolf(p, state) ? "Meute" : null
                  }
                  accentClass="border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100"
                  onSelect={(id) =>
                    runAction(() =>
                      submitLoupMystiqueInspection(
                        room,
                        id,
                        players,
                        currentPlayer.id
                      )
                    )
                  }
                />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Un regard pourpre traverse les ténèbres pour sonder un habitant...
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

      {isNightPhase && activeStep === "pyromane" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "pyromane" ? (
            <>
              <div className="flex items-center gap-2 text-orange-200">
                <FlameKindling className="h-4 w-4 text-orange-400" />
                <h3 className="font-display text-sm font-bold">
                  Flamme du Pyromane ({oiledAlivePlayers.length} cible(s) huilée(s))
                </h3>
              </div>

              {state.pyromaneActedTonight ? (
                <p className="text-xs text-orange-200">
                  {state.pyromaneIgnitedTonight
                    ? "L'étincelle est jetée : l'embrasement frappera à l'aube !"
                    : "Vos cibles silencieuses viennent d'être aspergées d'huile."}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {oiledAlivePlayers.length > 0 && (
                    <div className="rounded-2xl border border-orange-400/35 bg-orange-950/35 p-2.5 text-xs text-orange-100">
                      Cibles marquées d&apos;huile :{" "}
                      <strong>
                        {oiledAlivePlayers.map((p) => p.pseudo).join(", ")}
                      </strong>
                    </div>
                  )}

                  <TargetSelectionGrid
                    players={players}
                    currentPlayerId={currentPlayer.id}
                    allowSelf={false}
                    selectedIds={pyroSelection}
                    busy={actionBusy}
                    accentClass="border-orange-400 bg-orange-500/25 text-orange-100"
                    extraDisabledTag={(p) =>
                      state.oiledPlayerIds.includes(p.id) ? "Huilé" : null
                    }
                    onSelect={handlePyroToggle}
                  />

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={pyroSelection.length === 0 || actionBusy}
                      onClick={() =>
                        runAction(() =>
                          submitPyromaneOil(
                            room,
                            players,
                            currentPlayer.id,
                            pyroSelection
                          )
                        )
                      }
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-orange-400/45 bg-orange-500/20 px-3 text-xs font-bold text-orange-100 disabled:opacity-40"
                    >
                      <FlameKindling className="h-4 w-4" />
                      <span>Asperger d&apos;huile ({pyroSelection.length}/2)</span>
                    </button>

                    <button
                      type="button"
                      disabled={oiledAlivePlayers.length === 0 || actionBusy}
                      onClick={() =>
                        runAction(() =>
                          submitPyromaneIgnite(room, players, currentPlayer.id)
                        )
                      }
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-700 px-3 text-xs font-bold text-white shadow-[0_6px_18px_rgba(234,88,12,0.45)] disabled:opacity-35"
                    >
                      <span>Embraser ({oiledAlivePlayers.length})</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              Une odeur d&apos;huile et de braises plane silencieusement sur les ruelles...
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
              {isMayorElection ? (
                <Crown className="h-4 w-4 text-amber-300" />
              ) : (
                <Vote className="h-4 w-4 text-amber-300" />
              )}
              <h3 className="font-display text-sm font-bold text-amber-100">
                {isMayorElection
                  ? "Élection du Maire (Voix ×2)"
                  : "Vote du Village"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {players.filter((p) => p.is_alive && p.has_voted).length}/
              {alivePlayers.length} votes
            </span>
          </div>

          {isMayorElection && (
            <p className="text-xs leading-relaxed text-amber-200/90">
              Élisez votre premier Maire : sa voix comptera double lors des
              prochains conseils d&apos;élimination.
            </p>
          )}

          {!isAlive ? (
            <p className="text-center text-xs text-slate-400">
              Les morts ne peuvent plus voter. Observez le débat en silence.
            </p>
          ) : !isMayorElection && isSparedIdiot ? (
            <p className="text-center text-xs text-amber-200">
              Épargné par le village, l&apos;Idiot du Village ne peut plus voter.
            </p>
          ) : (
            <>
              {!isMayorElection &&
                currentPlayer?.role === "juge-begue" &&
                (state.stutteringJudgeArmed ? (
                  <div className="rounded-2xl border border-amber-400/55 bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-100">
                    Marteau du Juge armé : un second vote s&apos;ouvrira aussitôt après celui-ci !
                  </div>
                ) : !state.stutteringJudgeUsed ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(() =>
                        submitJugeBegueArm(room, players, currentPlayer.id)
                      )
                    }
                    className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-600/25 to-orange-600/25 px-3 text-xs font-bold text-amber-100 transition hover:brightness-110"
                  >
                    <Gavel className="h-4 w-4 text-amber-300" />
                    <span>Coup de Marteau (1×) — Déclencher un 2e vote ce jour</span>
                  </button>
                ) : null)}

              <TargetSelectionGrid
                players={players}
                currentPlayerId={currentPlayer?.id}
                allowSelf={false}
                selectedIds={
                  currentPlayer?.target_id ? [currentPlayer.target_id] : []
                }
                voteCounts={voteCounts}
                corbeauTargetId={isMayorElection ? null : state.corbeauTargetId}
                busy={actionBusy}
                onSelect={(id) =>
                  currentPlayer
                    ? runAction(() => submitVoteTarget(currentPlayer.id, id))
                    : undefined
                }
              />
            </>
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
      {room.phase === "VICTORY" && (() => {
        const playerWon = didPlayerWinVictory(currentPlayer, state);
        const keyMoments = state.eventLog.slice(-6);

        return (
          <section className="glass-panel rounded-3xl border-amber-300/45 p-5 space-y-4">
            <div className="text-center space-y-2">
              <Trophy
                className={`mx-auto h-10 w-10 ${
                  playerWon === false
                    ? "text-rose-300 drop-shadow-[0_0_16px_rgba(225,29,72,0.7)]"
                    : "text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.75)]"
                }`}
              />
              {playerWon !== null && (
                <span
                  className={`inline-block rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
                    playerWon
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                      : "border-rose-400/50 bg-rose-500/20 text-rose-200"
                  }`}
                >
                  {playerWon ? "Victoire" : "Défaite"}
                </span>
              )}
              <h2 className="font-display text-xl font-bold text-amber-100">
                {state.winnerTitle ?? "Partie terminée"}
              </h2>
              <p className="text-xs leading-relaxed text-slate-200">
                {state.winnerReason}
              </p>
            </div>

            {/* Révélation complète des rôles et statuts de tous les joueurs */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                Révélation des rôles
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {players.map((p) => {
                  const avatarProfile = decodeAvatarToProfile(
                    p.avatar_data,
                    p.pseudo,
                    p.is_owner
                  );
                  const roleInfo = p.role ? ROLE_BY_ID[p.role] : null;
                  const infected = state.infectedPlayerIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="glass-subcard flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <PlayerAvatar profile={avatarProfile} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-xs font-semibold text-amber-50">
                            <span className="truncate">{p.pseudo}</span>
                            {state.mayorPlayerId === p.id && (
                              <Crown className="h-3 w-3 shrink-0 text-amber-300" />
                            )}
                          </p>
                          <p
                            className="truncate text-[10px] font-semibold"
                            style={{
                              color: roleInfo?.aura.primary ?? "#cbd5e1",
                            }}
                          >
                            {roleInfo?.name ?? "Inconnu"}
                            {infected ? " (Infecté)" : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          p.is_alive
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-rose-500/20 text-rose-200"
                        }`}
                      >
                        {p.is_alive ? "En vie" : "Éliminé"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Moments clés de la partie */}
            {keyMoments.length > 0 && (
              <div className="glass-subcard rounded-2xl p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                  Moments clés
                </p>
                {keyMoments.map((entry) => (
                  <p
                    key={entry.id}
                    className="text-[11px] leading-relaxed text-slate-300"
                  >
                    • {entry.text}
                  </p>
                ))}
              </div>
            )}

            {(isHost || isOwner) ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => runAction(() => resetRoomToLobby(room.id, room))}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-amber-600 to-rose-700 text-sm font-bold text-white shadow-[0_10px_28px_rgba(16,185,129,0.28)] transition hover:brightness-110"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Rejouer ensemble</span>
              </button>
            ) : (
              <p className="text-center text-xs text-slate-300">
                L&apos;hôte peut lancer une nouvelle manche ensemble depuis le
                même salon.
              </p>
            )}
          </section>
        );
      })()}

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
                    <div className="flex flex-wrap items-center gap-1.5">
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

                      {isBotPlayer(p) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-400/35 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-200">
                          <Bot className="h-2.5 w-2.5" />
                          IA
                        </span>
                      )}

                      {state.mayorPlayerId === p.id && p.is_alive && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/45 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                          <Crown className="h-2.5 w-2.5" />
                          Maire ×2
                        </span>
                      )}

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
