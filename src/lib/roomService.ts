import { buildLobbyPresetComposition } from "@/lib/balancer";
import {
  createClient,
  getSupabaseProjectRefPrefix,
} from "@/lib/supabase/client";
import {
  appendGameLog,
  buildPhaseDeadline,
  checkFoxTargets,
  createInitialGameState,
  dealRolesToPlayers,
  didBearGrowl,
  drawComedianMasks,
  drawThiefReserveRoles,
  encodeProfileAvatar,
  evaluateVictory,
  generateRoomCode,
  isBotPlayer,
  isEffectiveWolf,
  normalizeGameState,
  resolveDeathsWithCascade,
  resolveNextNightStep,
  tallyTargetFromVoters,
} from "@/lib/gameEngine";
import type {
  AvatarPresetId,
  GamePhase,
  NarratorMode,
  NightVictimEntry,
  PlayerProfile,
  PlayerReactionType,
  RoleComposition,
  RoomGameState,
  RoomPlayerRecord,
  RoomRecord,
  TtsVoiceName,
} from "@/types/game";

export {
  decodeAvatarToProfile,
  generateRoomCode,
  getAutoNarratorSpeech,
  getHumanNarratorScript,
  getPhaseLabel,
  isBotPlayer,
  isEffectiveWolf,
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
    game_state: normalizeGameState(rawState),
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
  const projectSuffix = ` [Projet: ${getSupabaseProjectRefPrefix()}]`;
  if (!error) return `${fallback}${projectSuffix}`;
  const msg = error.message || fallback;
  if (error.code === "42P01" || msg.includes("schema cache")) {
    return `${msg} — Exécutez supabase/schema.sql dans Supabase SQL Editor.${projectSuffix}`;
  }
  if (error.code === "42501" || msg.toLowerCase().includes("row-level security")) {
    return `Accès refusé (RLS) : ${msg}. Vérifiez les politiques dans supabase/schema.sql.${projectSuffix}`;
  }
  return `${msg}${projectSuffix}`;
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

  // Limite préventive à ~2,6 Mo (GIF/MP4/WebP) pour préserver la fluidité PostgREST
  const candidateAvatar =
    primaryAvatar.length > 2_600_000 ? fallbackAvatar : primaryAvatar;

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

  if (!existingPlayer) {
    const { count } = await withRequestTimeout(
      supabase
        .from("room_players")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
    );
    if ((count ?? 0) >= 30) {
      throw new Error("Ce salon est complet (30 joueurs maximum).");
    }
  }

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

export async function updateRoomLobbySettings(
  room: RoomRecord,
  patch: {
    dayDebateSeconds?: number | null;
    mayorEnabled?: boolean;
    primaryAudioUserId?: string | null;
    ttsVoice?: TtsVoiceName;
  }
): Promise<void> {
  const supabase = createClient();
  const current = normalizeGameState(room.game_state);
  const nextState: RoomGameState = {
    ...current,
    ...(patch.dayDebateSeconds !== undefined
      ? { dayDebateSeconds: patch.dayDebateSeconds }
      : {}),
    ...(patch.mayorEnabled !== undefined
      ? { mayorEnabled: patch.mayorEnabled }
      : {}),
    ...(patch.primaryAudioUserId !== undefined
      ? { primaryAudioUserId: patch.primaryAudioUserId }
      : {}),
    ...(patch.ttsVoice !== undefined ? { ttsVoice: patch.ttsVoice } : {}),
  };

  await supabase
    .from("rooms")
    .update({ game_state: nextState })
    .eq("id", room.id);
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
  const existingSettings = normalizeGameState(room.game_state);

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

  const hasVoleur = assignments.some((a) => a.roleId === "voleur");
  const hasComedian = assignments.some((a) => a.roleId === "comedien");

  const nextState: RoomGameState = {
    ...createInitialGameState(),
    dayDebateSeconds: existingSettings.dayDebateSeconds,
    mayorEnabled: existingSettings.mayorEnabled,
    primaryAudioUserId: existingSettings.primaryAudioUserId,
    ttsVoice: existingSettings.ttsVoice,
    thiefOptions: hasVoleur ? drawThiefReserveRoles() : null,
    comedianMasks: hasComedian ? drawComedianMasks() : [],
    eventLog: appendGameLog([], {
      turn: 1,
      phase: "system",
      text: "La partie commence sous la Lune de Sang.",
    }),
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

function resolveMayorOnDeaths(
  state: RoomGameState,
  updatedPlayers: RoomPlayerRecord[],
  victims: NightVictimEntry[]
): Pick<RoomGameState, "mayorPlayerId" | "mayorPendingSuccessorFromId"> {
  if (!state.mayorPlayerId) {
    return {
      mayorPlayerId: null,
      mayorPendingSuccessorFromId: state.mayorPendingSuccessorFromId,
    };
  }
  const mayorDied = victims.some((v) => v.playerId === state.mayorPlayerId);
  if (!mayorDied) {
    return {
      mayorPlayerId: state.mayorPlayerId,
      mayorPendingSuccessorFromId: state.mayorPendingSuccessorFromId,
    };
  }

  const aliveLeft = updatedPlayers.filter((p) => p.is_alive);
  if (aliveLeft.length < 2) {
    return {
      mayorPlayerId: null,
      mayorPendingSuccessorFromId: null,
    };
  }

  return {
    mayorPlayerId: null,
    mayorPendingSuccessorFromId: state.mayorPlayerId,
  };
}

function autoAssignFallbackMayorIfPending(
  state: RoomGameState,
  players: RoomPlayerRecord[]
): RoomGameState {
  if (!state.mayorPendingSuccessorFromId) return state;
  const fallback = players.find((p) => p.is_alive) ?? null;
  if (!fallback) {
    return { ...state, mayorPendingSuccessorFromId: null };
  }
  return {
    ...state,
    mayorPlayerId: fallback.id,
    mayorPendingSuccessorFromId: null,
    eventLog: appendGameLog(state.eventLog, {
      turn: 1,
      phase: "day",
      text: `${fallback.pseudo} reçoit l'écharpe de Maire par intérim.`,
    }),
  };
}

function resetNightTransientState(state: RoomGameState): RoomGameState {
  return {
    ...state,
    wolfTargetId: null,
    witchSaveTonight: false,
    witchKillTargetId: null,
    seerInspectedId: null,
    readyUserIds: [],
    salvateurTargetId: null,
    salvateurSavedTonight: false,
    foxCheckedTonight: false,
    foxLastResult: null,
    corbeauTargetId: null,
    infectTonight: false,
    grandMechantSecondTargetId: null,
    piperTargetsTonight: [],
    loupBlancTargetId: null,
    bearGrowledTonight: false,
    elderShieldTriggeredTonight: false,
    mystiqueInspectedId: null,
    pyromaneActedTonight: false,
    pyromaneIgnitedTonight: false,
    comedianActedTonight: false,
    comedianPeekedPlayerId: null,
    stutteringJudgeArmed: false,
    voteMode: "ELIMINATION",
    nightStep: null,
  };
}

async function triggerStutteringJudgeSecondVote(
  roomId: string,
  turnNumber: number,
  state: RoomGameState,
  prefixAnnouncement: string,
  isAuto: boolean
): Promise<void> {
  const supabase = createClient();
  const judgeText = `${prefixAnnouncement} Coup de marteau du Juge Bègue : un second vote d'élimination s'ouvre immédiatement !`;
  const nextVoteState: RoomGameState = {
    ...state,
    voteMode: "ELIMINATION",
    stutteringJudgeUsed: true,
    stutteringJudgeArmed: false,
    lastAnnouncement: judgeText,
    eventLog: appendGameLog(state.eventLog, {
      turn: turnNumber,
      phase: "day",
      text: `Jour ${turnNumber} : ${judgeText}`,
    }),
  };
  await clearPlayerVotes(roomId);
  await supabase
    .from("rooms")
    .update({
      phase: "DAY_VOTE",
      game_state: {
        ...nextVoteState,
        phaseDeadline: isAuto
          ? buildPhaseDeadline("DAY_VOTE", null, nextVoteState)
          : null,
      },
    })
    .eq("id", roomId);
}

function assertAliveTarget(
  players: RoomPlayerRecord[],
  actorId: string,
  targetId: string,
  options?: { allowSelf?: boolean }
): { actor: RoomPlayerRecord; target: RoomPlayerRecord } {
  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.is_alive) {
    throw new Error("Un joueur éliminé ne peut pas utiliser de pouvoir.");
  }

  const target = players.find((p) => p.id === targetId);
  if (!target || !target.is_alive) {
    throw new Error("Impossible de cibler un joueur déjà éliminé.");
  }

  if (!options?.allowSelf && actor.id === target.id) {
    throw new Error("Vous ne pouvez pas vous cibler vous-même.");
  }

  return { actor, target };
}

async function clearPlayerVotes(roomId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({ has_voted: false, target_id: null })
    .eq("room_id", roomId);
}

/**
 * Fait avancer la machine à états vers la phase (ou sous-étape de nuit) suivante.
 */
export async function advanceRoomPhase(
  room: RoomRecord,
  players: RoomPlayerRecord[]
): Promise<void> {
  const supabase = createClient();
  const state = normalizeGameState(room.game_state);
  const isAuto = room.narrator_mode === "auto";

  if (room.phase === "ROLE_REVEAL") {
    const cleaned = resetNightTransientState(state);
    const nextStepInfo = resolveNextNightStep(
      "ROLE_REVEAL",
      null,
      players,
      cleaned,
      room.turn_number
    );
    await clearPlayerVotes(room.id);

    if (!nextStepInfo) {
      await resolveNightAndEnterDay(room, players, cleaned);
      return;
    }

    await supabase
      .from("rooms")
      .update({
        phase: nextStepInfo.phase,
        game_state: {
          ...cleaned,
          nightStep: nextStepInfo.nightStep,
          phaseDeadline: isAuto
            ? buildPhaseDeadline(nextStepInfo.phase, nextStepInfo.nightStep)
            : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase.startsWith("NIGHT_")) {
    let workingState: RoomGameState = { ...state };

    if (
      workingState.nightStep === "loups" ||
      (!workingState.nightStep && room.phase === "NIGHT_WEREWOLVES")
    ) {
      const wolfVoters = players.filter(
        (p) => p.is_alive && isEffectiveWolf(p, workingState)
      );
      const { targetId } = tallyTargetFromVoters(wolfVoters);
      const validTarget = players.find(
        (p) => p.id === targetId && p.is_alive
      );
      workingState = {
        ...workingState,
        wolfTargetId: validTarget ? validTarget.id : null,
        infectTonight:
          Boolean(workingState.infectTonight) && Boolean(validTarget),
      };
    }

    const nextStepInfo = resolveNextNightStep(
      room.phase,
      workingState.nightStep,
      players,
      workingState,
      room.turn_number
    );

    if (!nextStepInfo) {
      await resolveNightAndEnterDay(room, players, workingState);
      return;
    }

    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: nextStepInfo.phase,
        game_state: {
          ...workingState,
          nightStep: nextStepInfo.nightStep,
          readyUserIds: [],
          phaseDeadline: isAuto
            ? buildPhaseDeadline(nextStepInfo.phase, nextStepInfo.nightStep)
            : null,
        },
      })
      .eq("id", room.id);
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
            eventLog: appendGameLog(state.eventLog, {
              turn: room.turn_number,
              phase: "system",
              text: `${victory.winnerTitle ?? "Fin de partie"} !`,
            }),
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const aliveCount = players.filter((p) => p.is_alive).length;
    const shouldElectMayor =
      room.turn_number === 1 &&
      state.mayorEnabled &&
      !state.mayorPlayerId &&
      !state.mayorElectionDone &&
      aliveCount >= 3;
    const resolvedState = autoAssignFallbackMayorIfPending(state, players);
    const nextVoteState: RoomGameState = {
      ...resolvedState,
      voteMode: shouldElectMayor ? "MAYOR_ELECTION" : "ELIMINATION",
    };

    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: "DAY_VOTE",
        game_state: {
          ...nextVoteState,
          phaseDeadline: isAuto
            ? buildPhaseDeadline("DAY_VOTE", null, nextVoteState)
            : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (room.phase === "DAY_VOTE") {
    if (state.voteMode === "MAYOR_ELECTION") {
      const aliveVoters = players.filter((p) => p.is_alive);
      const { targetId, isTie, counts } = tallyTargetFromVoters(
        aliveVoters,
        null,
        0,
        null
      );

      let electedId = targetId;
      if (!electedId && isTie) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        electedId = sorted[0]?.[0] ?? null;
      }

      const electedPlayer = electedId
        ? players.find((p) => p.id === electedId && p.is_alive) ?? null
        : null;
      const announcement = electedPlayer
        ? `${electedPlayer.pseudo} est élu Maire du village (voix double) ! Place au conseil d'élimination.`
        : "Aucun Maire n'a été désigné. Le conseil du village peut débattre et voter.";

      const nextVoteState: RoomGameState = {
        ...state,
        mayorPlayerId: electedPlayer?.id ?? null,
        mayorElectionDone: true,
        voteMode: "ELIMINATION",
        lastAnnouncement: announcement,
        eventLog: appendGameLog(state.eventLog, {
          turn: room.turn_number,
          phase: "day",
          text: `Jour ${room.turn_number} : ${announcement}`,
        }),
      };

      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "DAY_VOTE",
          game_state: {
            ...nextVoteState,
            phaseDeadline: isAuto
              ? buildPhaseDeadline("DAY_VOTE", null, nextVoteState)
              : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const activeState = autoAssignFallbackMayorIfPending(state, players);
    const aliveVoters = players.filter(
      (p) => p.is_alive && !activeState.idiotSparedPlayerIds.includes(p.id)
    );
    const activeCorbeauTarget =
      activeState.corbeauTargetId &&
      players.some(
        (p) => p.id === activeState.corbeauTargetId && p.is_alive
      )
        ? activeState.corbeauTargetId
        : null;

    const { targetId, isTie } = tallyTargetFromVoters(
      aliveVoters,
      activeCorbeauTarget,
      2,
      activeState.mayorPlayerId
    );

    if (!targetId) {
      const announcement = isTie
        ? "Égalité lors du vote : personne n'a été exécuté aujourd'hui."
        : "Aucun vote exprimé : le village garde le silence.";

      if (activeState.stutteringJudgeArmed && !activeState.stutteringJudgeUsed) {
        await triggerStutteringJudgeSecondVote(
          room.id,
          room.turn_number,
          activeState,
          announcement,
          isAuto
        );
        return;
      }

      const nextTurn = room.turn_number + 1;
      const baseNextState: RoomGameState = {
        ...resetNightTransientState(activeState),
        nightVictims: [],
        lastAnnouncement: announcement,
        eventLog: appendGameLog(activeState.eventLog, {
          turn: room.turn_number,
          phase: "day",
          text: `Jour ${room.turn_number} : ${announcement}`,
        }),
      };

      const nextStepInfo = resolveNextNightStep(
        "DAY_VOTE",
        null,
        players,
        baseNextState,
        nextTurn
      );
      await clearPlayerVotes(room.id);

      if (!nextStepInfo) {
        await resolveNightAndEnterDay(
          { ...room, turn_number: nextTurn },
          players,
          baseNextState
        );
        return;
      }

      await supabase
        .from("rooms")
        .update({
          phase: nextStepInfo.phase,
          turn_number: nextTurn,
          game_state: {
            ...baseNextState,
            nightStep: nextStepInfo.nightStep,
            phaseDeadline: isAuto
              ? buildPhaseDeadline(nextStepInfo.phase, nextStepInfo.nightStep)
              : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const votedTarget = players.find((p) => p.id === targetId && p.is_alive);
    if (
      votedTarget?.role === "idiot-du-village" &&
      !activeState.idiotSparedPlayerIds.includes(votedTarget.id)
    ) {
      const announcement = `${votedTarget.pseudo} est l'Idiot du Village ! Le hameau l'épargne (droit de vote retiré).`;
      const sparedState: RoomGameState = {
        ...activeState,
        idiotSparedPlayerIds: [
          ...activeState.idiotSparedPlayerIds,
          votedTarget.id,
        ],
      };

      if (sparedState.stutteringJudgeArmed && !sparedState.stutteringJudgeUsed) {
        await triggerStutteringJudgeSecondVote(
          room.id,
          room.turn_number,
          sparedState,
          announcement,
          isAuto
        );
        return;
      }

      const nextTurn = room.turn_number + 1;
      const baseNextState: RoomGameState = {
        ...resetNightTransientState(sparedState),
        nightVictims: [],
        lastAnnouncement: announcement,
        eventLog: appendGameLog(sparedState.eventLog, {
          turn: room.turn_number,
          phase: "day",
          text: `Jour ${room.turn_number} : ${votedTarget.pseudo} a été épargné par le conseil.`,
        }),
      };

      const nextStepInfo = resolveNextNightStep(
        "DAY_VOTE",
        null,
        players,
        baseNextState,
        nextTurn
      );
      await clearPlayerVotes(room.id);
      const targetPhase = nextStepInfo?.phase ?? "DAY_ANNOUNCEMENT";
      const targetStep = nextStepInfo?.nightStep ?? null;

      await supabase
        .from("rooms")
        .update({
          phase: targetPhase,
          turn_number: nextTurn,
          game_state: {
            ...baseNextState,
            nightStep: targetStep,
            phaseDeadline: isAuto
              ? buildPhaseDeadline(targetPhase, targetStep)
              : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const {
      updatedPlayers,
      victims,
      hunterPendingPlayerId,
      elderShieldUsedNext,
      wildChildTransformedNow,
    } = resolveDeathsWithCascade(players, activeState, [
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
    const mayorAfterDeaths = resolveMayorOnDeaths(
      activeState,
      updatedPlayers,
      victims
    );

    const stateAfterVote: RoomGameState = {
      ...activeState,
      ...mayorAfterDeaths,
      elderShieldUsed: elderShieldUsedNext,
      wildChildTransformed:
        activeState.wildChildTransformed || wildChildTransformedNow,
      nightVictims: victims,
      lastAnnouncement: announcement,
      eventLog: appendGameLog(activeState.eventLog, {
        turn: room.turn_number,
        phase: "day",
        text: `Jour ${room.turn_number} : ${announcement}`,
      }),
    };

    if (hunterPendingPlayerId) {
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "HUNTER_SHOT",
          game_state: {
            ...stateAfterVote,
            hunterPendingPlayerId,
            hunterReturnPhase:
              stateAfterVote.stutteringJudgeArmed &&
              !stateAfterVote.stutteringJudgeUsed
                ? "DAY_VOTE"
                : "NIGHT",
            phaseDeadline: isAuto ? buildPhaseDeadline("HUNTER_SHOT") : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const victory = evaluateVictory(
      updatedPlayers,
      stateAfterVote,
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
            ...stateAfterVote,
            ...victory,
            mayorPendingSuccessorFromId: null,
            eventLog: appendGameLog(stateAfterVote.eventLog, {
              turn: room.turn_number,
              phase: "system",
              text: `${victory.winnerTitle ?? "Fin de partie"} !`,
            }),
            phaseDeadline: null,
          },
        })
        .eq("id", room.id);
      return;
    }

    if (
      stateAfterVote.stutteringJudgeArmed &&
      !stateAfterVote.stutteringJudgeUsed
    ) {
      await triggerStutteringJudgeSecondVote(
        room.id,
        room.turn_number,
        stateAfterVote,
        announcement,
        isAuto
      );
      return;
    }

    const nextTurn = room.turn_number + 1;
    const cleanedNext = resetNightTransientState(stateAfterVote);
    const nextStepInfo = resolveNextNightStep(
      "DAY_VOTE",
      null,
      updatedPlayers,
      cleanedNext,
      nextTurn
    );
    await clearPlayerVotes(room.id);
    const nextPhase = nextStepInfo?.phase ?? "DAY_ANNOUNCEMENT";
    const nextStep = nextStepInfo?.nightStep ?? null;

    await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        turn_number: nextTurn,
        game_state: {
          ...cleanedNext,
          nightStep: nextStep,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase, nextStep) : null,
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
      const aliveCount = players.filter((p) => p.is_alive).length;
      const shouldElectMayor =
        room.turn_number === 1 &&
        state.mayorEnabled &&
        !state.mayorPlayerId &&
        !state.mayorElectionDone &&
        aliveCount >= 3;
      const nextVoteState: RoomGameState = {
        ...state,
        hunterPendingPlayerId: null,
        hunterReturnPhase: null,
        voteMode: shouldElectMayor ? "MAYOR_ELECTION" : "ELIMINATION",
      };
      await clearPlayerVotes(room.id);
      await supabase
        .from("rooms")
        .update({
          phase: "DAY_VOTE",
          game_state: {
            ...nextVoteState,
            phaseDeadline: isAuto
              ? buildPhaseDeadline("DAY_VOTE", null, nextVoteState)
              : null,
          },
        })
        .eq("id", room.id);
      return;
    }

    const nextTurn = room.turn_number + 1;
    const cleanedNext = {
      ...resetNightTransientState(state),
      hunterPendingPlayerId: null,
      hunterReturnPhase: null,
    };
    const nextStepInfo = resolveNextNightStep(
      "DAY_VOTE",
      null,
      players,
      cleanedNext,
      nextTurn
    );
    await clearPlayerVotes(room.id);
    const nextPhase = nextStepInfo?.phase ?? "DAY_ANNOUNCEMENT";
    const nextStep = nextStepInfo?.nightStep ?? null;

    await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        turn_number: nextTurn,
        game_state: {
          ...cleanedNext,
          nightStep: nextStep,
          phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase, nextStep) : null,
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
    cause: NightVictimEntry["cause"];
  }> = [];

  let salvateurSavedTonight = false;
  let infectUsedNext = state.infectUsed;
  const infectedPlayerIdsNext = [...state.infectedPlayerIds];

  // Tétanos du Chevalier à l'Épée Rouillée contracté lors de la nuit précédente
  if (state.rustyKnightPendingWolfId) {
    const pendingWolf = players.find(
      (p) => p.id === state.rustyKnightPendingWolfId && p.is_alive
    );
    if (pendingWolf) {
      initialDeaths.push({ playerId: pendingWolf.id, cause: "tetanos" });
    }
  }

  // Attaque principale de la meute (ou conversion de l'Infect Père des Loups)
  if (state.wolfTargetId) {
    const wolfVictim = players.find(
      (p) => p.id === state.wolfTargetId && p.is_alive
    );
    if (wolfVictim) {
      if (state.salvateurTargetId === wolfVictim.id) {
        salvateurSavedTonight = true;
      } else if (state.witchSaveTonight) {
        // Sauvé par la potion de vie
      } else if (
        state.infectTonight &&
        !state.infectUsed &&
        !isEffectiveWolf(wolfVictim, state)
      ) {
        infectUsedNext = true;
        if (!infectedPlayerIdsNext.includes(wolfVictim.id)) {
          infectedPlayerIdsNext.push(wolfVictim.id);
        }
      } else {
        initialDeaths.push({ playerId: wolfVictim.id, cause: "loups" });
      }
    }
  }

  // Trahison du Loup-Garou Blanc
  if (state.loupBlancTargetId) {
    const whiteVictim = players.find(
      (p) => p.id === state.loupBlancTargetId && p.is_alive
    );
    if (whiteVictim) {
      if (state.salvateurTargetId === whiteVictim.id) {
        salvateurSavedTonight = true;
      } else {
        initialDeaths.push({ playerId: whiteVictim.id, cause: "loups" });
      }
    }
  }

  // Deuxième proie du Grand Méchant Loup
  if (
    state.grandMechantSecondTargetId &&
    state.grandMechantSecondTargetId !== state.wolfTargetId &&
    state.grandMechantSecondTargetId !== state.loupBlancTargetId
  ) {
    const secondVictim = players.find(
      (p) => p.id === state.grandMechantSecondTargetId && p.is_alive
    );
    if (secondVictim) {
      if (state.salvateurTargetId === secondVictim.id) {
        salvateurSavedTonight = true;
      } else {
        initialDeaths.push({ playerId: secondVictim.id, cause: "loups" });
      }
    }
  }

  // Potion de mort de la Sorcière (contourne le Salvateur)
  if (state.witchKillTargetId) {
    const poisonVictim = players.find(
      (p) => p.id === state.witchKillTargetId && p.is_alive
    );
    if (poisonVictim) {
      initialDeaths.push({ playerId: poisonVictim.id, cause: "sorciere" });
    }
  }

  // Embrasement du Pyromane (brûle toutes les cibles encore vivantes marquées d'huile)
  if (state.pyromaneIgnitedTonight && state.oiledPlayerIds.length > 0) {
    for (const oiledId of state.oiledPlayerIds) {
      const target = players.find((p) => p.id === oiledId && p.is_alive);
      if (target) {
        initialDeaths.push({ playerId: target.id, cause: "pyromane" });
      }
    }
  }

  const {
    updatedPlayers,
    victims,
    hunterPendingPlayerId,
    elderShieldTriggered,
    elderShieldUsedNext,
    rustyKnightPendingWolfIdNext,
    wildChildTransformedNow,
  } = resolveDeathsWithCascade(players, state, initialDeaths);

  await Promise.all(
    victims.map((v) =>
      supabase
        .from("room_players")
        .update({ is_alive: false })
        .eq("id", v.playerId)
    )
  );

  const postNightBaseState: RoomGameState = {
    ...state,
    nightStep: null,
    salvateurLastTargetId: state.salvateurTargetId,
    salvateurTargetId: null,
    salvateurSavedTonight,
    elderShieldUsed: elderShieldUsedNext,
    elderShieldTriggeredTonight: elderShieldTriggered,
    rustyKnightPendingWolfId: rustyKnightPendingWolfIdNext,
    infectUsed: infectUsedNext,
    infectedPlayerIds: infectedPlayerIdsNext,
    wildChildTransformed: state.wildChildTransformed || wildChildTransformedNow,
    oiledPlayerIds: state.pyromaneIgnitedTonight
      ? []
      : state.oiledPlayerIds.filter((id) =>
          updatedPlayers.some((p) => p.id === id && p.is_alive)
        ),
    corbeauTargetId:
      state.corbeauTargetId &&
      updatedPlayers.some((p) => p.id === state.corbeauTargetId && p.is_alive)
        ? state.corbeauTargetId
        : null,
  };

  const bearGrowledTonight = didBearGrowl(updatedPlayers, postNightBaseState);
  const corbeauTarget = postNightBaseState.corbeauTargetId
    ? updatedPlayers.find((p) => p.id === postNightBaseState.corbeauTargetId)
    : null;

  let announcement: string;
  if (victims.length === 0) {
    if (elderShieldTriggered || salvateurSavedTonight || state.witchSaveTonight) {
      announcement =
        "Grâce à une intervention dans l'ombre, personne n'a péri cette nuit !";
    } else {
      announcement = "Miracle à l'aube : personne n'a péri cette nuit !";
    }
  } else {
    announcement = `Cette nuit, le village a perdu : ${victims
      .map((v) => v.pseudo)
      .join(" et ")}.`;
  }

  if (bearGrowledTonight) {
    announcement += " L'ours grogne sourdement au réveil du village !";
  }
  if (corbeauTarget) {
    announcement += ` Une plume du Corbeau désigne ${corbeauTarget.pseudo} (+2 voix).`;
  }

  let nextLog = appendGameLog(postNightBaseState.eventLog, {
    turn: room.turn_number,
    phase: "night",
    text:
      victims.length === 0
        ? `Nuit ${room.turn_number} : Aucune victime au lever du jour.`
        : `Nuit ${room.turn_number} : ${victims
            .map((v) => v.pseudo)
            .join(" et ")} ${victims.length > 1 ? "ont péri" : "a péri"}.`,
  });

  if (bearGrowledTonight) {
    nextLog = appendGameLog(nextLog, {
      turn: room.turn_number,
      phase: "day",
      text: "Aube : Un grognement d'ours retentit dans le village.",
    });
  }

  if (corbeauTarget) {
    nextLog = appendGameLog(nextLog, {
      turn: room.turn_number,
      phase: "day",
      text: `Aube : ${corbeauTarget.pseudo} porte la marque du Corbeau (+2 voix).`,
    });
  }

  const mayorAfterDeaths = resolveMayorOnDeaths(
    postNightBaseState,
    updatedPlayers,
    victims
  );

  const finalState: RoomGameState = {
    ...postNightBaseState,
    ...mayorAfterDeaths,
    bearGrowledTonight,
    nightVictims: victims,
    lastAnnouncement: announcement,
    eventLog: nextLog,
  };

  if (!hunterPendingPlayerId) {
    const victory = evaluateVictory(
      updatedPlayers,
      finalState,
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
            ...finalState,
            ...victory,
            eventLog: appendGameLog(finalState.eventLog, {
              turn: room.turn_number,
              phase: "system",
              text: `${victory.winnerTitle ?? "Fin de partie"} !`,
            }),
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
        ...finalState,
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
  if (playerId === targetPlayerId) {
    throw new Error("Vous ne pouvez pas voter pour vous-même.");
  }

  const supabase = createClient();
  const { data: rows } = await supabase
    .from("room_players")
    .select("id, is_alive")
    .in("id", [playerId, targetPlayerId]);

  const actor = rows?.find((r) => r.id === playerId);
  const target = rows?.find((r) => r.id === targetPlayerId);
  if (!actor || !actor.is_alive) {
    throw new Error("Un joueur éliminé ne peut pas voter.");
  }
  if (!target || !target.is_alive) {
    throw new Error("Impossible de voter pour un joueur déjà éliminé.");
  }

  await supabase
    .from("room_players")
    .update({ has_voted: true, target_id: targetPlayerId })
    .eq("id", playerId);
}

export async function markPlayerReady(
  room: RoomRecord,
  userId: string
): Promise<void> {
  const state = normalizeGameState(room.game_state);
  if (state.readyUserIds.includes(userId)) return;

  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...state,
        readyUserIds: [...state.readyUserIds, userId],
      },
    })
    .eq("id", room.id);
}

export async function submitCupidonLovers(
  room: RoomRecord,
  loverIds: [string, string],
  players?: RoomPlayerRecord[],
  actorId?: string
): Promise<void> {
  if (loverIds[0] === loverIds[1]) {
    throw new Error("Sélectionnez deux joueurs distincts.");
  }
  if (actorId && (loverIds[0] === actorId || loverIds[1] === actorId)) {
    throw new Error("Cupidon ne peut pas se désigner lui-même.");
  }
  if (players) {
    const valid = loverIds.every((id) =>
      players.some((p) => p.id === id && p.is_alive)
    );
    if (!valid) {
      throw new Error("Les deux amoureux doivent être vivants.");
    }
  }

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

export async function submitWildChildModel(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetPlayerId: string
): Promise<void> {
  assertAliveTarget(players, actorId, targetPlayerId, { allowSelf: false });
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        wildChildModelId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitSalvateurTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetPlayerId: string
): Promise<void> {
  assertAliveTarget(players, actorId, targetPlayerId, { allowSelf: true });
  if (room.game_state.salvateurLastTargetId === targetPlayerId) {
    throw new Error(
      "Le Salvateur ne peut pas protéger la même personne deux nuits de suite."
    );
  }

  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        salvateurTargetId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitSeerInspection(
  room: RoomRecord,
  targetPlayerId: string,
  players?: RoomPlayerRecord[],
  actorId?: string
): Promise<void> {
  if (actorId && targetPlayerId === actorId) {
    throw new Error("Vous ne pouvez pas vous sonder vous-même.");
  }
  if (players && !players.some((p) => p.id === targetPlayerId && p.is_alive)) {
    throw new Error("Impossible d'inspecter un joueur éliminé.");
  }

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

export async function submitRenardTargets(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  centerPlayerId: string
): Promise<void> {
  if (room.game_state.foxUsedWrongly) {
    throw new Error("Le Renard a déjà perdu son flair.");
  }
  assertAliveTarget(players, actorId, centerPlayerId, { allowSelf: false });

  const result = checkFoxTargets(players, centerPlayerId, room.game_state);
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        foxCheckedTonight: true,
        foxUsedWrongly: !result.hasWolf,
        foxLastResult: {
          names: result.names,
          hasWolf: result.hasWolf,
        },
      },
    })
    .eq("id", room.id);
}

export async function submitWolfInfectToggle(
  room: RoomRecord,
  infect: boolean
): Promise<void> {
  if (infect && room.game_state.infectUsed) {
    throw new Error("L'infection de l'Infect Père a déjà été utilisée.");
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        infectTonight: infect,
      },
    })
    .eq("id", room.id);
}

export async function submitLoupBlancTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetPlayerId: string | null
): Promise<void> {
  if (targetPlayerId) {
    const { target } = assertAliveTarget(players, actorId, targetPlayerId, {
      allowSelf: false,
    });
    if (!isEffectiveWolf(target, room.game_state)) {
      throw new Error(
        "Le Loup-Garou Blanc ne peut éliminer qu'un autre Loup-Garou."
      );
    }
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        loupBlancTargetId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitGrandMechantTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetPlayerId: string | null
): Promise<void> {
  if (targetPlayerId) {
    assertAliveTarget(players, actorId, targetPlayerId, { allowSelf: false });
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        grandMechantSecondTargetId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitWitchDecision(
  room: RoomRecord,
  decision: { saveWolfVictim: boolean; killTargetId: string | null },
  players?: RoomPlayerRecord[],
  actorId?: string
): Promise<void> {
  if (decision.killTargetId) {
    if (actorId && decision.killTargetId === actorId) {
      throw new Error("La Sorcière ne peut pas s'empoisonner elle-même.");
    }
    if (
      players &&
      !players.some((p) => p.id === decision.killTargetId && p.is_alive)
    ) {
      throw new Error("Impossible d'empoisonner un joueur déjà éliminé.");
    }
  }

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

export async function submitCorbeauTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetPlayerId: string
): Promise<void> {
  assertAliveTarget(players, actorId, targetPlayerId, { allowSelf: false });
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        corbeauTargetId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitPiperTargets(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(targetIds)).slice(0, 2);
  if (unique.length === 0) {
    throw new Error("Choisissez au moins un joueur à charmer.");
  }

  for (const id of unique) {
    assertAliveTarget(players, actorId, id, { allowSelf: false });
  }

  const nextCharmed = Array.from(
    new Set([...room.game_state.charmedPlayerIds, ...unique])
  );
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        charmedPlayerIds: nextCharmed,
        piperTargetsTonight: unique,
      },
    })
    .eq("id", room.id);
}

export async function submitServanteClaim(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  victimPlayerId: string
): Promise<void> {
  const actor = players.find((p) => p.id === actorId && p.is_alive);
  if (!actor || actor.role !== "servante-devouee") {
    throw new Error("Seule la Servante Dévouée vivante peut agir ainsi.");
  }
  if (room.game_state.servanteUsed) {
    throw new Error("Vous avez déjà endossé un rôle dans cette partie.");
  }

  const victim = players.find((p) => p.id === victimPlayerId && !p.is_alive);
  if (!victim || !victim.role) {
    throw new Error("Ce rôle ne peut pas être repris.");
  }

  const supabase = createClient();
  await supabase
    .from("room_players")
    .update({ role: victim.role })
    .eq("id", actor.id);

  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        servanteUsed: true,
        eventLog: appendGameLog(room.game_state.eventLog, {
          turn: room.turn_number,
          phase: "day",
          text: `${actor.pseudo} semble habitée par un nouveau destin...`,
        }),
      },
    })
    .eq("id", room.id);
}

export async function submitPlayerReaction(
  room: RoomRecord,
  playerId: string,
  reaction: PlayerReactionType
): Promise<void> {
  const supabase = createClient();
  const nextReactions = {
    ...room.game_state.reactions,
    [playerId]: {
      playerId,
      reaction,
      sentAt: Date.now(),
    },
  };

  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        reactions: nextReactions,
      },
    })
    .eq("id", room.id);
}

export async function submitHunterShotTarget(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  targetPlayerId: string
): Promise<void> {
  const state = normalizeGameState(room.game_state);
  const hunterId = state.hunterPendingPlayerId;
  if (hunterId && targetPlayerId === hunterId) {
    throw new Error("Le Chasseur ne peut pas se tirer dessus.");
  }
  const target = players.find((p) => p.id === targetPlayerId && p.is_alive);
  if (!target) {
    throw new Error("Impossible de viser un joueur déjà éliminé.");
  }

  const supabase = createClient();
  const isAuto = room.narrator_mode === "auto";

  const {
    updatedPlayers,
    victims,
    elderShieldUsedNext,
    wildChildTransformedNow,
  } = resolveDeathsWithCascade(players, state, [
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

  const mayorAfterDeaths = resolveMayorOnDeaths(state, updatedPlayers, victims);

  const stateAfterShot: RoomGameState = {
    ...state,
    ...mayorAfterDeaths,
    elderShieldUsed: elderShieldUsedNext,
    wildChildTransformed:
      state.wildChildTransformed || wildChildTransformedNow,
    hunterPendingPlayerId: null,
    hunterReturnPhase: null,
    lastAnnouncement: shotText,
    eventLog: appendGameLog(state.eventLog, {
      turn: room.turn_number,
      phase: "day",
      text: shotText,
    }),
  };

  const victory = evaluateVictory(
    updatedPlayers,
    stateAfterShot,
    room.turn_number,
    victims.map((v) => v.playerId)
  );
  if (victory.winnerCamp) {
    await supabase
      .from("rooms")
      .update({
        phase: "VICTORY",
        game_state: {
          ...stateAfterShot,
          ...victory,
          mayorPendingSuccessorFromId: null,
          phaseDeadline: null,
        },
      })
      .eq("id", room.id);
    return;
  }

  if (state.hunterReturnPhase === "DAY_VOTE") {
    const aliveCount = updatedPlayers.filter((p) => p.is_alive).length;
    const isJudgeSecondVote =
      stateAfterShot.stutteringJudgeArmed && !stateAfterShot.stutteringJudgeUsed;
    const shouldElectMayor =
      !isJudgeSecondVote &&
      room.turn_number === 1 &&
      stateAfterShot.mayorEnabled &&
      !stateAfterShot.mayorPlayerId &&
      !stateAfterShot.mayorElectionDone &&
      aliveCount >= 3;
    const nextVoteState: RoomGameState = {
      ...stateAfterShot,
      voteMode: shouldElectMayor ? "MAYOR_ELECTION" : "ELIMINATION",
      ...(isJudgeSecondVote
        ? {
            stutteringJudgeUsed: true,
            stutteringJudgeArmed: false,
            lastAnnouncement: `${shotText} Coup de marteau du Juge Bègue : un second vote d'élimination s'ouvre immédiatement !`,
          }
        : {}),
    };
    await clearPlayerVotes(room.id);
    await supabase
      .from("rooms")
      .update({
        phase: "DAY_VOTE",
        game_state: {
          ...nextVoteState,
          phaseDeadline: isAuto
            ? buildPhaseDeadline("DAY_VOTE", null, nextVoteState)
            : null,
        },
      })
      .eq("id", room.id);
    return;
  }

  const nextTurn = room.turn_number + 1;
  const cleanedNext = resetNightTransientState(stateAfterShot);
  const nextStepInfo = resolveNextNightStep(
    "DAY_VOTE",
    null,
    updatedPlayers,
    cleanedNext,
    nextTurn
  );
  await clearPlayerVotes(room.id);
  const nextPhase = nextStepInfo?.phase ?? "DAY_ANNOUNCEMENT";
  const nextStep = nextStepInfo?.nightStep ?? null;

  await supabase
    .from("rooms")
    .update({
      phase: nextPhase,
      turn_number: nextTurn,
      game_state: {
        ...cleanedNext,
        nightStep: nextStep,
        phaseDeadline: isAuto ? buildPhaseDeadline(nextPhase, nextStep) : null,
      },
    })
    .eq("id", room.id);
}

export async function submitMayorSuccessor(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorPlayerId: string,
  successorPlayerId: string
): Promise<void> {
  const state = normalizeGameState(room.game_state);
  if (
    !state.mayorPendingSuccessorFromId ||
    (state.mayorPendingSuccessorFromId !== actorPlayerId &&
      !players.find((p) => p.id === actorPlayerId)?.is_owner)
  ) {
    throw new Error("La succession du Maire n'est pas disponible.");
  }

  const successor = players.find(
    (p) => p.id === successorPlayerId && p.is_alive
  );
  if (!successor) {
    throw new Error("Le successeur choisi doit être un joueur vivant.");
  }

  const supabase = createClient();
  const nextState: RoomGameState = {
    ...state,
    mayorPlayerId: successor.id,
    mayorPendingSuccessorFromId: null,
    lastAnnouncement: `${successor.pseudo} reçoit l'écharpe de Maire du village !`,
    eventLog: appendGameLog(state.eventLog, {
      turn: room.turn_number,
      phase: "day",
      text: `${successor.pseudo} hérite de l'écharpe de Maire.`,
    }),
  };

  await supabase
    .from("rooms")
    .update({ game_state: nextState })
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

export async function resetRoomToLobby(
  roomId: string,
  existingRoom?: RoomRecord | null
): Promise<void> {
  const supabase = createClient();

  let sourceState: RoomGameState | null = existingRoom
    ? normalizeGameState(existingRoom.game_state)
    : null;
  if (!sourceState) {
    const { data } = await supabase
      .from("rooms")
      .select("game_state")
      .eq("id", roomId)
      .maybeSingle();
    if (data?.game_state) {
      sourceState = normalizeGameState(data.game_state as RoomGameState);
    }
  }

  const freshState: RoomGameState = {
    ...createInitialGameState(),
    dayDebateSeconds: sourceState?.dayDebateSeconds ?? 120,
    mayorEnabled: sourceState?.mayorEnabled ?? true,
    primaryAudioUserId: sourceState?.primaryAudioUserId ?? null,
    ttsVoice: sourceState?.ttsVoice ?? "Aoede",
  };

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
      game_state: freshState,
    })
    .eq("id", roomId);
}

/* ==================== NOUVEAUX RÔLES & POUVOIRS ==================== */

export async function submitVoleurChoice(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  chosenRoleId: string | null
): Promise<void> {
  const actor = players.find((p) => p.id === actorId && p.is_alive);
  if (!actor || actor.role !== "voleur") {
    throw new Error("Seul le Voleur vivant peut agir cette nuit.");
  }
  const state = normalizeGameState(room.game_state);
  if (state.thiefResolved) return;

  const supabase = createClient();
  let nextComedianMasks = state.comedianMasks;

  if (chosenRoleId) {
    if (!state.thiefOptions || !state.thiefOptions.includes(chosenRoleId)) {
      throw new Error("Carte non disponible dans la réserve du Voleur.");
    }
    await supabase
      .from("room_players")
      .update({ role: chosenRoleId })
      .eq("id", actor.id);
    if (chosenRoleId === "comedien" && nextComedianMasks.length === 0) {
      nextComedianMasks = drawComedianMasks();
    }
  }

  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...state,
        thiefResolved: true,
        comedianMasks: nextComedianMasks,
        readyUserIds: Array.from(new Set([...state.readyUserIds, actor.user_id])),
      },
    })
    .eq("id", room.id);
}

export async function submitLoupMystiqueInspection(
  room: RoomRecord,
  targetPlayerId: string,
  players?: RoomPlayerRecord[],
  actorId?: string
): Promise<void> {
  if (players && actorId) {
    assertAliveTarget(players, actorId, targetPlayerId, { allowSelf: false });
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...room.game_state,
        mystiqueInspectedId: targetPlayerId,
      },
    })
    .eq("id", room.id);
}

