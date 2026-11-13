"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  playPhaseSoundEffect,
  preloadFrenchNarration,
  speakFrenchNarration,
  stopFrenchNarration,
  unlockAudioPlayback,
} from "@/lib/audioNarrator";
import {
  didPlayerWinVictory,
  predictNextNarrationText,
} from "@/lib/gameEngine";
import { ensurePlayerIdentity } from "@/lib/playerIdentity";
import { usePlayerProfile } from "@/lib/profileStorage";
import {
  advanceRoomPhase,
  fetchRoomSnapshot,
  getAutoNarratorSpeech,
  isEffectiveWolf,
  joinRoomInSupabase,
  updateRoomLobbySettings,
} from "@/lib/roomService";
import { useWakeLock } from "@/hooks/useWakeLock";
import { BloodMoonBackdrop } from "@/components/ui/BloodMoonBackdrop";
import { RoomLobby } from "@/components/room/RoomLobby";
import { RoomArena } from "@/components/room/RoomArena";
import { RoomOwnerPanel } from "@/components/room/RoomOwnerPanel";
import type {
  BackdropTheme,
  RoomPlayerRecord,
  RoomRecord,
} from "@/types/game";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

function RoomSuspenseFallback() {
  return (
    <>
      <BloodMoonBackdrop theme="night" />
      <div className="glass-panel flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        <p className="font-display text-sm font-semibold tracking-wider text-amber-100">
          Ouverture du salon sous la Lune de Sang...
        </p>
      </div>
    </>
  );
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 overflow-x-clip px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <Suspense fallback={<RoomSuspenseFallback />}>
        <RoomContent params={params} />
      </Suspense>
    </main>
  );
}

