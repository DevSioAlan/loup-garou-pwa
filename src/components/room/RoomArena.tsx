"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Crosshair,
  Eye,
  FlaskConical,
  Heart,
  Mic,
  Moon,
  RotateCcw,
  Skull,
  SkipForward,
  Sun,
  Trophy,
  Vote,
} from "lucide-react";
import { GAME_ROLES, ROLE_BY_ID } from "@/data/roles";
import { triggerHaptic } from "@/lib/haptics";
import {
  advanceRoomPhase,
  decodeAvatarToProfile,
  getHumanNarratorScript,
  getPhaseLabel,
  isWolfRole,
  resetRoomToLobby,
  submitCupidonLovers,
  submitHunterShotTarget,
  submitSeerInspection,
  submitVoteTarget,
  submitWitchDecision,
} from "@/lib/roomService";
import { RoleCard } from "@/components/game/RoleCard";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import type { RoomPlayerRecord, RoomRecord } from "@/types/game";

interface RoomArenaProps {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  currentPlayer: RoomPlayerRecord | null;
  isHost: boolean;
  isOwner: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * Arène de jeu tour par tour temps réel :
 * - Carte 3D interactive personnelle
 * - Actions spécifiques par rôle et par phase
 * - Mode Narrateur Humain (script à lire pour rôles en vie) / Mode Auto (minuteur)
 * - Liste en direct des joueurs vivants et éliminés
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
  const [cupidSelection, setCupidSelection] = useState<string[]>([]);
  const [witchSave, setWitchSave] = useState(false);
  const [witchKillId, setWitchKillId] = useState<string | null>(null);
  const [witchSubmitted, setWitchSubmitted] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const myRole = currentPlayer?.role
    ? ROLE_BY_ID[currentPlayer.role] ?? GAME_ROLES[0]
    : null;
  const isAlive = Boolean(currentPlayer?.is_alive);
  const isWolf = isWolfRole(currentPlayer?.role);
  const alivePlayers = players.filter((p) => p.is_alive);
  const state = room.game_state;

  // Minuteur temps réel en Mode Narrateur Automatique (sans setState synchrone dans useEffect)
  useEffect(() => {
    if (room.narrator_mode !== "auto" || !state.phaseDeadline) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, [room.narrator_mode, state.phaseDeadline]);

  const secondsLeft =
    room.narrator_mode === "auto" && state.phaseDeadline
      ? Math.max(
          0,
          Math.ceil((new Date(state.phaseDeadline).getTime() - nowMs) / 1000)
        )
      : null;

  const handleAdvance = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await advanceRoomPhase(room, players);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCupidToggle = (targetId: string) => {
    setCupidSelection((prev) => {
      if (prev.includes(targetId)) {
        return prev.filter((id) => id !== targetId);
      }
      if (prev.length >= 2) {
        return [prev[1], targetId];
      }
      return [...prev, targetId];
    });
  };

  const handleConfirmCupid = async () => {
    if (cupidSelection.length !== 2 || actionBusy) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await submitCupidonLovers(room, [cupidSelection[0], cupidSelection[1]]);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleSeerInspect = async (targetId: string) => {
    if (actionBusy || state.seerInspectedId) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await submitSeerInspection(room, targetId);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleVote = async (targetId: string) => {
    if (!currentPlayer || !isAlive || actionBusy) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await submitVoteTarget(currentPlayer.id, targetId);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleWitchSubmit = async () => {
    if (actionBusy || witchSubmitted) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await submitWitchDecision(room, {
        saveWolfVictim: witchSave,
        killTargetId: witchKillId,
      });
      setWitchSubmitted(true);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleHunterShot = async (targetId: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await submitHunterShotTarget(room, players, targetId);
      await onRefresh();
    } finally {
      setActionBusy(false);
    }
  };

  const handleReplay = async () => {
    setActionBusy(true);
    triggerHaptic(25);
    try {
      await resetRoomToLobby(room.id);
      await onRefresh();
    } finally {
      setActionBusy(false);
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
  const seerTargetRole = seerTarget?.role
    ? ROLE_BY_ID[seerTarget.role]
    : null;

  // Victime des loups vue par la Sorcière
  const wolfVictim = state.wolfTargetId
    ? players.find((p) => p.id === state.wolfTargetId)
    : null;

  // Décompte des votes visibles pendant DAY_VOTE ou NIGHT_WEREWOLVES
  const voteCounts = new Map<string, number>();
  for (const p of players) {
    if (p.has_voted && p.target_id) {
      voteCounts.set(p.target_id, (voteCounts.get(p.target_id) ?? 0) + 1);
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
              {getPhaseLabel(room.phase)}
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

      {/* Panneau du Narrateur Humain (pour l'hôte en mode human) */}
      {room.narrator_mode === "human" && (isHost || isOwner) && (
        <section className="glass-panel rounded-3xl border-purple-400/40 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-200">
              <Mic className="h-3.5 w-3.5 text-purple-300" />
              <span>Script du Narrateur</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {narratorScript.headline}
            </span>
          </div>

          <p className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-amber-50">
            {narratorScript.script}
          </p>

          {narratorScript.actionHint && (
            <p className="text-[11px] text-purple-200/85">
              {narratorScript.actionHint}
            </p>
          )}

          {room.phase !== "VICTORY" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleAdvance}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-rose-700 text-xs font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.4)] active:scale-[0.98] disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
              <span>Valider &amp; passer à l&apos;étape suivante</span>
            </button>
          )}
        </section>
      )}

      {/* Carte 3D secrète du joueur (toujours consultable en maintenant le doigt) */}
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
        </section>
      )}

      {/* ==================== ACTIONS SPÉCIFIQUES À LA PHASE ==================== */}

      {/* 1. ROLE_REVEAL */}
      {room.phase === "ROLE_REVEAL" && (
        <section className="glass-panel rounded-3xl p-4 text-center space-y-2">
          <p className="text-xs leading-relaxed text-slate-200">
            Maintenez votre doigt sur la carte ci-dessus pour mémoriser votre
            rôle secret. La première nuit va bientôt tomber...
          </p>
          {(isHost || isOwner) && room.narrator_mode === "auto" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleAdvance}
              className="mt-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/15 px-4 text-xs font-semibold text-amber-100"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span>Commencer la nuit</span>
            </button>
          )}
        </section>
      )}