export async function submitComedianMaskAction(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  payload: { maskId: string | null; targetPlayerId?: string | null }
): Promise<void> {
  const actor = players.find((p) => p.id === actorId && p.is_alive);
  if (!actor || actor.role !== "comedien") {
    throw new Error("Seul le Comédien vivant peut endosser un masque.");
  }
  const state = normalizeGameState(room.game_state);
  const supabase = createClient();

  if (!payload.maskId) {
    await supabase
      .from("rooms")
      .update({
        game_state: {
          ...state,
          comedianActedTonight: true,
          readyUserIds: Array.from(new Set([...state.readyUserIds, actor.user_id])),
        },
      })
      .eq("id", room.id);
    return;
  }

  if (
    !state.comedianMasks.includes(payload.maskId) ||
    state.comedianUsedMasks.includes(payload.maskId)
  ) {
    throw new Error("Ce masque n'est plus disponible.");
  }

  if (!payload.targetPlayerId) {
    throw new Error("Sélectionnez une cible pour activer ce masque.");
  }

  const nextUsedMasks = [...state.comedianUsedMasks, payload.maskId];
  let patchState: RoomGameState = {
    ...state,
    comedianUsedMasks: nextUsedMasks,
    comedianActedTonight: true,
  };

  if (payload.maskId === "voyante") {
    assertAliveTarget(players, actorId, payload.targetPlayerId, {
      allowSelf: false,
    });
    patchState = {
      ...patchState,
      comedianPeekedPlayerId: payload.targetPlayerId,
    };
  } else if (payload.maskId === "salvateur") {
    assertAliveTarget(players, actorId, payload.targetPlayerId, {
      allowSelf: true,
    });
    if (payload.targetPlayerId === state.salvateurLastTargetId) {
      throw new Error("Impossible de protéger le même joueur deux nuits de suite.");
    }
    patchState = {
      ...patchState,
      salvateurTargetId: payload.targetPlayerId,
    };
  } else if (payload.maskId === "corbeau") {
    assertAliveTarget(players, actorId, payload.targetPlayerId, {
      allowSelf: false,
    });
    patchState = {
      ...patchState,
      corbeauTargetId: payload.targetPlayerId,
    };
  } else if (payload.maskId === "renard") {
    assertAliveTarget(players, actorId, payload.targetPlayerId, {
      allowSelf: false,
    });
    const res = checkFoxTargets(players, payload.targetPlayerId, state);
    patchState = {
      ...patchState,
      foxLastResult: { names: res.names, hasWolf: res.hasWolf },
    };
  }

  await supabase
    .from("rooms")
    .update({ game_state: patchState })
    .eq("id", room.id);
}

