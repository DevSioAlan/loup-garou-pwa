"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Crown,
  Loader2,
  Mic,
  Play,
  Share2,
  Users,
} from "lucide-react";
import { ROLE_BY_ID } from "@/data/roles";
import { triggerHaptic } from "@/lib/haptics";
import {
  decodeAvatarToProfile,
  startGameInRoom,
  updateRoomNarratorMode,
} from "@/lib/roomService";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import type { NarratorMode, RoomPlayerRecord, RoomRecord } from "@/types/game";

interface RoomLobbyProps {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  isHost: boolean;
  isOwner: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * Salon d'attente temps réel (Lobby) :
 * - Code 4 lettres copiable / partageable
 * - Liste temps réel des joueurs connectés (avatar GIF/icône, pseudo, couronne Owner)
 * - Choix du Mode Narrateur (Automatique vs Je suis le Narrateur) par l'hôte
 */
export function RoomLobby({
  room,
  players,
  isHost,
  isOwner,
  onRefresh,
}: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const canStart = players.length >= 4 || isOwner;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      triggerHaptic(20);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/room/${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lune de Sang — Salon ${room.code}`,
          text: `Rejoins ma partie de Loup-Garou avec le code ${room.code} !`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback copie
      }
    }
    await handleCopyCode();
  };

  const handleNarratorChange = async (mode: NarratorMode) => {
    if (!isHost && !isOwner) return;
    triggerHaptic(20);
    await updateRoomNarratorMode(room.id, mode);
    await onRefresh();
  };

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    triggerHaptic(25);
    try {
      await startGameInRoom(room, players);
      await onRefresh();
    } finally {
      setStarting(false);
    }
  };

  const activeRolesSummary = Object.entries(room.role_composition)
    .filter(([, count]) => count > 0)
    .map(([roleId, count]) => `${count}× ${ROLE_BY_ID[roleId]?.name ?? roleId}`);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Carte du code salon */}
      <section className="glass-panel rounded-3xl p-4 text-center space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-200/80">
          Code du Salon
        </p>

        <div className="flex items-center justify-center gap-3">
          <span className="font-display title-aura-text text-4xl font-bold tracking-[0.3em] text-amber-100">
            {room.code}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 text-xs font-medium text-amber-100 hover:bg-white/10"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Code copié</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-amber-300" />
                <span>Copier</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Inviter</span>
          </button>
        </div>
      </section>

      {/* Mode Narrateur */}
      <section className="glass-panel rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-amber-100">
            Mode de Narration
          </h2>
          {!isHost && !isOwner && (
            <span className="text-[10px] text-slate-400">Choisi par l&apos;hôte</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isHost && !isOwner}
            onClick={() => handleNarratorChange("auto")}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
              room.narrator_mode === "auto"
                ? "border-amber-300/60 bg-amber-400/15 text-amber-50 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            <Bot className="h-4 w-4 text-amber-300" />
            <span className="text-xs font-semibold">Narrateur Auto</span>
            <span className="text-[10px] text-slate-400">
              Voix FR, minuteurs &amp; sons
            </span>
          </button>

          <button
            type="button"
            disabled={!isHost && !isOwner}
            onClick={() => handleNarratorChange("human")}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
              room.narrator_mode === "human"
                ? "border-purple-400/60 bg-purple-500/15 text-purple-50 shadow-[0_0_20px_rgba(168,85,247,0.22)]"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            <Mic className="h-4 w-4 text-purple-300" />
            <span className="text-xs font-semibold">Je suis le Narrateur</span>
            <span className="text-[10px] text-slate-400">
              Script guidé &amp; contrôle manuel
            </span>
          </button>
        </div>
      </section>

      {/* Liste temps réel des joueurs connectés */}
      <section className="glass-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-300" />
            <h2 className="font-display text-sm font-bold text-amber-100">
              Joueurs connectés ({players.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">Temps réel</span>
        </div>

        <div className="space-y-2">
          {players.map((player) => {
            const avatarProfile = decodeAvatarToProfile(
              player.avatar_data,
              player.pseudo,
              player.is_owner
            );
            const playerIsHost = player.user_id === room.host_user_id;

            return (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar profile={avatarProfile} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-amber-50">
                        {player.pseudo}
                      </span>
                      {player.is_owner && (
                        <Crown
                          className="h-3.5 w-3.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {playerIsHost && (
                  <span className="rounded-full border border-rose-400/35 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                    Hôte
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {activeRolesSummary.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
              Composition prévue
            </p>
            <p className="text-xs leading-relaxed text-slate-200">
              {activeRolesSummary.join(" • ")}
            </p>
          </div>
        )}
      </section>

      {/* Bouton Lancer la partie (Hôte ou Owner) */}
      {(isHost || isOwner) ? (
        <button
          type="button"
          disabled={!canStart || starting}
          onClick={handleStart}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-sm font-bold text-white shadow-[0_8px_28px_rgba(155,27,48,0.5)] transition-transform active:scale-[0.98] disabled:opacity-45"
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Distribution des rôles...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>
                {players.length < 4 && isOwner
                  ? `Lancer en test Owner (${players.length}j)`
                  : canStart
                    ? "Lancer la partie"
                    : `En attente (${players.length}/4 joueurs min)`}
              </span>
            </>
          )}
        </button>
      ) : (
        <div className="glass-panel rounded-2xl p-3 text-center text-xs text-slate-300">
          En attente que l&apos;hôte lance la partie...
        </div>
      )}
    </div>
  );
}
