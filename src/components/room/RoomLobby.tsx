"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  Crown,
  Link2,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  Wand2,
} from "lucide-react";
import { GAME_ROLES, ROLE_BY_ID } from "@/data/roles";
import {
  LOBBY_ROLE_PRESETS,
  buildLobbyPresetComposition,
  type LobbyRolePresetId,
} from "@/lib/balancer";
import { triggerHaptic } from "@/lib/haptics";
import {
  decodeAvatarToProfile,
  startGameInRoom,
  updateRoomComposition,
  updateRoomLobbySettings,
  updateRoomNarratorMode,
} from "@/lib/roomService";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import type {
  RoleComposition,
  RoomPlayerRecord,
  RoomRecord,
  TtsVoiceName,
} from "@/types/game";

interface RoomLobbyProps {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  isHost: boolean;
  isOwner: boolean;
  onRefresh: () => Promise<void>;
}

const DEBATE_DURATION_OPTIONS: Array<{
  label: string;
  value: number | null;
}> = [
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "3 min", value: 180 },
  { label: "Illimité", value: null },
];

export function RoomLobby({
  room,
  players,
  isHost,
  isOwner,
  onRefresh,
}: RoomLobbyProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [activePreset, setActivePreset] = useState<LobbyRolePresetId | null>(
    null
  );

  const canManage = isHost || isOwner;
  const gs = room.game_state;
  const composition = room.role_composition ?? {};
  const totalRoles = Object.values(composition).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0
  );
  const rolesMatchPlayers = totalRoles === players.length;
  const canStart = players.length >= 4 && rolesMatchPlayers && !busy;

  const activeRoleEntries = Object.entries(composition)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([id, count]) => ({
      role: ROLE_BY_ID[id],
      count: count ?? 0,
    }))
    .filter((item) => Boolean(item.role));

  const runLobbyTask = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    triggerHaptic(18);
    try {
      await task();
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de mettre à jour."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      triggerHaptic(14);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setError("Copie du code impossible sur ce navigateur.");
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/room/${room.code}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      triggerHaptic(14);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setError("Copie du lien impossible sur ce navigateur.");
    }
  };

  const handleApplyPreset = (presetId: LobbyRolePresetId) => {
    if (!canManage) return;
    setActivePreset(presetId);
    const targetCount = Math.max(4, players.length);
    const nextComp = buildLobbyPresetComposition(presetId, targetCount);
    void runLobbyTask(() => updateRoomComposition(room.id, nextComp));
  };

  const handleAdjustRole = (roleId: string, delta: number) => {
    if (!canManage) return;
    const current = composition[roleId] ?? 0;
    const nextVal = Math.max(0, Math.min(20, current + delta));
    if (nextVal === current) return;

    const nextComp: RoleComposition = {
      ...composition,
      [roleId]: nextVal,
    };
    setActivePreset(null);
    void runLobbyTask(() => updateRoomComposition(room.id, nextComp));
  };

  const handleAutoFitPlayers = () => {
    if (!canManage || players.length < 4) return;
    const presetToUse = activePreset ?? "rapide-classique";
    const nextComp = buildLobbyPresetComposition(presetToUse, players.length);
    void runLobbyTask(() => updateRoomComposition(room.id, nextComp));
  };

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* Carte Code Salon */}
      <section className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/85">
              Code du Salon
            </p>
            <h1 className="font-display text-3xl font-black tracking-[0.24em] text-amber-50">
              {room.code}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="glass-pill inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-3 text-xs font-semibold text-amber-100 hover:border-amber-300/45"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span>{copiedCode ? "Copié" : "Code"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="glass-pill inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-3 text-xs font-semibold text-slate-200 hover:border-amber-300/45"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Link2 className="h-3.5 w-3.5 text-purple-300" />
              )}
              <span>{copiedLink ? "Lien copié" : "Inviter"}</span>
            </button>
          </div>
        </div>

        {/* Mode Narrateur */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canManage || busy}
            onClick={() =>
              runLobbyTask(() => updateRoomNarratorMode(room.id, "auto"))
            }
            className={`glass-subcard flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-3 text-xs font-semibold transition ${
              room.narrator_mode === "auto"
                ? "border-amber-400/60 bg-amber-500/15 text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.2)]"
                : "text-slate-300 hover:text-white"
            } disabled:cursor-default`}
          >
            <Volume2 className="h-4 w-4 text-amber-300" />
            <span>Narrateur Auto (IA)</span>
          </button>

          <button
            type="button"
            disabled={!canManage || busy}
            onClick={() =>
              runLobbyTask(() => updateRoomNarratorMode(room.id, "human"))
            }
            className={`glass-subcard flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-3 text-xs font-semibold transition ${
              room.narrator_mode === "human"
                ? "border-purple-400/60 bg-purple-500/20 text-purple-100 shadow-[0_0_16px_rgba(124,58,237,0.22)]"
                : "text-slate-300 hover:text-white"
            } disabled:cursor-default`}
          >
            <Mic className="h-4 w-4 text-purple-300" />
            <span>Narrateur Humain</span>
          </button>
        </div>
      </section>

      {/* Options de partie rapides (Débats, Maire, Voix Gemini) */}
      <section className="glass-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Règles &amp; Ambiance</span>
          </span>
          {!canManage && (
            <span className="text-[10px] text-slate-400">
              Réglages de l&apos;hôte
            </span>
          )}
        </div>

        {/* Durée débats de jour */}
        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span>Durée des débats de jour</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {DEBATE_DURATION_OPTIONS.map((opt) => {
              const selected = gs.dayDebateSeconds === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={!canManage || busy}
                  onClick={() =>
                    runLobbyTask(() =>
                      updateRoomLobbySettings(room, {
                        dayDebateSeconds: opt.value,
                      })
                    )
                  }
                  className={`min-h-[38px] rounded-xl border px-2 text-[11px] font-semibold transition ${
                    selected
                      ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-black/35 text-slate-300 hover:border-white/25"
                  } disabled:cursor-default`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle Élection du Maire + Choix voix féminine Gemini */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canManage || busy}
            onClick={() =>
              runLobbyTask(() =>
                updateRoomLobbySettings(room, {
                  mayorEnabled: !gs.mayorEnabled,
                })
              )
            }
            className={`glass-subcard flex min-h-[48px] items-center justify-between rounded-2xl px-3 py-2 text-left transition ${
              gs.mayorEnabled
                ? "border-amber-300/50 bg-amber-500/15"
                : "opacity-75"
            } disabled:cursor-default`}
          >
            <div>
              <p className="text-xs font-semibold text-amber-50">
                Élection du Maire
              </p>
              <p className="text-[10px] text-slate-400">
                Voix double au Jour 1
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                gs.mayorEnabled
                  ? "bg-emerald-500/25 text-emerald-200"
                  : "bg-slate-700/60 text-slate-400"
              }`}
            >
              {gs.mayorEnabled ? "Activée" : "Désactivée"}
            </span>
          </button>

          <div className="glass-subcard flex min-h-[48px] items-center justify-between rounded-2xl px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-amber-50">
                Voix IA Féminine
              </p>
              <p className="text-[10px] text-slate-400">Narration Gemini TTS</p>
            </div>
            <div className="flex items-center gap-1">
              {(["Aoede", "Kore"] as TtsVoiceName[]).map((voice) => (
                <button
                  key={voice}
                  type="button"
                  disabled={!canManage || busy}
                  onClick={() =>
                    runLobbyTask(() =>
                      updateRoomLobbySettings(room, { ttsVoice: voice })
                    )
                  }
                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                    gs.ttsVoice === voice
                      ? "border-purple-400 bg-purple-500/25 text-purple-100"
                      : "border-white/10 bg-black/35 text-slate-400"
                  } disabled:cursor-default`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Presets en 1 clic & Composition des rôles */}
      <section className="glass-panel rounded-3xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200">
            <Wand2 className="h-3.5 w-3.5 text-amber-300" />
            <span>Composition ({totalRoles}/{players.length} joueurs)</span>
          </span>

          {canManage && !rolesMatchPlayers && players.length >= 4 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleAutoFitPlayers}
              className="rounded-full border border-amber-300/45 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-500/30"
            >
              Adapter à {players.length} joueurs
            </button>
          )}
        </div>

        {/* Presets en 1 clic */}
        {canManage && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {LOBBY_ROLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => handleApplyPreset(preset.id)}
                className={`glass-subcard rounded-2xl p-2.5 text-left transition hover:border-amber-300/45 ${
                  activePreset === preset.id
                    ? "border-amber-400/65 bg-amber-500/15"
                    : ""
                }`}
              >
                <p className="text-xs font-bold text-amber-100">
                  {preset.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Badges de la composition actuelle */}
        <div className="flex flex-wrap gap-1.5">
          {activeRoleEntries.length > 0 ? (
            activeRoleEntries.map(({ role, count }) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-slate-200"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: role.aura.primary }}
                />
                <span>
                  {count}x {role.name}
                </span>
              </span>
            ))
          ) : (
            <p className="text-xs text-slate-400">
              Aucun rôle sélectionné pour l&apos;instant.
            </p>
          )}
        </div>

        {/* Édition manuelle détaillée par rôle */}
        {canManage && (
          <div>
            <button
              type="button"
              onClick={() => setShowRoleEditor((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
            >
              <span>Ajuster rôle par rôle</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  showRoleEditor ? "rotate-180" : ""
                }`}
              />
            </button>

            {showRoleEditor && (
              <div className="mt-2 grid max-h-60 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
                {GAME_ROLES.map((role) => {
                  const count = composition[role.id] ?? 0;
                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-amber-50">
                          {role.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {role.factionLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy || count <= 0}
                          onClick={() => handleAdjustRole(role.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-sm font-bold text-slate-200 disabled:opacity-35"
                        >
                          -
                        </button>
                        <span className="w-4 text-center text-xs font-bold text-amber-200">
                          {count}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAdjustRole(role.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-sm font-bold text-slate-200 disabled:opacity-35"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Liste des joueurs dans le salon */}
      <section className="glass-panel rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-amber-100">
            <Users className="h-3.5 w-3.5 text-amber-300" />
            <span>Joueurs connectés ({players.length}/20)</span>
          </span>
          {players.length < 4 && (
            <span className="text-[10px] text-amber-300/85">
              Min. 4 joueurs requis
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {players.map((p) => {
            const avatarProfile = decodeAvatarToProfile(
              p.avatar_data,
              p.pseudo,
              p.is_owner
            );
            const playerIsHost = p.user_id === room.host_user_id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar profile={avatarProfile} size="sm" />
                  <p className="truncate text-xs font-semibold text-amber-50">
                    {p.pseudo}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {playerIsHost && (
                    <span
                      title="Hôte du salon"
                      className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-200"
                    >
                      <Crown className="h-2.5 w-2.5" />
                      Hôte
                    </span>
                  )}
                  {p.is_owner && (
                    <span
                      title="Owner"
                      className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-200"
                    >
                      <ShieldCheck className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-400/45 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Lancer la partie */}
      {canManage ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={() => runLobbyTask(() => startGameInRoom(room, players))}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 via-crimson to-amber-600 text-sm font-bold text-white shadow-[0_12px_28px_rgba(155,27,48,0.45)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>
            {players.length < 4
              ? `En attente de joueurs (${players.length}/4 min.)`
              : !rolesMatchPlayers
                ? `Ajuster les rôles (${totalRoles}/${players.length})`
                : "Lancer la partie"}
          </span>
        </button>
      ) : (
        <div className="glass-panel rounded-2xl px-4 py-3 text-center text-xs text-slate-300">
          En attente que l&apos;hôte lance la partie sous la Lune de Sang...
        </div>
      )}
    </div>
  );
}