export async function submitPyromaneOil(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string,
  targetIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(targetIds)).slice(0, 2);
  if (unique.length === 0) {
    throw new Error("Choisissez au moins un habitant à asperger d'huile.");
  }
  for (const id of unique) {
    assertAliveTarget(players, actorId, id, { allowSelf: false });
  }
  const state = normalizeGameState(room.game_state);
  const nextOiled = Array.from(new Set([...state.oiledPlayerIds, ...unique]));
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...state,
        oiledPlayerIds: nextOiled,
        pyromaneActedTonight: true,
      },
    })
    .eq("id", room.id);
}

export async function submitPyromaneIgnite(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string
): Promise<void> {
  const actor = players.find((p) => p.id === actorId && p.is_alive);
  if (!actor || actor.role !== "pyromane") {
    throw new Error("Seul le Pyromane vivant peut allumer l'embrasement.");
  }
  const state = normalizeGameState(room.game_state);
  const hasAliveOiled = state.oiledPlayerIds.some((id) =>
    players.some((p) => p.id === id && p.is_alive)
  );
  if (!hasAliveOiled) {
    throw new Error("Aucune cible vivante n'est encore aspergée d'huile.");
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...state,
        pyromaneIgnitedTonight: true,
        pyromaneActedTonight: true,
      },
    })
    .eq("id", room.id);
}

