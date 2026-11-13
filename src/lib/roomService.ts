import { createClient } from "@/lib/supabase/client";
import {
  buildPhaseDeadline,
  createInitialGameState,
  dealRolesToPlayers,
  encodeProfileAvatar,
  evaluateVictory,
  generateRoomCode,
  isWolfRole,
  resolveDeathsWithCascade,
  resolveNextNightPhase,
  tallyTargetFromVoters,
} from "@/lib/gameEngine";
import type {
  GamePhase,
  NarratorMode,
  PlayerProfile,
  RoleComposition,
  RoomGameState,
  RoomPlayerRecord,
  RoomRecord,
} from "@/types/game";

export {
  decodeAvatarToProfile,
  generateRoomCode,
  getAutoNarratorSpeech,
  getHumanNarratorScript,
  getPhaseLabel,
  isWolfRole,
} from "@/lib/gameEngine";

function normalizeRoom(row: Record<string, unknown>): RoomRecord {
  const rawState = (row.game_state ?? {}) as Partial<RoomGameState>;
  return {
    id: String(row.id),
    code: String(row.code),
    host_user_id: String(row.host_user_id),
    narrator_mode: row.narrator_mode === "human" ? "human" : "auto",
    phase: (row.phase as GamePhase) ?? "LOBBY",
    turn_number: Number(row.turn_number ?? 1),
    role_composition: (row.role_composition ?? {}) as RoleComposition,
    game_state: {
      ...createInitialGameState(),
      ...rawState,
    },
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function withRequestTimeout<T>(
  promise: PromiseLike<T>,
  ms = 12000,
  timeoutMessage = "Délai dépassé lors de la connexion à Supabase."
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => reject(new Error(timeoutMessage)), ms)
        : null;

    Promise.resolve(promise).then(
      (value) => {
        if (timer !== null) window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (timer !== null) window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function formatSupabaseError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  fallback: string
): string {
  if (!error) return fallback;
  const msg = error.message || fallback;
  if (error.code === "42P01" || msg.includes("schema cache")) {
    return `${msg} — Exécutez supabase/schema.sql dans Supabase SQL Editor.`;
  }
  if (error.code === "42501" || msg.toLowerCase().includes("row-level security")) {
    return `Accès refusé (RLS) : ${msg}. Vérifiez les politiques dans supabase/schema.sql.`;
  }
  return msg;
}

/**
 * Inscrit ou met à jour un joueur dans room_players.
 * Si l'avatar Base64/GIF est trop volumineux et échoue, retombe proprement sur l'icône prédéfinie.
 */
async function upsertPlayerWithAvatarFallback(params: {
  roomId: string;
  userId: string;
  profile: PlayerProfile;
  isAlive: boolean;
}): Promise<void> {
  const supabase = createClient();
  const pseudo = params.profile.nickname.trim() || "Veilleur";
  const primaryAvatar = encodeProfileAvatar(params.profile);
  const fallbackAvatar = `preset:${params.profile.avatarPreset}`;

  // Limite préventive à ~400 Ko pour éviter de bloquer PostgREST sur mobile
  const candidateAvatar =
    primaryAvatar.length > 400_000 ? fallbackAvatar : primaryAvatar;

  const { error } = await withRequestTimeout(
    supabase.from("room_players").upsert(
      {
        room_id: params.roomId,
        user_id: params.userId,
        pseudo,
        avatar_data: candidateAvatar,
        is_owner: params.profile.isOwner,
        is_alive: params.isAlive,
        has_voted: false,
        target_id: null,
      },
      { onConflict: "room_id,user_id" }
    )
  );

  if (!error) return;

  // Seconde tentative immédiate sans le gros Base64 si l'avatar a bloqué l'insertion
  if (candidateAvatar !== fallbackAvatar) {
    const { error: retryError } = await withRequestTimeout(
      supabase.from("room_players").upsert(
        {
          room_id: params.roomId,
          user_id: params.userId,
          pseudo,
          avatar_data: fallbackAvatar,
          is_owner: params.profile.isOwner,
          is_alive: params.isAlive,
          has_voted: false,
          target_id: null,
        },
        { onConflict: "room_id,user_id" }
      )
    );
    if (!retryError) return;
    throw new Error(formatSupabaseError(retryError, "Impossible d'inscrire le joueur."));
  }

  throw new Error(formatSupabaseError(error, "Impossible d'inscrire le joueur."));
}

/**
 * Crée un nouveau salon dans Supabase avec un code à 4 lettres et inscrit l'hôte.
 */
export async function createRoomInSupabase(params: {
  code?: string;
  userId: string;
  profile: PlayerProfile;
  composition: RoleComposition;
  narratorMode: NarratorMode;
}): Promise<RoomRecord> {
  const supabase = createClient();
  const desiredCode = (params.code ?? generateRoomCode())
    .trim()
    .toUpperCase()
    .slice(0, 4);

  let createdRoom: RoomRecord | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = attempt === 0 ? desiredCode : generateRoomCode();
    const { data, error } = await withRequestTimeout(
      supabase
        .from("rooms")
        .insert({
          code,
          host_user_id: params.userId,
          narrator_mode: params.narratorMode,
          phase: "LOBBY",
          turn_number: 1,
          role_composition: params.composition,
          game_state: createInitialGameState(),
        })
        .select()
        .single()
    );

    if (!error && data) {
      createdRoom = normalizeRoom(data as Record<string, unknown>);
      break;
    }

    lastError = new Error(
      formatSupabaseError(error, "Erreur lors de la création du salon.")
    );

    // Ne réessayer un nouveau code que si ce code existe déjà (23505)
    if (error?.code !== "23505") {
      throw lastError;
    }
  }

  if (!createdRoom) {
    throw lastError ?? new Error("Impossible de créer le salon.");
  }

  await upsertPlayerWithAvatarFallback({
    roomId: createdRoom.id,
    userId: params.userId,
    profile: params.profile,
    isAlive: true,
  });

  return createdRoom;
}

/**
 * Rejoint un salon existant via son code à 4 lettres et met à jour le profil du joueur.
 */
export async function joinRoomInSupabase(params: {
  code: string;
  userId: string;
  profile: PlayerProfile;
}): Promise<{ room: RoomRecord; players: RoomPlayerRecord[] }> {
  const supabase = createClient();
  const normalizedCode = params.code.trim().toUpperCase();

  const { data: roomData, error: roomError } = await withRequestTimeout(
    supabase.from("rooms").select("*").eq("code", normalizedCode).single()
  );

  if (roomError || !roomData) {
    if (roomError && roomError.code !== "PGRST116") {
      throw new Error(
        formatSupabaseError(
          roomError,
          `Aucun salon trouvé pour le code « ${normalizedCode} ».`
        )
      );
    }
    throw new Error(`Aucun salon trouvé pour le code « ${normalizedCode} ».`);
  }

  const room = normalizeRoom(roomData as Record<string, unknown>);

  const { data: existingPlayer } = await withRequestTimeout(
    supabase
      .from("room_players")
      .select("id, is_alive")
      .eq("room_id", room.id)
      .eq("user_id", params.userId)
      .maybeSingle()
  );

  await upsertPlayerWithAvatarFallback({
    roomId: room.id,
    userId: params.userId,
    profile: params.profile,
    isAlive: existingPlayer ? Boolean(existingPlayer.is_alive) : room.phase === "LOBBY",
  });

  const { data: playersData, error: playersError } = await withRequestTimeout(
    supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true })
  );

  if (playersError) {
    throw new Error(
      formatSupabaseError(playersError, "Erreur lors du chargement des joueurs.")
    );
  }

  return {
    room,
    players: (playersData ?? []) as RoomPlayerRecord[],
  };
}