      {/* 2. NIGHT_CUPIDON */}
      {room.phase === "NIGHT_CUPIDON" && (
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
                  <div className="grid grid-cols-2 gap-2">
                    {alivePlayers.map((p) => {
                      const picked = cupidSelection.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleCupidToggle(p.id)}
                          className={`min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-semibold transition-all ${
                            picked
                              ? "border-pink-400 bg-pink-500/25 text-pink-100"
                              : "border-white/10 bg-black/35 text-slate-200"
                          }`}
                        >
                          {p.pseudo}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={cupidSelection.length !== 2 || actionBusy}
                    onClick={handleConfirmCupid}
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

      {/* 3. NIGHT_SEER */}
      {room.phase === "NIGHT_SEER" && (
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
                    La véritable nature de <strong>{seerTarget.pseudo}</strong> est :
                  </p>
                  <p
                    className="font-display mt-1 text-lg font-bold"
                    style={{ color: seerTargetRole.aura.primary }}
                  >
                    {seerTargetRole.name} ({seerTargetRole.factionLabel})
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {alivePlayers
                    .filter((p) => p.id !== currentPlayer.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleSeerInspect(p.id)}
                        className="min-h-[44px] rounded-2xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-500/20"
                      >
                        Observer {p.pseudo}
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-300">
              La Voyante scrute les astres à la recherche d&apos;un secret...
            </p>
          )}
        </section>
      )}

      {/* 4. NIGHT_WEREWOLVES */}
      {room.phase === "NIGHT_WEREWOLVES" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && isWolf ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-rose-200">
                  Conseil de la Meute
                </span>
                <span className="text-[11px] text-rose-300">
                  Votez ensemble
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {alivePlayers
                  .filter((p) => !isWolfRole(p.role))
                  .map((p) => {
                    const selectedByMe = currentPlayer?.target_id === p.id;
                    const count = voteCounts.get(p.id) ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleVote(p.id)}
                        className={`flex min-h-[46px] items-center justify-between rounded-2xl border px-3 py-2 text-xs font-semibold transition-all ${
                          selectedByMe
                            ? "border-rose-400 bg-rose-500/25 text-white shadow-[0_0_16px_rgba(225,29,72,0.35)]"
                            : "border-white/10 bg-black/35 text-slate-200"
                        }`}
                      >
                        <span className="truncate">{p.pseudo}</span>
                        {count > 0 && (
                          <span className="rounded-full bg-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </>
          ) : isAlive && currentPlayer?.role === "petite-fille" ? (
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-indigo-200">
                Vous écoutez discrètement dans le noir...
              </p>
              <p className="text-[11px] text-slate-400">
                {players.filter((p) => isWolfRole(p.role) && p.has_voted).length}{" "}
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

      {/* 5. NIGHT_WITCH */}
      {room.phase === "NIGHT_WITCH" && (
        <section className="glass-panel rounded-3xl p-4 space-y-3">
          {isAlive && currentPlayer?.role === "sorciere" ? (
            <>
              <div className="flex items-center gap-2 text-emerald-200">
                <FlaskConical className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold">
                  Laboratoire de la Sorcière
                </h3>
              </div>

              {witchSubmitted ? (
                <p className="text-xs text-emerald-200">
                  Vos choix nocturnes ont été scellés.
                </p>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-slate-200">
                    {wolfVictim ? (
                      <span>
                        Victime des loups cette nuit :{" "}
                        <strong className="text-rose-300">
                          {wolfVictim.pseudo}
                        </strong>
                      </span>
                    ) : (
                      <span>Aucune victime désignée par les loups cette nuit.</span>
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
                      <div className="grid grid-cols-2 gap-2">
                        {alivePlayers
                          .filter((p) => p.id !== currentPlayer.id)
                          .map((p) => {
                            const selected = witchKillId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setWitchKillId((prev) =>
                                    prev === p.id ? null : p.id
                                  )
                                }
                                className={`min-h-[40px] rounded-xl border px-2.5 text-xs font-medium ${
                                  selected
                                    ? "border-purple-400 bg-purple-500/25 text-purple-100"
                                    : "border-white/10 bg-black/35 text-slate-300"
                                }`}
                              >
                                Empoisonner {p.pseudo}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleWitchSubmit}
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

      {/* 6. DAY_ANNOUNCEMENT */}
      {room.phase === "DAY_ANNOUNCEMENT" && (
        <section className="glass-panel rounded-3xl border-amber-300/35 p-4 text-center space-y-2.5">
          <Sun className="mx-auto h-7 w-7 text-amber-300" />
          <p className="font-display text-base font-bold text-amber-100">
            Le Soleil se lève
          </p>
          <p className="text-xs leading-relaxed text-slate-200">
            {state.lastAnnouncement || "Le village se réveille."}
          </p>
        </section>
      )}

      {/* 7. DAY_VOTE */}
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
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {alivePlayers
                .filter((p) => p.id !== currentPlayer?.id)
                .map((p) => {
                  const selectedByMe = currentPlayer?.target_id === p.id;
                  const votes = voteCounts.get(p.id) ?? 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleVote(p.id)}
                      className={`flex min-h-[48px] items-center justify-between rounded-2xl border px-3 py-2 text-xs font-semibold transition-all ${
                        selectedByMe
                          ? "border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                          : "border-white/10 bg-black/35 text-slate-200"
                      }`}
                    >
                      <span className="truncate">{p.pseudo}</span>
                      {votes > 0 && (
                        <span className="rounded-full bg-rose-500/35 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                          {votes}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* 8. HUNTER_SHOT */}
      {room.phase === "HUNTER_SHOT" && (
        <section className="glass-panel rounded-3xl border-amber-400/45 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-200">
            <Crosshair className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold">
              Dernier Tir du Chasseur
            </h3>
          </div>

          {currentPlayer?.id === state.hunterPendingPlayerId ? (
            <div className="grid grid-cols-2 gap-2">
              {alivePlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleHunterShot(p.id)}
                  className="min-h-[46px] rounded-2xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/25"
                >
                  Tirer sur {p.pseudo}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300">
              Le Chasseur vise sa dernière cible avant de succomber...
            </p>
          )}
        </section>
      )}

      {/* 9. VICTORY */}
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
              onClick={handleReplay}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 to-amber-600 text-sm font-bold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retourner au salon pour rejouer</span>
            </button>
          )}
        </section>
      )}

      {/* Liste des joueurs vivants / éliminés */}
      <section className="glass-panel rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display font-bold text-amber-100">
            Villageois ({alivePlayers.length}/{players.length} en vie)
          </span>
          <span className="text-[11px] text-slate-400">Temps réel</span>
        </div>

        <div className="space-y-1.5">
          {players.map((p) => {
            const avatarProfile = decodeAvatarToProfile(
              p.avatar_data,
              p.pseudo,
              p.is_owner
            );
            const showRole =
              room.phase === "VICTORY" ||
              !p.is_alive ||
              p.id === currentPlayer?.id ||
              (isWolf && isWolfRole(p.role));
            const roleInfo = p.role ? ROLE_BY_ID[p.role] : null;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${
                  p.is_alive
                    ? "border-white/10 bg-black/35"
                    : "border-white/5 bg-black/20 opacity-55"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar profile={avatarProfile} size="sm" />
                  <div className="min-w-0">
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
    </div>
  );
}