export async function submitJugeBegueArm(
  room: RoomRecord,
  players: RoomPlayerRecord[],
  actorId: string
): Promise<void> {
  const actor = players.find((p) => p.id === actorId && p.is_alive);
  if (!actor || actor.role !== "juge-begue") {
    throw new Error("Seul le Juge Bègue vivant peut décréter un double vote.");
  }
  const state = normalizeGameState(room.game_state);
  if (room.phase !== "DAY_VOTE" || state.voteMode !== "ELIMINATION") {
    throw new Error("Ce pouvoir ne s'utilise que durant le vote d'élimination.");
  }
  if (state.stutteringJudgeUsed) {
    throw new Error("Vous avez déjà utilisé votre coup de marteau dans cette partie.");
  }
  const supabase = createClient();
  await supabase
    .from("rooms")
    .update({
      game_state: {
        ...state,
        stutteringJudgeArmed: true,
      },
    })
    .eq("id", room.id);
}

/* ==================== MODE TEST SOLO / JOUEURS IA (BOTS) ==================== */

const BOT_DISPLAY_NAMES = [
  "Lycan",
  "Astrid",
  "Corvus",
  "Sélène",
  "Dorian",
  "Morgane",
  "Kael",
  "Éléonore",
  "Théo",
  "Cassandra",
  "Lucian",
  "Véra",
  "Nolan",
  "Isolde",
  "Soren",
  "Freya",
  "Gaspard",
  "Aurore",
  "Bastien",
  "Clémence",
  "Victor",
  "Héléna",
  "Rémi",
  "Ophélie",
  "Cédric",
  "Ysaline",
  "Maxence",
  "Sibylle",
  "Alaric",
];