function RoomContent({ params }: RoomPageProps) {
  const { code } = use(params);
  const normalizedCode = code.trim().toUpperCase();

  const [profile] = usePlayerProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const lastSpokenKeyRef = useRef<string>("");
  const autoAdvancingRef = useRef<boolean>(false);

  // Empêcher la mise en veille des téléphones pendant la partie
  const wakeLockActive = useWakeLock(Boolean(room));

  const refreshSnapshot = useCallback(async () => {
    try {
      const snap = await fetchRoomSnapshot(normalizedCode);
      setRoom(snap.room);
      setPlayers(snap.players);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger le salon."
      );
    }
  }, [normalizedCode]);

  // 1. Authentification anonyme (ou UUID fallback) + jonction au salon
  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        const identity = await ensurePlayerIdentity();
        if (!active) return;
        setUserId(identity.userId);

        const joined = await joinRoomInSupabase({
          code: normalizedCode,
          userId: identity.userId,
          profile,
        });
        if (!active) return;
        setRoom(joined.room);
        setPlayers(joined.players);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Erreur de connexion au salon Supabase."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void init();

    return () => {
      active = false;
      stopFrenchNarration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  // 2. Abonnement Supabase Realtime sur rooms et room_players
  useEffect(() => {
    if (!room?.id) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`room-live-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        () => {
          void refreshSnapshot();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void refreshSnapshot();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, refreshSnapshot]);

  const currentPlayer =
    players.find((p) => p.user_id === userId) ?? null;

  const backdropTheme: BackdropTheme = (() => {
    if (!room) return "night";
    if (room.phase === "VICTORY") {
      const won = didPlayerWinVictory(currentPlayer, room.game_state);
      return won === false ? "defeat" : "victory";
    }
    if (room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE") {
      return "day";
    }
    return "night";
  })();

  const currentAnnouncementText =
    room && room.phase !== "LOBBY"
      ? getAutoNarratorSpeech(
          room.phase,
          room.game_state,
          room.turn_number,
          players
        )
      : "";

  // Débloque la lecture audio navigateur dès la première interaction utilisateur
  useEffect(() => {
    const handleUnlock = () => unlockAudioPlayback();
    window.addEventListener("pointerdown", handleUnlock, { once: true });
    window.addEventListener("keydown", handleUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };
  }, []);

  // Synchronise le thème atmosphérique dynamique sur le document (verre nuit / jour / victoire / défaite)
  useEffect(() => {
    document.documentElement.dataset.atmosphere = backdropTheme;
    return () => {
      delete document.documentElement.dataset.atmosphere;
    };
  }, [backdropTheme]);

  // 3. Narrateur Automatique + Préchargement anticipé Gemini TTS + Filtrage Appareil Audio Principal
  useEffect(() => {
    if (!room || room.narrator_mode !== "auto" || room.phase === "LOBBY") {
      return;
    }

    const stepKey = `${room.phase}-${room.game_state.nightStep ?? "main"}-${room.game_state.voteMode}-${room.turn_number}`;
    if (lastSpokenKeyRef.current === stepKey) return;
    lastSpokenKeyRef.current = stepKey;

    const primaryId = room.game_state.primaryAudioUserId;
    const isPrimaryDevice = !primaryId || primaryId === userId;
    if (!soundEnabled || !isPrimaryDevice) return;

    const tone =
      room.phase === "VICTORY"
        ? "victory"
        : room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE"
          ? "day"
          : "night";

    playPhaseSoundEffect(room.phase);
    const speech = getAutoNarratorSpeech(
      room.phase,
      room.game_state,
      room.turn_number,
      players
    );
    if (speech) {
      void speakFrenchNarration(speech, {
        voice: room.game_state.ttsVoice,
        tone,
      });
    }

    const predictedNext = predictNextNarrationText(
      room.phase,
      room.game_state,
      room.turn_number,
      players
    );
    if (predictedNext) {
      const nextTone =
        room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE"
          ? "day"
          : "night";
      preloadFrenchNarration(predictedNext, {
        voice: room.game_state.ttsVoice,
        tone: nextTone,
      });
    }
  }, [room, players, soundEnabled, userId]);

  // 4. Pilotage automatique des minuteurs & complétion anticipée par l'hôte en Mode Auto
  const isHost = Boolean(room && userId && room.host_user_id === userId);
  useEffect(() => {
    if (
      !room ||
      !isHost ||
      room.narrator_mode !== "auto" ||
      room.phase === "LOBBY" ||
      room.phase === "VICTORY"
    ) {
      return;
    }

    const checkAutoAdvance = async () => {
      if (autoAdvancingRef.current) return;

      const gs = room.game_state;
      const step = gs.nightStep;
      const deadlinePassed =
        gs.phaseDeadline && Date.now() >= new Date(gs.phaseDeadline).getTime();

      let actionComplete = false;
      if (room.phase === "ROLE_REVEAL") {
        const aliveCount = players.filter((p) => p.is_alive).length;
        if (aliveCount > 0 && gs.readyUserIds.length >= aliveCount) {
          actionComplete = true;
        }
      } else if (room.phase.startsWith("NIGHT_")) {
        if (step === "cupidon" || (!step && room.phase === "NIGHT_CUPIDON")) {
          actionComplete = gs.cupidonTargets.length === 2;
        } else if (step === "enfant-sauvage") {
          actionComplete = Boolean(gs.wildChildModelId);
        } else if (step === "fratrie") {
          const siblings = players.filter(
            (p) => p.is_alive && (p.role === "soeurs" || p.role === "freres")
          );
          actionComplete =
            siblings.length > 0 &&
            siblings.every((s) => gs.readyUserIds.includes(s.user_id));
        } else if (step === "salvateur") {
          actionComplete = Boolean(gs.salvateurTargetId);
        } else if (step === "voyante" || (!step && room.phase === "NIGHT_SEER")) {
          actionComplete = Boolean(gs.seerInspectedId);
        } else if (step === "renard") {
          actionComplete = Boolean(gs.foxCheckedTonight);
        } else if (
          step === "loups" ||
          (!step && room.phase === "NIGHT_WEREWOLVES")
        ) {
          const aliveWolves = players.filter(
            (p) => p.is_alive && isEffectiveWolf(p, gs)
          );
          actionComplete =
            aliveWolves.length > 0 && aliveWolves.every((w) => w.has_voted);
        } else if (step === "loup-blanc") {
          const whiteWolf = players.find(
            (p) => p.is_alive && p.role === "loup-garou-blanc"
          );
          actionComplete = Boolean(
            gs.loupBlancTargetId ||
              (whiteWolf && gs.readyUserIds.includes(whiteWolf.user_id))
          );
        } else if (step === "grand-mechant-loup") {
          const bigWolf = players.find(
            (p) => p.is_alive && p.role === "grand-mechant-loup"
          );
          actionComplete = Boolean(
            gs.grandMechantSecondTargetId ||
              (bigWolf && gs.readyUserIds.includes(bigWolf.user_id))
          );
        } else if (step === "sorciere" || (!step && room.phase === "NIGHT_WITCH")) {
          const witch = players.find(
            (p) => p.is_alive && p.role === "sorciere"
          );
          actionComplete = Boolean(
            gs.witchSaveTonight ||
              gs.witchKillTargetId ||
              (witch && gs.readyUserIds.includes(witch.user_id))
          );
        } else if (step === "corbeau") {
          actionComplete = Boolean(gs.corbeauTargetId);
        } else if (step === "joueur-de-flute") {
          actionComplete = gs.piperTargetsTonight.length > 0;
        }
      } else if (room.phase === "DAY_VOTE") {
        const eligible =
          gs.voteMode === "MAYOR_ELECTION"
            ? players.filter((p) => p.is_alive)
            : players.filter(
                (p) => p.is_alive && !gs.idiotSparedPlayerIds.includes(p.id)
              );
        if (eligible.length > 0 && eligible.every((p) => p.has_voted)) {
          actionComplete = true;
        }
      }

      if (deadlinePassed || actionComplete) {
        autoAdvancingRef.current = true;
        try {
          if (actionComplete && !deadlinePassed) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          await advanceRoomPhase(room, players);
          await refreshSnapshot();
        } finally {
          autoAdvancingRef.current = false;
        }
      }
    };

    const timer = window.setInterval(() => {
      void checkAutoAdvance();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [room, players, isHost, refreshSnapshot]);

  const handleToggleSound = () => {
    unlockAudioPlayback();
    setSoundEnabled((prev) => {
      if (prev) stopFrenchNarration();
      return !prev;
    });
  };

  const handleReplayNarration = () => {
    if (!room || !currentAnnouncementText) return;
    unlockAudioPlayback();
    const tone =
      room.phase === "VICTORY"
        ? "victory"
        : room.phase === "DAY_ANNOUNCEMENT" || room.phase === "DAY_VOTE"
          ? "day"
          : "night";
    void speakFrenchNarration(currentAnnouncementText, {
      voice: room.game_state.ttsVoice,
      tone,
    });
  };

  const handleTogglePrimaryAudio = async () => {
    if (!room || !userId) return;
    unlockAudioPlayback();
    const isCurrentlyPrimary = room.game_state.primaryAudioUserId === userId;
    await updateRoomLobbySettings(room, {
      primaryAudioUserId: isCurrentlyPrimary ? null : userId,
    });
    await refreshSnapshot();
  };

  return (
    <>
      <BloodMoonBackdrop theme={backdropTheme} />

      {/* Barre supérieure du salon */}
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="glass-panel inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-200 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Accueil</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {wakeLockActive && (
            <span
              title="Écran maintenu actif"
              className="glass-panel inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[10px] font-medium text-emerald-200"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              <span>Écran actif</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
            className="glass-panel flex h-9 w-9 items-center justify-center rounded-full text-amber-200"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="glass-panel flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
          <p className="text-sm font-medium text-amber-100">
            Connexion au salon {normalizedCode}...
          </p>
        </div>
      ) : error || !room ? (
        <div className="glass-panel flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center">
          <p className="font-display text-lg font-bold text-rose-200">
            Salon inaccessible
          </p>
          <p className="text-xs leading-relaxed text-slate-300">
            {error ?? "Ce salon n'existe pas ou a expiré."}
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-gradient-to-r from-rose-700 to-amber-600 px-5 text-xs font-bold text-white"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {room.phase === "LOBBY" ? (
            <RoomLobby
              room={room}
              players={players}
              isHost={isHost}
              isOwner={profile.isOwner}
              onRefresh={refreshSnapshot}
            />
          ) : (
            <RoomArena
              key={`${room.phase}-${room.game_state.nightStep ?? "main"}-${room.game_state.voteMode}-${room.turn_number}`}
              room={room}
              players={players}
              currentPlayer={currentPlayer}
              currentUserId={userId}
              isHost={isHost}
              isOwner={profile.isOwner}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              lastAnnouncementText={currentAnnouncementText}
              onReplayNarration={handleReplayNarration}
              onTogglePrimaryAudio={handleTogglePrimaryAudio}
              onRefresh={refreshSnapshot}
            />
          )}

          {/* Contrôles Owner (alucard) discrets en partie */}
          {profile.isOwner && (
            <RoomOwnerPanel
              room={room}
              players={players}
              onRefresh={refreshSnapshot}
            />
          )}
        </div>
      )}
    </>
  );
}