export async function fetchRoomSnapshot(
  code: string
): Promise<{ room: RoomRecord; players: RoomPlayerRecord[] }> {
  const supabase = createClient();
  const normalizedCode = code.trim().toUpperCase();

  const { data: roomData, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", normalizedCode)
    .single();

  if (roomError || !roomData) {
    throw new Error("Salon introuvable.");
  }

  const room = normalizeRoom(roomData as Record<string, unknown>);
  const { data: playersData, error: playersError } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  if (playersError) {
    throw new Error(playersError.message);
  }

  return {
    room,
    players: (playersData ?? []) as RoomPlayerRecord[],
  };
}

export async function updateRoomNarratorMode(
  roomId: string,
  narratorMode: NarratorMode
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({ narrator_mode: narratorMode })
    .eq("id", roomId);
}

export async function updateRoomComposition(
  roomId: string,
  composition: RoleComposition
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({ role_composition: composition })
    .eq("id", roomId);
}

/**
 * Lance la partie : distribue les rôles aléatoirement et passe à ROLE_REVEAL.
 */
export async function startGameInRoom(
  room: RoomRecord,
  players: RoomPlayerRecord[]
): Promise<void> {
  const supabase = createClient();
  const assignments = dealRolesToPlayers(players, room.role_composition);

  await Promise.all(
    assignments.map((item) =>
      supabase
        .from("room_players")
        .update({
          role: item.roleId,
          is_alive: true,
          has_voted: false,
          target_id: null,
        })
        .eq("id", item.playerId)
    )
  );

  const nextState: RoomGameState = {
    ...createInitialGameState(),
    phaseDeadline:
      room.narrator_mode === "auto"
        ? buildPhaseDeadline("ROLE_REVEAL")
        : null,
  };

  await supabase
    .from("rooms")
    .update({
      phase: "ROLE_REVEAL",
      turn_number: 1,
      game_state: nextState,
    })
    .eq("id", room.id);
}

async function clearPlayerVotes(roomId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({ has_voted: false, target_id: null })
    .eq("room_id", roomId);
}

/**
 * Fait avancer la machine à états vers la phase suivante en résolvant les actions.
 */
export async function advanceRoomPhase(
  room: RoomRecord,
  players: RoomPlayerRecord[]
): Promise<void> {
  const supabase = createClient();
  const state = { ...room.game_state };
  const isAuto = room.narrator_mode === "auto";

  if (room.phase === "ROLE_REVEAL") {
    const nextPhase = resolveNextNightPhase(
      "ROLE_REVEAL",
      players,
      room.turn_number
    );
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        game_state: {
          ...state,
          wolfTargetId: null,
          witchSaveTonight: false,
          witchKillTargetId: null,
          seerInspectedId: null,
          readyUserIds: [],
          phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase) : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "NIGHT_CUPIDON" || room.phase === "NIGHT_SEER") {
    const nextPhase = resolveNextNightPhase(
      room.phase,
      players,
      room.turn_number
    );
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        game_state: {
          ...state,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase) : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "NIGHT_WEREWOLVES") {
    const wolfVoters = players.filter((p) => p.is_alive && isWolfRole(p.role));
    const { targetId } = tallyTargetFromVoters(wolfVoters);

    const nextState: RoomGameState = {
      ...state,
      wolfTargetId: targetId,
    };

    const nextPhase = resolveNextNightPhase(
      "NIGHT_WEREWOLVES",
      players,
      room.turn_number
    );

    if (nextPhase === "DAY_ANNOUNCEMENT") {
      await resolveNightAndEnterDay(room, players, nextState);
      return;
    }

    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        game_state: {
          ...nextState,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase) : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "NIGHT_WITCH") {
    await resolveNightAndEnterDay(room, players, state);
    return;
  }

  if (room.phase === "DAY_ANNOUNCEMENT") {
    if (state.hunterPendingPlayerId) {
      await supabase
        .from("rooms")
        .update({
          phase: "HUNTER_SHOT",
          game_state: {
            ...state,
            hunterReturnPhase: "DAY_VOTE",
            phaseDeadline: isAuto ? buildPhaseDeadline("HUNTER_SHOT") : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const victory = evaluateVictory(
      players,
      state,
      room.turn_number,
      state.nightVictims.map((v) => v.playerId)
    );
    if (victory.winnerCamp) {
      await supabase
        .from("rooms")
        .update({
          phase: "VICTORY",
          game_state: {
            ...state,
            ...victory,
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }

    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: "DAY_VOTE",
        game_state: {
          ...state,
          phaseDeadline: isAuto ? buildPhaseDeadline("DAY_VOTE") : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "DAY_VOTE") {
    const aliveVoters = players.filter((p) => p.is_alive);
    const { targetId, isTie } = tallyTargetFromVoters(aliveVoters);

    if (!targetId) {
      const nextTurn = room.turn_number + 1;
      const nextNight = resolveNextNightPhase("DAY_VOTE", players, nextTurn);
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: nextNight,
          turn_number: nextTurn,
          game_state: {
            ...state,
            wolfTargetId: null,
            witchSaveTonight: false,
            witchKillTargetId: null,
            seerInspectedId: null,
            nightVictims: [],
            lastAnnouncement: isTie
              ? "Égalité lors du vote : personne n'a été exécuté aujourd'hui."
              : "Aucun vote exprimé : le village garde le silence.",
            phaseDeadline: isAuto ? buildPhaseDeadline(nextNight) : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const votedTarget = players.find((p) => p.id === targetId);
    if (votedTarget?.role === "idiot-du-village") {
      const nextTurn = room.turn_number + 1;
      const nextNight = resolveNextNightPhase("DAY_VOTE", players, nextTurn);
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: nextNight,
          turn_number: nextTurn,
          game_state: {
            ...state,
            wolfTargetId: null,
            witchSaveTonight: false,
            witchKillTargetId: null,
            seerInspectedId: null,
            lastAnnouncement: `${votedTarget.pseudo} est l'Idiot du Village ! Le hameau l'épargne.`,
            phaseDeadline: isAuto ? buildPhaseDeadline(nextNight) : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const { updatedPlayers, victims, hunterPendingPlayerId, elderShieldTriggered } =
      resolveDeathsWithCascade(players, state, [
        { playerId: targetId, cause: "village" },
      ]);

    await Promise.all(
      victims.map((v) =>
        supabase
          .from("room_players")
          .update({ is_alive: false })
          .eq("id", v.playerId)
      )
    );

    const names = victims.map((v) => v.pseudo).join(" et ");
    const announcement = `${names} ${
      victims.length > 1 ? "ont été éliminés" : "a été éliminé"
    } par le village.`;

    if (hunterPendingPlayerId) {
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "HUNTER_SHOT",
          game_state: {
            ...state,
            elderShieldUsed: elderShieldTriggered,
            nightVictims: victims,
            lastAnnouncement: announcement,
            hunterPendingPlayerId,
            hunterReturnPhase: "NIGHT",
            phaseDeadline: isAuto ? buildPhaseDeadline("HUNTER_SHOT") : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const victory = evaluateVictory(
      updatedPlayers,
      state,
      room.turn_number,
      victims.map((v) => v.playerId)
    );
    if (victory.winnerCamp) {
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "VICTORY",
          game_state: {
            ...state,
            ...victory,
            elderShieldUsed: elderShieldTriggered,
            nightVictims: victims,
            lastAnnouncement: announcement,
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const nextTurn = room.turn_number + 1;
    const nextNight = resolveNextNightPhase("DAY_VOTE", updatedPlayers, nextTurn);
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextNight,
        turn_number: nextTurn,
        game_state: {
          ...state,
          elderShieldUsed: elderShieldTriggered,
          wolfTargetId: null,
          witchSaveTonight: false,
          witchKillTargetId: null,
          seerInspectedId: null,
          nightVictims: victims,
          lastAnnouncement: announcement,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextNight) : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "HUNTER_SHOT") {
    const victory = evaluateVictory(players, state, room.turn_number, []);
    if (victory.winnerCamp) {
      await supabase
        .from("rooms")
        .update({
          phase: "VICTORY",
          game_state: {
            ...state,
            ...victory,
            hunterPendingPlayerId: null,
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }

    if (state.hunterReturnPhase === "DAY_VOTE") {
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "DAY_VOTE",
          game_state: {
            ...state,
            hunterPendingPlayerId: null,
            hunterReturnPhase: null,
            phaseDeadline: isAuto ? buildPhaseDeadline("DAY_VOTE") : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const nextTurn = room.turn_number + 1;
    const nextNight = resolveNextNightPhase("DAY_VOTE", players, nextTurn);
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextNight,
        turn_number: nextTurn,
        game_state: {
          ...state,
          hunterPendingPlayerId: null,
          hunterReturnPhase: null,
          wolfTargetId: null,
          witchSaveTonight: false,
          witchKillTargetId: null,
          seerInspectedId: null,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextNight) : null,
        },
      })
      .eq("id", room.id);
  }
}

async function resolveNightAndEnterDay(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  state: RoomGameState
): Promise<void> {
  const supabase = createClient();
  const isAuto = room.narrator_mode === "auto";

  const initialDeaths: Array<{
    playerId: string;
    cause: "loups" | "sorciere";
  }> = [];

  if (state.wolfTargetId && !state.witchSaveTonight) {
    initialDeaths.push({ playerId: state.wolfTargetId, cause: "loups" });
  }
  if (state.witchKillTargetId) {
    initialDeaths.push({
      playerId: state.witchKillTargetId,
      cause: "sorciere",
    });
  }

  const { updatedPlayers, victims, hunterPendingPlayerId, elderShieldTriggered } =
    resolveDeathsWithCascade(players, state, initialDeaths);

  await Promise.all(
    victims.map((v) =>
      supabase
        .from("room_players")
        .update({ is_alive: false })
        .eq("id", v.playerId)
    )
  );

  const announcement =
    victims.length === 0
      ? "Miracle à l'aube : personne n'a péri cette nuit !"
      : `Cette nuit, le village a perdu : ${victims
          .map((v) => v.pseudo)
          .join(" et ")}.`;

  if (!hunterPendingPlayerId) {
    const victory = evaluateVictory(
      updatedPlayers,
      state,
      room.turn_number,
      victims.map((v) => v.playerId)
    );
    if (victory.winnerCamp) {
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "VICTORY",
          game_state: {
            ...state,
            ...victory,
            elderShieldUsed: elderShieldTriggered,
            nightVictims: victims,
            lastAnnouncement: announcement,
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }
  }

  await clearPlayerVotes(room.id);
  await supabase
    .from("rooms")
    .update({
      phase: "DAY_ANNOUNCEMENT",
      game_state: {
        ...state,
        elderShieldUsed: elderShieldTriggered,
        nightVictims: victims,
        lastAnnouncement: announcement,
        hunterPendingPlayerId,
        phaseDeadline: isAuto ? buildPhaseDeadline("DAY_ANNOUNCEMENT") : null,
      },
    })
    .eq("id", room.id);
}

export async function submitVoteTarget(
  playerId: string,
  targetPlayerId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({ has_voted: true, target_id: targetPlayerId })
    .eq("id", playerId);
}

export async function submitCupidonLovers(
  room: RoomRecord,
  loverIds: [string, string]
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        lovers: loverIds,
        cupidonTargets: loverIds,
      },
    })
    .eq("id", room.id);
}

export async function submitSeerInspection(
  room: RoomRecord,
  targetPlayerId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        seerInspectedId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitWitchDecision(
  room: RoomRecord,
  decision: { saveWolfVictim: boolean; killTargetId: string | null }
): Promise<void> {
  const supabase = createClient();
  const nextState: RoomGameState = {
    ...room.game_state,
    witchSaveTonight: decision.saveWolfVictim,
    witchLifeUsed: room.game_state.witchLifeUsed || decision.saveWolfVictim,
    witchKillTargetId: decision.killTargetId,
    witchDeathUsed:
      room.game_state.witchDeathUsed || Boolean(decision.killTargetId),
  };

  await supabase
    .from("rooms")
    .update({ game_state: nextState })
    .eq("id", room.id);
}

export async function submitHunterShotTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  targetPlayerId: string
): Promise<void> {
  const supabase = createClient();
  const state = room.game_state;
  const isAuto = room.narrator_mode === "auto";

  const { updatedPlayers, victims, elderShieldTriggered } =
    resolveDeathsWithCascade(players, state, [
      { playerId: targetPlayerId, cause: "chasseur" },
    ]);

  await Promise.all(
    victims.map((v) =>
      supabase
        .from("room_players")
        .update({ is_alive: false })
        .eq("id", v.playerId)
    )
  );

  const shotText = victims.length
    ? `Dans son dernier souffle, le Chasseur emporte ${victims
        .map((v) => v.pseudo)
        .join(" et ")} !`
    : "Le Chasseur tire dans la nuit.";

  const victory = evaluateVictory(
    updatedPlayers,
    state,
    room.turn_number,
    victims.map((v) => v.playerId)
  );
  if (victory.winnerCamp) {
    await supabase
      .from("rooms")
      .update({
        phase: "VICTORY",
        game_state: {
          ...state,
          ...victory,
          elderShieldUsed: elderShieldTriggered,
          hunterPendingPlayerId: null,
          hunterReturnPhase: null,
          lastAnnouncement: shotText,
          phaseDeadline: null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (state.hunterReturnPhase === "DAY_VOTE") {
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: "DAY_VOTE",
        game_state: {
          ...state,
          elderShieldUsed: elderShieldTriggered,
          hunterPendingPlayerId: null,
          hunterReturnPhase: null,
          lastAnnouncement: shotText,
          phaseDeadline: isAuto ? buildPhaseDeadline("DAY_VOTE") : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  const nextTurn = room.turn_number + 1;
  const nextNight = resolveNextNightPhase("DAY_VOTE", updatedPlayers, nextTurn);
  await clearPlayerVotes(room.id);
  await supabase
    .from("rooms")
    .update({
      phase: nextNight,
      turn_number: nextTurn,
      game_state: {
        ...state,
        elderShieldUsed: elderShieldTriggered,
        hunterPendingPlayerId: null,
        hunterReturnPhase: null,
        wolfTargetId: null,
        witchSaveTonight: false,
        witchKillTargetId: null,
        seerInspectedId: null,
        lastAnnouncement: shotText,
        phaseDeadline: isAuto ? buildPhaseDeadline(nextNight) : null,
      },
    })
    .eq("id", room.id);
}

export async function ownerTogglePlayerAlive(
  playerId: string,
  nextAlive: boolean
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({ is_alive: nextAlive })
    .eq("id", playerId);
}

export async function resetRoomToLobby(roomId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({
      role: null,
      is_alive: true,
      has_voted: false,
      target_id: null,
    })
    .eq("room_id", roomId);

  await supabase
    .from("rooms")
    .update({
      phase: "LOBBY",
      turn_number: 1,
      game_state: createInitialGameState(),
    })
    .eq("id", roomId);
}