const BOT_AVATAR_PRESETS: AvatarPresetId[] = [
  "wolf",
  "moon",
  "eye",
  "flask",
  "flame",
  "shield",
  "sparkles",
  "bird",
  "fox",
  "music",
  "sword",
  "crown",
];

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export async function populateTestBotsInRoom(
  room: RoomRecord,
  existingPlayers: RoomPlayerRecord[],
  targetTotalCount = 8
): Promise<RoomPlayerRecord[]> {
  const supabase = createClient();
  const desiredTotal = Math.max(
    existingPlayers.length,
    Math.min(30, targetTotalCount)
  );
  const botsNeeded = Math.max(0, desiredTotal - existingPlayers.length);

  if (botsNeeded > 0) {
    const usedIds = new Set(existingPlayers.map((p) => p.user_id));
    const botRows: Array<{
      room_id: string;
      user_id: string;
      pseudo: string;
      avatar_data: string;
      is_owner: boolean;
      is_alive: boolean;
      has_voted: boolean;
      target_id: null;
    }> = [];

    let botIndex = 1;
    while (botRows.length < botsNeeded && botIndex <= 35) {
      const botUserId = `bot-${botIndex}`;
      if (!usedIds.has(botUserId)) {
        usedIds.add(botUserId);
        const name =
          BOT_DISPLAY_NAMES[(botIndex - 1) % BOT_DISPLAY_NAMES.length] ??
          `Veilleur ${botIndex}`;
        const preset =
          BOT_AVATAR_PRESETS[(botIndex - 1) % BOT_AVATAR_PRESETS.length] ??
          "wolf";
        botRows.push({
          room_id: room.id,
          user_id: botUserId,
          pseudo: `${name} (Bot)`,
          avatar_data: `preset:${preset}`,
          is_owner: false,
          is_alive: true,
          has_voted: false,
          target_id: null,
        });
      }
      botIndex += 1;
    }

    if (botRows.length > 0) {
      const { error } = await withRequestTimeout(
        supabase
          .from("room_players")
          .upsert(botRows, { onConflict: "room_id,user_id" })
      );
      if (error) {
        throw new Error(
          formatSupabaseError(error, "Impossible d'ajouter des joueurs IA.")
        );
      }
    }
  }

  const { data: refreshed } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const allPlayers = (refreshed ?? existingPlayers) as RoomPlayerRecord[];
  const totalComp = Object.values(room.role_composition ?? {}).reduce(
    (s, n) => s + (Number(n) || 0),
    0
  );
  if (allPlayers.length >= 4 && totalComp !== allPlayers.length) {
    const nextComp = buildLobbyPresetComposition(
      "chaos-alliances",
      allPlayers.length
    );
    await supabase
      .from("rooms")
      .update({ role_composition: nextComp })
      .eq("id", room.id);
    room.role_composition = nextComp;
  }

  return allPlayers;
}

export async function clearTestBotsFromRoom(roomId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .like("user_id", "bot-%");
  if (error) {
    throw new Error(
      formatSupabaseError(error, "Impossible de retirer les joueurs IA.")
    );
  }
}

export async function startSoloTestGameWithBots(
  room: RoomRecord,
  existingPlayers: RoomPlayerRecord[],
  targetTotal?: number
): Promise<void> {
  const compSum = Object.values(room.role_composition ?? {}).reduce(
    (s, n) => s + (Number(n) || 0),
    0
  );
  const desired = Math.max(
    6,
    Math.min(30, targetTotal ?? (compSum >= 6 ? compSum : 8))
  );
  const allPlayers = await populateTestBotsInRoom(room, existingPlayers, desired);

  const updatedCompSum = Object.values(room.role_composition ?? {}).reduce(
    (s, n) => s + (Number(n) || 0),
    0
  );
  if (updatedCompSum !== allPlayers.length && allPlayers.length >= 4) {
    room.role_composition = buildLobbyPresetComposition(
      "chaos-alliances",
      allPlayers.length
    );
    const supabase = createClient();
    await supabase
      .from("rooms")
      .update({ role_composition: room.role_composition })
      .eq("id", room.id);
  }

  await startGameInRoom(room, allPlayers);
}

/**
 * Exécute automatiquement les actions en attente des joueurs IA (Bots) pour la phase active.
 * Retourne true si au moins une action bot a été enregistrée.
 */
export async function performBotActionsForPhase(
  room: RoomRecord,
  players: RoomPlayerRecord[]
): Promise<boolean> {
  const supabase = createClient();
  const state = normalizeGameState(room.game_state);
  const alive = players.filter((p) => p.is_alive);

  // 0. Succession du Maire si le Maire défunt était un Bot
  if (state.mayorPendingSuccessorFromId) {
    const deadMayor = players.find(
      (p) => p.id === state.mayorPendingSuccessorFromId
    );
    if (deadMayor && isBotPlayer(deadMayor) && alive.length >= 2) {
      const nextMayor = pickRandom(alive);
      if (nextMayor) {
        await submitMayorSuccessor(room, players, deadMayor.id, nextMayor.id);
        return true;
      }
    }
  }

  if (room.phase === "ROLE_REVEAL") {
    const unreadyBots = alive.filter(
      (p) => isBotPlayer(p) && !state.readyUserIds.includes(p.user_id)
    );
    if (unreadyBots.length === 0) return false;
    const nextReady = Array.from(
      new Set([...state.readyUserIds, ...unreadyBots.map((b) => b.user_id)])
    );
    await supabase
      .from("rooms")
      .update({
        game_state: { ...state, readyUserIds: nextReady },
      })
      .eq("id", room.id);
    return true;
  }

  if (room.phase === "DAY_VOTE") {
    const eligibleBots = alive.filter(
      (p) =>
        isBotPlayer(p) &&
        !p.has_voted &&
        (state.voteMode === "MAYOR_ELECTION" ||
          !state.idiotSparedPlayerIds.includes(p.id))
    );
    if (eligibleBots.length === 0) return false;

    await Promise.all(
      eligibleBots.map(async (bot) => {
        const others = alive.filter((a) => a.id !== bot.id);
        if (others.length === 0) return;
        const botIsWolf = isEffectiveWolf(bot, state);
        const preferred =
          state.voteMode === "ELIMINATION" && botIsWolf
            ? others.filter((a) => !isEffectiveWolf(a, state))
            : others;
        const target = pickRandom(preferred.length > 0 ? preferred : others);
        if (target) {
          await submitVoteTarget(bot.id, target.id);
        }
      })
    );
    return true;
  }

  if (room.phase === "HUNTER_SHOT" && state.hunterPendingPlayerId) {
    const hunter = players.find((p) => p.id === state.hunterPendingPlayerId);
    if (hunter && isBotPlayer(hunter)) {
      const target = pickRandom(alive.filter((a) => a.id !== hunter.id));
      if (target) {
        await submitHunterShotTarget(room, players, target.id);
        return true;
      }
    }
    return false;
  }

  if (!room.phase.startsWith("NIGHT_")) return false;
  const step = state.nightStep;

  if (step === "voleur") {
    const voleur = alive.find((p) => p.role === "voleur" && isBotPlayer(p));
    if (voleur && !state.thiefResolved) {
      const pick =
        state.thiefOptions && Math.random() < 0.75
          ? state.thiefOptions[0]
          : null;
      await submitVoleurChoice(room, players, voleur.id, pick);
      return true;
    }
  } else if (step === "cupidon" || (!step && room.phase === "NIGHT_CUPIDON")) {
    const cupidon = alive.find((p) => p.role === "cupidon" && isBotPlayer(p));
    if (cupidon && state.cupidonTargets.length < 2) {
      const pool = alive.filter((p) => p.id !== cupidon.id);
      if (pool.length >= 2) {
        await submitCupidonLovers(
          room,
          [pool[0].id, pool[1].id],
          players,
          cupidon.id
        );
        return true;
      }
    }
  } else if (step === "enfant-sauvage") {
    const wc = alive.find(
      (p) => p.role === "enfant-sauvage" && isBotPlayer(p)
    );
    if (wc && !state.wildChildModelId) {
      const target = pickRandom(alive.filter((p) => p.id !== wc.id));
      if (target) {
        await submitWildChildModel(room, players, wc.id, target.id);
        return true;
      }
    }
  } else if (step === "fratrie") {
    const unreadySibs = alive.filter(
      (p) =>
        isBotPlayer(p) &&
        (p.role === "soeurs" || p.role === "freres") &&
        !state.readyUserIds.includes(p.user_id)
    );
    if (unreadySibs.length > 0) {
      await supabase
        .from("rooms")
        .update({
          game_state: {
            ...state,
            readyUserIds: Array.from(
              new Set([...state.readyUserIds, ...unreadySibs.map((s) => s.user_id)])
            ),
          },
        })
        .eq("id", room.id);
      return true;
    }
  } else if (step === "salvateur") {
    const guard = alive.find((p) => p.role === "salvateur" && isBotPlayer(p));
    if (guard && !state.salvateurTargetId) {
      const candidates = alive.filter(
        (p) => p.id !== state.salvateurLastTargetId
      );
      const target = pickRandom(candidates.length > 0 ? candidates : alive);
      if (target) {
        await submitSalvateurTarget(room, players, guard.id, target.id);
        return true;
      }
    }
  } else if (step === "voyante" || (!step && room.phase === "NIGHT_SEER")) {
    const seer = alive.find((p) => p.role === "voyante" && isBotPlayer(p));
    if (seer && !state.seerInspectedId) {
      const target = pickRandom(alive.filter((p) => p.id !== seer.id));
      if (target) {
        await submitSeerInspection(room, target.id, players, seer.id);
        return true;
      }
    }
  } else if (step === "renard") {
    const fox = alive.find((p) => p.role === "renard" && isBotPlayer(p));
    if (fox && !state.foxCheckedTonight) {
      const target = pickRandom(alive.filter((p) => p.id !== fox.id));
      if (target) {
        await submitRenardTargets(room, players, fox.id, target.id);
        return true;
      }
    }
  } else if (step === "comedien") {
    const comedian = alive.find((p) => p.role === "comedien" && isBotPlayer(p));
    if (comedian && !state.comedianActedTonight) {
      const unused = state.comedianMasks.filter(
        (m) => !state.comedianUsedMasks.includes(m)
      );
      const chosenMask = unused[0] ?? null;
      const target =
        chosenMask === "salvateur"
          ? pickRandom(
              alive.filter((p) => p.id !== state.salvateurLastTargetId)
            )
          : pickRandom(alive.filter((p) => p.id !== comedian.id));
      await submitComedianMaskAction(room, players, comedian.id, {
        maskId: target ? chosenMask : null,
        targetPlayerId: target?.id ?? null,
      });
      return true;
    }
  } else if (step === "loups" || (!step && room.phase === "NIGHT_WEREWOLVES")) {
    const botWolves = alive.filter(
      (p) => isBotPlayer(p) && isEffectiveWolf(p, state) && !p.has_voted
    );
    if (botWolves.length > 0) {
      const preys = alive.filter((p) => !isEffectiveWolf(p, state));
      const prey = pickRandom(preys.length > 0 ? preys : alive);
      if (prey) {
        await Promise.all(
          botWolves.map((wolf) =>
            prey.id !== wolf.id ? submitVoteTarget(wolf.id, prey.id) : Promise.resolve()
          )
        );
        return true;
      }
    }
  } else if (step === "loup-mystique") {
    const mystique = alive.find(
      (p) => p.role === "loup-mystique" && isBotPlayer(p)
    );
    if (mystique && !state.mystiqueInspectedId) {
      const preys = alive.filter(
        (p) => p.id !== mystique.id && !isEffectiveWolf(p, state)
      );
      const target = pickRandom(
        preys.length > 0 ? preys : alive.filter((p) => p.id !== mystique.id)
      );
      if (target) {
        await submitLoupMystiqueInspection(room, target.id, players, mystique.id);
        return true;
      }
    }
  } else if (step === "loup-blanc") {
    const ww = alive.find(
      (p) => p.role === "loup-garou-blanc" && isBotPlayer(p)
    );
    if (
      ww &&
      !state.loupBlancTargetId &&
      !state.readyUserIds.includes(ww.user_id)
    ) {
      const otherWolves = alive.filter(
        (p) => p.id !== ww.id && isEffectiveWolf(p, state)
      );
      if (otherWolves.length > 0 && Math.random() < 0.45) {
        const prey = pickRandom(otherWolves);
        if (prey) {
          await submitLoupBlancTarget(room, players, ww.id, prey.id);
          return true;
        }
      }
      await markPlayerReady(room, ww.user_id);
      return true;
    }
  } else if (step === "grand-mechant-loup") {
    const gml = alive.find(
      (p) => p.role === "grand-mechant-loup" && isBotPlayer(p)
    );
    if (
      gml &&
      !state.grandMechantSecondTargetId &&
      !state.readyUserIds.includes(gml.user_id)
    ) {
      const preys = alive.filter(
        (p) => !isEffectiveWolf(p, state) && p.id !== state.wolfTargetId
      );
      const prey = pickRandom(preys);
      if (prey) {
        await submitGrandMechantTarget(room, players, gml.id, prey.id);
      } else {
        await markPlayerReady(room, gml.user_id);
      }
      return true;
    }
  } else if (step === "sorciere" || (!step && room.phase === "NIGHT_WITCH")) {
    const witch = alive.find((p) => p.role === "sorciere" && isBotPlayer(p));
    if (
      witch &&
      !state.witchSaveTonight &&
      !state.witchKillTargetId &&
      !state.readyUserIds.includes(witch.user_id)
    ) {
      const saveVictim = Boolean(
        !state.witchLifeUsed &&
          state.wolfTargetId &&
          state.wolfTargetId !== state.salvateurTargetId &&
          Math.random() < 0.5
      );
      let killTargetId: string | null = null;
      if (!state.witchDeathUsed && Math.random() < 0.25) {
        killTargetId =
          pickRandom(
            alive.filter((p) => p.id !== witch.id && p.id !== state.wolfTargetId)
          )?.id ?? null;
      }
      await submitWitchDecision(
        room,
        { saveWolfVictim: saveVictim, killTargetId },
        players,
        witch.id
      );
      await markPlayerReady(room, witch.user_id);
      return true;
    }
  } else if (step === "corbeau") {
    const crow = alive.find((p) => p.role === "corbeau" && isBotPlayer(p));
    if (crow && !state.corbeauTargetId) {
      const target = pickRandom(alive.filter((p) => p.id !== crow.id));
      if (target) {
        await submitCorbeauTarget(room, players, crow.id, target.id);
        return true;
      }
    }
  } else if (step === "pyromane") {
    const pyro = alive.find((p) => p.role === "pyromane" && isBotPlayer(p));
    if (pyro && !state.pyromaneActedTonight) {
      const oiledAlive = alive.filter((p) => state.oiledPlayerIds.includes(p.id));
      const unoiled = alive.filter(
        (p) => p.id !== pyro.id && !state.oiledPlayerIds.includes(p.id)
      );
      if (oiledAlive.length >= 2 || (oiledAlive.length >= 1 && unoiled.length === 0)) {
        await submitPyromaneIgnite(room, players, pyro.id);
        return true;
      }
      if (unoiled.length > 0) {
        const chosen = unoiled.slice(0, 2).map((p) => p.id);
        await submitPyromaneOil(room, players, pyro.id, chosen);
        return true;
      }
    }
  } else if (step === "joueur-de-flute") {
    const piper = alive.find(
      (p) => p.role === "joueur-de-flute" && isBotPlayer(p)
    );
    if (piper && state.piperTargetsTonight.length === 0) {
      const uncharmed = alive.filter(
        (p) => p.id !== piper.id && !state.charmedPlayerIds.includes(p.id)
      );
      if (uncharmed.length > 0) {
        await submitPiperTargets(
          room,
          players,
          piper.id,
          uncharmed.slice(0, 2).map((p) => p.id)
        );
        return true;
      }
    }
  }

  return false;
}
