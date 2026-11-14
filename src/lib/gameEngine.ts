import type {
  AvatarPresetId,
  GameLogEntry,
  GamePhase,
  NightStepId,
  NightVictimEntry,
  PlayerProfile,
  RoomGameState,
  RoomPlayerRecord,
} from "@/types/game";

export const WOLF_ROLE_IDS = [
  "loup-garou",
  "loup-mystique",
  "loup-garou-blanc",
  "grand-mechant-loup",
  "infect-pere-des-loups",
];

export function isBotPlayer(
  player: Pick<RoomPlayerRecord, "user_id"> | null | undefined
): boolean {
  return Boolean(player?.user_id?.startsWith("bot-"));
}

const COMEDIAN_MASK_POOL = ["voyante", "salvateur", "corbeau", "renard"];
const THIEF_RESERVE_POOL = [
  "voyante",
  "sorciere",
  "salvateur",
  "chasseur",
  "cupidon",
  "corbeau",
  "renard",
  "comedien",
  "juge-begue",
  "loup-garou",
  "simple-villageois",
];

export function drawComedianMasks(): string[] {
  const shuffled = [...COMEDIAN_MASK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export function drawThiefReserveRoles(): [string, string] {
  const shuffled = [...THIEF_RESERVE_POOL].sort(() => Math.random() - 0.5);
  return [shuffled[0] ?? "voyante", shuffled[1] ?? "loup-garou"];
}

const VALID_AVATAR_PRESETS = new Set<AvatarPresetId>([
  "wolf",
  "moon",
  "crown",
  "eye",
  "flask",
  "flame",
  "shield",
  "sparkles",
  "bird",
  "fox",
  "music",
  "sword",
]);

const NIGHT_STEP_ORDER: Array<{
  step: Exclude<NightStepId, null>;
  phase: GamePhase;
}> = [
  { step: "voleur", phase: "NIGHT_CUPIDON" },
  { step: "cupidon", phase: "NIGHT_CUPIDON" },
  { step: "enfant-sauvage", phase: "NIGHT_CUPIDON" },
  { step: "fratrie", phase: "NIGHT_CUPIDON" },
  { step: "salvateur", phase: "NIGHT_SEER" },
  { step: "voyante", phase: "NIGHT_SEER" },
  { step: "renard", phase: "NIGHT_SEER" },
  { step: "comedien", phase: "NIGHT_SEER" },
  { step: "loups", phase: "NIGHT_WEREWOLVES" },
  { step: "loup-mystique", phase: "NIGHT_WEREWOLVES" },
  { step: "loup-blanc", phase: "NIGHT_WEREWOLVES" },
  { step: "grand-mechant-loup", phase: "NIGHT_WEREWOLVES" },
  { step: "sorciere", phase: "NIGHT_WITCH" },
  { step: "corbeau", phase: "NIGHT_WITCH" },
  { step: "pyromane", phase: "NIGHT_WITCH" },
  { step: "joueur-de-flute", phase: "NIGHT_WITCH" },
];

export function isWolfRole(roleId: string | null | undefined): boolean {
  return Boolean(roleId && WOLF_ROLE_IDS.includes(roleId));
}

export function isEffectiveWolf(
  player: Pick<RoomPlayerRecord, "id" | "role">,
  gameState?: Partial<RoomGameState> | null
): boolean {
  if (isWolfRole(player.role)) return true;
  if (gameState?.infectedPlayerIds?.includes(player.id)) return true;
  if (player.role === "enfant-sauvage" && gameState?.wildChildTransformed) {
    return true;
  }
  return false;
}

export function generateRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

export function createInitialGameState(): RoomGameState {
  return {
    lovers: null,
    witchLifeUsed: false,
    witchDeathUsed: false,
    wolfTargetId: null,
    witchSaveTonight: false,
    witchKillTargetId: null,
    seerInspectedId: null,
    cupidonTargets: [],
    nightVictims: [],
    lastAnnouncement: "",
    hunterPendingPlayerId: null,
    hunterReturnPhase: null,
    winnerCamp: null,
    winnerTitle: null,
    winnerReason: null,
    phaseDeadline: null,
    readyUserIds: [],
    elderShieldUsed: false,
    nightStep: null,
    salvateurLastTargetId: null,
    salvateurTargetId: null,
    salvateurSavedTonight: false,
    foxUsedWrongly: false,
    foxCheckedTonight: false,
    foxLastResult: null,
    corbeauTargetId: null,
    infectUsed: false,
    infectTonight: false,
    infectedPlayerIds: [],
    grandMechantSecondTargetId: null,
    charmedPlayerIds: [],
    piperTargetsTonight: [],
    wildChildModelId: null,
    wildChildTransformed: false,
    servanteUsed: false,
    rustyKnightPendingWolfId: null,
    idiotSparedPlayerIds: [],
    loupBlancTargetId: null,
    bearGrowledTonight: false,
    elderShieldTriggeredTonight: false,
    dayDebateSeconds: 120,
    mayorEnabled: true,
    mayorPlayerId: null,
    mayorPendingSuccessorFromId: null,
    mayorElectionDone: false,
    voteMode: "ELIMINATION",
    primaryAudioUserId: null,
    ttsVoice: "Aoede",
    mystiqueInspectedId: null,
    thiefOptions: null,
    thiefResolved: false,
    oiledPlayerIds: [],
    pyromaneActedTonight: false,
    pyromaneIgnitedTonight: false,
    comedianMasks: [],
    comedianUsedMasks: [],
    comedianActedTonight: false,
    comedianPeekedPlayerId: null,
    stutteringJudgeUsed: false,
    stutteringJudgeArmed: false,
    eventLog: [],
    reactions: {},
  };
}

export function normalizeGameState(
  raw?: Partial<RoomGameState> | null
): RoomGameState {
  const base = createInitialGameState();
  if (!raw || typeof raw !== "object") return base;

  return {
    ...base,
    ...raw,
    cupidonTargets: Array.isArray(raw.cupidonTargets) ? raw.cupidonTargets : [],
    nightVictims: Array.isArray(raw.nightVictims) ? raw.nightVictims : [],
    readyUserIds: Array.isArray(raw.readyUserIds) ? raw.readyUserIds : [],
    infectedPlayerIds: Array.isArray(raw.infectedPlayerIds)
      ? raw.infectedPlayerIds
      : [],
    charmedPlayerIds: Array.isArray(raw.charmedPlayerIds)
      ? raw.charmedPlayerIds
      : [],
    piperTargetsTonight: Array.isArray(raw.piperTargetsTonight)
      ? raw.piperTargetsTonight
      : [],
    idiotSparedPlayerIds: Array.isArray(raw.idiotSparedPlayerIds)
      ? raw.idiotSparedPlayerIds
      : [],
    oiledPlayerIds: Array.isArray(raw.oiledPlayerIds) ? raw.oiledPlayerIds : [],
    comedianMasks: Array.isArray(raw.comedianMasks) ? raw.comedianMasks : [],
    comedianUsedMasks: Array.isArray(raw.comedianUsedMasks)
      ? raw.comedianUsedMasks
      : [],
    thiefOptions:
      Array.isArray(raw.thiefOptions) && raw.thiefOptions.length === 2
        ? [String(raw.thiefOptions[0]), String(raw.thiefOptions[1])]
        : null,
    dayDebateSeconds:
      raw.dayDebateSeconds === undefined ? 120 : raw.dayDebateSeconds,
    mayorEnabled: raw.mayorEnabled ?? true,
    mayorPlayerId: raw.mayorPlayerId ?? null,
    mayorPendingSuccessorFromId: raw.mayorPendingSuccessorFromId ?? null,
    mayorElectionDone: Boolean(raw.mayorElectionDone),
    voteMode:
      raw.voteMode === "MAYOR_ELECTION" ? "MAYOR_ELECTION" : "ELIMINATION",
    primaryAudioUserId: raw.primaryAudioUserId ?? null,
    ttsVoice: raw.ttsVoice === "Kore" ? "Kore" : "Aoede",
    mystiqueInspectedId: raw.mystiqueInspectedId ?? null,
    thiefResolved: Boolean(raw.thiefResolved),
    pyromaneActedTonight: Boolean(raw.pyromaneActedTonight),
    pyromaneIgnitedTonight: Boolean(raw.pyromaneIgnitedTonight),
    comedianActedTonight: Boolean(raw.comedianActedTonight),
    comedianPeekedPlayerId: raw.comedianPeekedPlayerId ?? null,
    stutteringJudgeUsed: Boolean(raw.stutteringJudgeUsed),
    stutteringJudgeArmed: Boolean(raw.stutteringJudgeArmed),
    eventLog: Array.isArray(raw.eventLog) ? raw.eventLog : [],
    reactions:
      raw.reactions && typeof raw.reactions === "object" ? raw.reactions : {},
    nightStep: raw.nightStep ?? null,
  };
}

export function appendGameLog(
  existingLog: GameLogEntry[] | undefined,
  entry: Omit<GameLogEntry, "id" | "timestamp">
): GameLogEntry[] {
  const current = Array.isArray(existingLog) ? existingLog : [];
  const next: GameLogEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  return [...current.slice(-29), next];
}

export function encodeProfileAvatar(profile: PlayerProfile): string {
  if (
    profile.avatarType === "upload" &&
    profile.avatarDataUrl &&
    (profile.avatarDataUrl.startsWith("data:image/") ||
      profile.avatarDataUrl.startsWith("data:video/"))
  ) {
    return profile.avatarDataUrl;
  }
  return `preset:${profile.avatarPreset}`;
}

export function decodeAvatarToProfile(
  avatarData: string | null,
  pseudo: string,
  isOwner: boolean
): PlayerProfile {
  if (
    avatarData &&
    (avatarData.startsWith("data:image/") ||
      avatarData.startsWith("data:video/"))
  ) {
    return {
      nickname: pseudo,
      avatarType: "upload",
      avatarPreset: "moon",
      avatarDataUrl: avatarData,
      isOwner,
    };
  }

  let preset: AvatarPresetId = "moon";
  if (avatarData?.startsWith("preset:")) {
    const rawPreset = avatarData.replace("preset:", "") as AvatarPresetId;
    if (VALID_AVATAR_PRESETS.has(rawPreset)) {
      preset = rawPreset;
    } else if ((rawPreset as string) === "paw") {
      preset = "wolf";
    }
  }

  return {
    nickname: pseudo,
    avatarType: "preset",
    avatarPreset: preset,
    avatarDataUrl: null,
    isOwner,
  };
}

/**
 * Mélange Fisher-Yates et distribue les rôles choisis dans la composition.
 */
export function dealRolesToPlayers(
  players: RoomPlayerRecord[],
  composition: Record<string, number>
): Array<{ playerId: string; roleId: string }> {
  const pool: string[] = [];
  for (const [roleId, count] of Object.entries(composition)) {
    for (let i = 0; i < count; i++) {
      pool.push(roleId);
    }
  }

  while (pool.length < players.length) {
    pool.push("simple-villageois");
  }

  const trimmed = pool.slice(0, players.length);
  for (let i = trimmed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trimmed[i], trimmed[j]] = [trimmed[j], trimmed[i]];
  }

  return players.map((p, idx) => ({
    playerId: p.id,
    roleId: trimmed[idx] ?? "simple-villageois",
  }));
}

export function getPhaseDurationSeconds(
  phase: GamePhase,
  nightStep?: NightStepId | null,
  gameState?: Partial<RoomGameState> | null
): number | null {
  if (phase === "ROLE_REVEAL") return 22;
  if (phase === "DAY_ANNOUNCEMENT") return 18;
  if (phase === "DAY_VOTE") {
    if (gameState?.voteMode === "MAYOR_ELECTION") return 35;
    if (gameState && gameState.dayDebateSeconds === null) return null;
    return gameState?.dayDebateSeconds ?? 120;
  }
  if (phase === "HUNTER_SHOT") return 25;

  if (phase.startsWith("NIGHT_")) {
    switch (nightStep) {
      case "voleur":
      case "cupidon":
        return 25;
      case "enfant-sauvage":
        return 22;
      case "fratrie":
        return 18;
      case "salvateur":
      case "voyante":
      case "renard":
      case "comedien":
      case "corbeau":
        return 24;
      case "loups":
        return 35;
      case "loup-mystique":
      case "loup-blanc":
      case "grand-mechant-loup":
        return 24;
      case "sorciere":
      case "pyromane":
      case "joueur-de-flute":
        return 26;
      default:
        return phase === "NIGHT_WEREWOLVES" ? 35 : 25;
    }
  }

  return null;
}

export function buildPhaseDeadline(
  phase: GamePhase,
  nightStep?: NightStepId | null,
  gameState?: Partial<RoomGameState> | null
): string | null {
  const sec = getPhaseDurationSeconds(phase, nightStep, gameState);
  if (!sec) return null;
  return new Date(Date.now() + sec * 1000).toISOString();
}

export function isNightStepActive(
  step: Exclude<NightStepId, null>,
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber: number
): boolean {
  const alive = players.filter((p) => p.is_alive);
  const hasAliveRole = (roleId: string) =>
    alive.some((p) => p.role === roleId);
  const countAliveRole = (roleId: string) =>
    alive.filter((p) => p.role === roleId).length;

  switch (step) {
    case "voleur":
      return (
        turnNumber === 1 && hasAliveRole("voleur") && !gameState.thiefResolved
      );
    case "cupidon":
      return (
        turnNumber === 1 &&
        hasAliveRole("cupidon") &&
        !gameState.lovers &&
        alive.length >= 2
      );
    case "enfant-sauvage":
      return (
        turnNumber === 1 &&
        hasAliveRole("enfant-sauvage") &&
        !gameState.wildChildModelId &&
        alive.length >= 2
      );
    case "fratrie":
      return (
        turnNumber === 1 &&
        (countAliveRole("soeurs") >= 2 || countAliveRole("freres") >= 2)
      );
    case "salvateur":
      return hasAliveRole("salvateur");
    case "voyante":
      return hasAliveRole("voyante");
    case "renard":
      return hasAliveRole("renard") && !gameState.foxUsedWrongly;
    case "comedien":
      return (
        hasAliveRole("comedien") &&
        gameState.comedianMasks.some(
          (m) => !gameState.comedianUsedMasks.includes(m)
        )
      );
    case "loups":
      return alive.some((p) => isEffectiveWolf(p, gameState));
    case "loup-mystique":
      return hasAliveRole("loup-mystique");
    case "loup-blanc":
      return (
        turnNumber % 2 === 0 &&
        hasAliveRole("loup-garou-blanc") &&
        alive.filter((p) => isEffectiveWolf(p, gameState)).length >= 2
      );
    case "grand-mechant-loup": {
      const hasAnyWolfDied = players.some(
        (p) => !p.is_alive && isEffectiveWolf(p, gameState)
      );
      return hasAliveRole("grand-mechant-loup") && !hasAnyWolfDied;
    }
    case "sorciere":
      return (
        hasAliveRole("sorciere") &&
        (!gameState.witchLifeUsed || !gameState.witchDeathUsed)
      );
    case "corbeau":
      return hasAliveRole("corbeau");
    case "pyromane":
      return hasAliveRole("pyromane");
    case "joueur-de-flute":
      return (
        hasAliveRole("joueur-de-flute") &&
        alive.some(
          (p) =>
            p.role !== "joueur-de-flute" &&
            !gameState.charmedPlayerIds.includes(p.id)
        )
      );
    default:
      return false;
  }
}

export function resolveNextNightStep(
  currentPhase: GamePhase,
  currentStep: NightStepId | undefined,
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber: number
): { phase: GamePhase; nightStep: Exclude<NightStepId, null> } | null {
  let startIndex = 0;

  if (
    currentPhase === "ROLE_REVEAL" ||
    currentPhase === "DAY_VOTE" ||
    currentPhase === "HUNTER_SHOT"
  ) {
    startIndex = 0;
  } else if (currentStep) {
    const idx = NIGHT_STEP_ORDER.findIndex((item) => item.step === currentStep);
    startIndex = idx >= 0 ? idx + 1 : 0;
  } else {
    const legacyFallback: Partial<Record<GamePhase, Exclude<NightStepId, null>>> =
      {
        NIGHT_CUPIDON: "cupidon",
        NIGHT_SEER: "voyante",
        NIGHT_WEREWOLVES: "loups",
        NIGHT_WITCH: "sorciere",
      };
    const inferred = legacyFallback[currentPhase];
    const idx = inferred
      ? NIGHT_STEP_ORDER.findIndex((item) => item.step === inferred)
      : -1;
    startIndex = idx >= 0 ? idx + 1 : NIGHT_STEP_ORDER.length;
  }

  for (let i = startIndex; i < NIGHT_STEP_ORDER.length; i++) {
    const candidate = NIGHT_STEP_ORDER[i];
    if (isNightStepActive(candidate.step, players, gameState, turnNumber)) {
      return { phase: candidate.phase, nightStep: candidate.step };
    }
  }

  return null;
}

/**
 * Wrapper rétro-compatible retournant la phase DB suivante ("DAY_ANNOUNCEMENT" en fin de nuit).
 */
export function resolveNextNightPhase(
  currentPhase: GamePhase,
  players: RoomPlayerRecord[],
  turnNumber: number,
  gameState: RoomGameState = createInitialGameState(),
  currentStep: NightStepId | undefined = gameState.nightStep
): GamePhase {
  const next = resolveNextNightStep(
    currentPhase,
    currentStep,
    players,
    gameState,
    turnNumber
  );
  return next ? next.phase : "DAY_ANNOUNCEMENT";
}

export function getAliveNeighbors(
  players: RoomPlayerRecord[],
  centerPlayerId: string
): { prev: RoomPlayerRecord | null; next: RoomPlayerRecord | null } {
  const alive = players.filter((p) => p.is_alive);
  const idx = alive.findIndex((p) => p.id === centerPlayerId);
  if (idx === -1 || alive.length <= 1) {
    return { prev: null, next: null };
  }
  if (alive.length === 2) {
    return { prev: alive[(idx + 1) % 2], next: null };
  }
  const prev = alive[(idx - 1 + alive.length) % alive.length];
  const next = alive[(idx + 1) % alive.length];
  return { prev, next };
}

export function checkFoxTargets(
  players: RoomPlayerRecord[],
  centerId: string,
  gameState: RoomGameState
): { inspectedIds: string[]; names: string[]; hasWolf: boolean } {
  const center = players.find((p) => p.id === centerId && p.is_alive);
  if (!center) {
    return { inspectedIds: [], names: [], hasWolf: false };
  }

  const { prev, next } = getAliveNeighbors(players, centerId);
  const uniquePlayers: RoomPlayerRecord[] = [];
  const seen = new Set<string>();
  for (const p of [prev, center, next]) {
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      uniquePlayers.push(p);
    }
  }

  return {
    inspectedIds: uniquePlayers.map((p) => p.id),
    names: uniquePlayers.map((p) => p.pseudo),
    hasWolf: uniquePlayers.some((p) => isEffectiveWolf(p, gameState)),
  };
}

export function didBearGrowl(
  players: RoomPlayerRecord[],
  gameState: RoomGameState
): boolean {
  const bearTamer = players.find(
    (p) => p.is_alive && p.role === "montreur-dours"
  );
  if (!bearTamer) return false;

  // Un Montreur d'Ours infecté fait grogner son ours chaque matin
  if (isEffectiveWolf(bearTamer, gameState)) return true;

  const { prev, next } = getAliveNeighbors(players, bearTamer.id);
  return Boolean(
    (prev && isEffectiveWolf(prev, gameState)) ||
      (next && isEffectiveWolf(next, gameState))
  );
}

export function findNextAliveWolfAfter(
  players: RoomPlayerRecord[],
  knightPlayerId: string,
  gameState: RoomGameState
): RoomPlayerRecord | null {
  if (players.length === 0) return null;
  const startIdx = players.findIndex((p) => p.id === knightPlayerId);
  const baseIdx = startIdx >= 0 ? startIdx : 0;

  for (let offset = 1; offset <= players.length; offset++) {
    const candidate = players[(baseIdx + offset) % players.length];
    if (
      candidate.id !== knightPlayerId &&
      candidate.is_alive &&
      isEffectiveWolf(candidate, gameState)
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Calcule le vainqueur éventuel en tenant compte de tous les rôles spéciaux.
 */
export function evaluateVictory(
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber = 1,
  recentlyDeadIds: string[] = []
): Pick<RoomGameState, "winnerCamp" | "winnerTitle" | "winnerReason"> {
  if (
    turnNumber === 1 &&
    recentlyDeadIds.some((id) => {
      const dead = players.find((p) => p.id === id);
      return dead?.role === "ange";
    })
  ) {
    return {
      winnerCamp: "solitaire",
      winnerTitle: "Victoire de l'Ange",
      winnerReason:
        "L'Ange a accompli sa destinée dès le premier vote et s'élève vers les cieux.",
    };
  }

  const alive = players.filter((p) => p.is_alive);

  if (alive.length === 0) {
    return {
      winnerCamp: "village",
      winnerTitle: "Aube Silencieuse",
      winnerReason:
        "Aucun survivant ne demeure sous la Lune de Sang, et la meute est anéantie.",
    };
  }

  // Victoire des Amoureux
  if (
    alive.length === 2 &&
    gameState.lovers &&
    gameState.lovers.every((id) => alive.some((a) => a.id === id))
  ) {
    return {
      winnerCamp: "amoureux",
      winnerTitle: "Victoire des Amoureux",
      winnerReason:
        "Seuls les deux amants survivent ensemble sous la Lune de Sang.",
    };
  }

  // Victoire du Joueur de Flûte
  const alivePiper = alive.find((p) => p.role === "joueur-de-flute");
  if (alivePiper) {
    const others = alive.filter((p) => p.id !== alivePiper.id);
    if (
      others.length > 0 &&
      others.every((p) => gameState.charmedPlayerIds.includes(p.id))
    ) {
      return {
        winnerCamp: "solitaire",
        winnerTitle: "Victoire du Joueur de Flûte",
        winnerReason:
          "Tous les survivants du village dansent désormais au son de sa flûte ensorcelée.",
      };
    }
  }

  const aliveWolves = alive.filter((p) => isEffectiveWolf(p, gameState));
  const aliveNonWolves = alive.filter((p) => !isEffectiveWolf(p, gameState));
  const alivePyromane = alive.find((p) => p.role === "pyromane");

  // Victoire solitaire du Pyromane
  if (alive.length === 1 && alivePyromane) {
    return {
      winnerCamp: "solitaire",
      winnerTitle: "Victoire du Pyromane",
      winnerReason:
        "Le Pyromane a réduit tout le village et la meute en cendres ; il règne seul sur les braises.",
    };
  }

  // Victoire solitaire du Loup-Garou Blanc
  if (alive.length === 1 && alive[0].role === "loup-garou-blanc") {
    return {
      winnerCamp: "solitaire",
      winnerTitle: "Victoire du Loup-Garou Blanc",
      winnerReason:
        "Le Loup-Garou Blanc a trahi toute la meute et règne seul sur les cendres du village.",
    };
  }

  if (aliveWolves.length === 0 && !alivePyromane) {
    return {
      winnerCamp: "village",
      winnerTitle: "Victoire du Village",
      winnerReason: "Tous les Loups-Garous ont été démasqués et vaincus !",
    };
  }

  if (aliveWolves.length >= aliveNonWolves.length && !alivePyromane) {
    if (aliveWolves.length === 1 && aliveWolves[0].role === "loup-garou-blanc") {
      return {
        winnerCamp: "solitaire",
        winnerTitle: "Victoire du Loup-Garou Blanc",
        winnerReason: "Le Loup-Garou Blanc demeure le seul maître de la nuit.",
      };
    }
    return {
      winnerCamp: "loup",
      winnerTitle: "Victoire des Loups-Garous",
      winnerReason:
        "Les créatures de la nuit égalent ou surpassent les survivants du village.",
    };
  }

  return {
    winnerCamp: null,
    winnerTitle: null,
    winnerReason: null,
  };
}

/**
 * Calcule la majorité des votes (avec bonus éventuel du Corbeau et double vote du Maire).
 */
export function tallyTargetFromVoters(
  voters: RoomPlayerRecord[],
  bonusTargetId?: string | null,
  bonusCount = 2,
  doubleVotePlayerId?: string | null
): {
  targetId: string | null;
  maxVotes: number;
  isTie: boolean;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};

  for (const voter of voters) {
    if (!voter.target_id) continue;
    const weight =
      doubleVotePlayerId && voter.id === doubleVotePlayerId ? 2 : 1;
    counts[voter.target_id] = (counts[voter.target_id] ?? 0) + weight;
  }

  if (bonusTargetId && bonusCount > 0) {
    counts[bonusTargetId] = (counts[bonusTargetId] ?? 0) + bonusCount;
  }

  let bestId: string | null = null;
  let maxVotes = 0;
  let isTie = false;

  for (const [candidateId, count] of Object.entries(counts)) {
    if (count > maxVotes) {
      maxVotes = count;
      bestId = candidateId;
      isTie = false;
    } else if (count === maxVotes && count > 0) {
      isTie = true;
    }
  }

  return {
    targetId: isTie ? null : bestId,
    maxVotes,
    isTie,
    counts,
  };
}

/**
 * Applique une liste de morts initiales + effets cascade (Amoureux, Chasseur, Ancien, Chevalier, Enfant Sauvage).
 */
export function resolveDeathsWithCascade(
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  initialDeaths: Array<{
    playerId: string;
    cause: NightVictimEntry["cause"];
  }>
): {
  updatedPlayers: RoomPlayerRecord[];
  victims: NightVictimEntry[];
  hunterPendingPlayerId: string | null;
  elderShieldTriggered: boolean;
  elderShieldUsedNext: boolean;
  rustyKnightPendingWolfIdNext: string | null;
  wildChildTransformedNow: boolean;
} {
  const cloned = players.map((p) => ({ ...p }));
  const victims: NightVictimEntry[] = [];
  const queue = [...initialDeaths];
  const processed = new Set<string>();
  let hunterPendingPlayerId: string | null = null;
  let elderShieldTriggered = false;
  let elderShieldUsedNext = gameState.elderShieldUsed;
  let rustyKnightPendingWolfIdNext: string | null = null;

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (processed.has(next.playerId)) continue;

    const target = cloned.find((p) => p.id === next.playerId);
    if (!target || !target.is_alive) continue;

    // Bouclier passif de l'Ancien contre une première attaque de Loups
    if (
      target.role === "ancien" &&
      next.cause === "loups" &&
      !elderShieldUsedNext
    ) {
      elderShieldTriggered = true;
      elderShieldUsedNext = true;
      processed.add(target.id);
      continue;
    }

    processed.add(target.id);
    target.is_alive = false;
    victims.push({
      playerId: target.id,
      pseudo: target.pseudo,
      roleId: target.role,
      cause: next.cause,
    });

    // Chevalier à l'Épée Rouillée : empoisonne le loup suivant s'il meurt sous les crocs
    if (
      target.role === "chevalier-epee-rouillee" &&
      next.cause === "loups" &&
      !rustyKnightPendingWolfIdNext
    ) {
      const nextWolf = findNextAliveWolfAfter(
        cloned,
        target.id,
        gameState
      );
      if (nextWolf) {
        rustyKnightPendingWolfIdNext = nextWolf.id;
      }
    }

    // Chagrin des Amoureux
    if (gameState.lovers && gameState.lovers.includes(target.id)) {
      const partnerId = gameState.lovers.find((id) => id !== target.id);
      if (partnerId && !processed.has(partnerId)) {
        queue.push({ playerId: partnerId, cause: "chagrin" });
      }
    }

    if (target.role === "chasseur") {
      hunterPendingPlayerId = target.id;
    }
  }

  // Enfant Sauvage : se transforme en Loup-Garou si son modèle vient de mourir
  const wildChildPlayer = cloned.find(
    (p) => p.is_alive && p.role === "enfant-sauvage"
  );
  const wildChildTransformedNow = Boolean(
    wildChildPlayer &&
      !gameState.wildChildTransformed &&
      gameState.wildChildModelId &&
      victims.some((v) => v.playerId === gameState.wildChildModelId)
  );

  return {
    updatedPlayers: cloned,
    victims,
    hunterPendingPlayerId,
    elderShieldTriggered,
    elderShieldUsedNext,
    rustyKnightPendingWolfIdNext,
    wildChildTransformedNow,
  };
}

export function getPhaseLabel(
  phase: GamePhase,
  nightStep?: NightStepId | null,
  gameState?: Partial<RoomGameState> | null
): string {
  if (phase.startsWith("NIGHT_") && nightStep) {
    const stepLabels: Record<Exclude<NightStepId, null>, string> = {
      voleur: "Nuit • Le Voleur",
      cupidon: "Nuit • Cupidon",
      "enfant-sauvage": "Nuit • Enfant Sauvage",
      fratrie: "Nuit • Sœurs & Frères",
      salvateur: "Nuit • Le Salvateur",
      voyante: "Nuit • La Voyante",
      renard: "Nuit • Le Renard",
      comedien: "Nuit • Le Comédien",
      loups: "Nuit • Les Loups-Garous",
      "loup-mystique": "Nuit • Loup Noir Mystique",
      "loup-blanc": "Nuit • Loup-Garou Blanc",
      "grand-mechant-loup": "Nuit • Grand Méchant Loup",
      sorciere: "Nuit • La Sorcière",
      corbeau: "Nuit • Le Corbeau",
      pyromane: "Nuit • Le Pyromane",
      "joueur-de-flute": "Nuit • Joueur de Flûte",
    };
    return stepLabels[nightStep];
  }

  switch (phase) {
    case "LOBBY":
      return "Salon d'attente";
    case "ROLE_REVEAL":
      return "Découverte des Rôles";
    case "NIGHT_CUPIDON":
      return "Nuit • Éveil des Destins";
    case "NIGHT_SEER":
      return "Nuit • Éclaireurs";
    case "NIGHT_WEREWOLVES":
      return "Nuit • Les Loups-Garous";
    case "NIGHT_WITCH":
      return "Nuit • Ombres & Potions";
    case "DAY_ANNOUNCEMENT":
      return "Aube sur le Village";
    case "DAY_VOTE":
      return gameState?.voteMode === "MAYOR_ELECTION"
        ? "Élection du Maire"
        : "Conseil & Vote du Jour";
    case "HUNTER_SHOT":
      return "Tir du Chasseur";
    case "VICTORY":
      return "Fin de Partie";
  }
}

export function getHumanNarratorScript(
  phase: GamePhase,
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber: number
): string {
  const step = gameState.nightStep;
  const corbeauTarget = gameState.corbeauTargetId
    ? players.find((p) => p.id === gameState.corbeauTargetId)
    : null;

  switch (phase) {
    case "ROLE_REVEAL":
      return "Demandez à chacun de regarder discrètement son rôle (appui long sur sa carte) puis d'appuyer sur Prêt. Lorsque tout le monde est prêt, lancez la première nuit.";
    case "NIGHT_CUPIDON":
      if (step === "voleur") {
        return "Avant que la nuit ne s'épaississe, le Voleur ouvre les yeux, examine les deux cartes écartées et choisit s'il échange son destin.";
      }
      if (step === "enfant-sauvage") {
        return "Villageois, gardez les yeux clos. L'Enfant Sauvage choisit secrètement son modèle.";
      }
      if (step === "fratrie") {
        return "Les Deux Sœurs ou Trois Frères se reconnaissent en silence, puis referment les yeux.";
      }
      return `Nuit ${turnNumber} : Tout le village ferme les yeux. Cupidon se réveille, désigne deux amoureux et se rendort.`;
    case "NIGHT_SEER":
      if (step === "salvateur") {
        return "Le Salvateur ouvre les yeux, désigne le joueur qu'il protège cette nuit, puis referme les yeux.";
      }
      if (step === "renard") {
        return "Le Renard se réveille et désigne un groupe de trois voisins à flairer.";
      }
      if (step === "comedien") {
        return "Le Comédien ouvre sa loge secrète et choisit s'il endosse l'un de ses masques disponibles pour cette nuit.";
      }
      return "La Voyante se réveille, observe secrètement l'identité d'un joueur, puis se rendort.";
    case "NIGHT_WEREWOLVES":
      if (step === "loup-mystique") {
        return "Le Loup-Garou Noir (Mystique) rouvre discrètement les yeux pour sonder l'identité réelle d'un villageois.";
      }
      if (step === "loup-blanc") {
        return "La meute s'endort. Le Loup-Garou Blanc rouvre les yeux et choisit s'il élimine un autre loup cette nuit.";
      }
      if (step === "grand-mechant-loup") {
        return "Le Grand Méchant Loup reste éveillé seul et dévore une seconde victime.";
      }
      return "Les Loups-Garous ouvrent les yeux, se concertent en silence pour désigner une proie, puis se rendorment.";
    case "NIGHT_WITCH":
      if (step === "corbeau") {
        return "Le Corbeau désigne la personne qui recevra deux voix supplémentaires contre elle au lever du jour.";
      }
      if (step === "pyromane") {
        return "Le Pyromane étend sa traînée d'huile sur jusqu'à deux habitants — ou embrase ses cibles marquées.";
      }
      if (step === "joueur-de-flute") {
        return "Le Joueur de Flûte charme jusqu'à deux habitants silencieux, puis se rendort.";
      }
      return "La Sorcière se réveille. Indiquez-lui la cible nocturne afin qu'elle décide d'utiliser ou non sa potion de vie ou de mort.";
    case "DAY_ANNOUNCEMENT": {
      const names = gameState.nightVictims.map((v) => v.pseudo);
      const extras: string[] = [];
      if (gameState.bearGrowledTonight) {
        extras.push("L'ours du Montreur grogne sourdement ce matin !");
      }
      if (corbeauTarget) {
        extras.push(
          `Une marque du Corbeau pèse sur ${corbeauTarget.pseudo} (+2 voix).`
        );
      }
      if (names.length === 0) {
        return `Le village se réveille ! Annoncez à voix haute : aucune victime n'est tombée cette nuit.${extras.length ? " " + extras.join(" ") : ""}`;
      }
      return `Le village se réveille. Annoncez tristement l'élimination de : ${names.join(", ")}.${extras.length ? " " + extras.join(" ") : ""}`;
    }
    case "DAY_VOTE":
      if (gameState.voteMode === "MAYOR_ELECTION") {
        return "Organisez l'élection du Maire ! Laissez les volontaires se présenter brièvement, puis chacun vote pour le premier Maire du village (sa voix comptera double).";
      }
      return corbeauTarget
        ? `Lancez les débats ! Rappelez que ${corbeauTarget.pseudo} subit la malédiction du Corbeau (+2 voix) et demandez à chacun de voter.`
        : "Lancez les débats ! Laissez les survivants argumenter, puis invitez chaque joueur vivant à voter sur son téléphone.";
    case "HUNTER_SHOT": {
      const hunter = players.find(
        (p) => p.id === gameState.hunterPendingPlayerId
      );
      return `Le Chasseur (${hunter?.pseudo ?? "inconnu"}) est tombé ! Il doit immédiatement désigner sa dernière cible.`;
    }
    case "VICTORY":
      return `${gameState.winnerTitle ?? "Fin de partie"} — ${gameState.winnerReason ?? ""}`;
    default:
      return "Préparez la partie dans le salon.";
  }
}

export function getAutoNarratorSpeech(
  phase: GamePhase,
  gameState: RoomGameState,
  turnNumber: number,
  players: RoomPlayerRecord[] = []
): string {
  const step = gameState.nightStep;
  const corbeauTarget = gameState.corbeauTargetId
    ? players.find((p) => p.id === gameState.corbeauTargetId)
    : null;

  switch (phase) {
    case "ROLE_REVEAL":
      return "Le village s'installe sous la lune. Maintenez votre carte pour mémoriser votre rôle secret.";
    case "NIGHT_CUPIDON":
      if (step === "voleur") {
        return "La nuit tombe. Le Voleur examine deux destins secrets dans l'ombre avant le sommeil du village.";
      }
      if (step === "enfant-sauvage") {
        return "Cupidon s'endort. L'Enfant Sauvage se réveille et choisit son modèle.";
      }
      if (step === "fratrie") {
        return "Les Deux Sœurs et les Trois Frères ouvrent les yeux un instant pour se reconnaître en silence.";
      }
      return "La nuit tombe sur le village. Tout le monde ferme les yeux. Cupidon se réveille et unit deux amoureux.";
    case "NIGHT_SEER":
      if (step === "salvateur") {
        return `La nuit ${turnNumber} enveloppe le hameau. Le Salvateur s'éveille et protège un habitant de son bouclier.`;
      }
      if (step === "renard") {
        return "Le Renard se faufile dans la brume pour flairer la trace des loups.";
      }
      if (step === "comedien") {
        return "Dans sa loge nocturne, le Comédien choisit l'un de ses masques et s'empare de son pouvoir.";
      }
      return `La nuit ${turnNumber} s'étend sur le village. La Voyante ouvre les yeux et sonde l'âme d'un joueur.`;
    case "NIGHT_WEREWOLVES":
      if (step === "loup-mystique") {
        return "Le Loup-Garou Noir ouvre ses yeux mystiques pour lire le rôle secret d'un villageois.";
      }
      if (step === "loup-blanc") {
        return "La meute s'endort. Seul le Loup-Garou Blanc rouvre les yeux et décide s'il frappe l'un des siens.";
      }
      if (step === "grand-mechant-loup") {
        return "Les loups s'endorment, mais le Grand Méchant Loup se réveille encore affamé pour chasser une deuxième proie.";
      }
      return "La nuit est profonde. Les Loups-Garous se réveillent et désignent leur proie en silence.";
    case "NIGHT_WITCH":
      if (step === "corbeau") {
        return "Le Corbeau s'envole dans la nuit et dépose sa malédiction sur un habitant.";
      }
      if (step === "pyromane") {
        return "Une odeur d'huile et de cendres flotte dans la ruelle : le Pyromane prépare sa flamme.";
      }
      if (step === "joueur-de-flute") {
        return "Le Joueur de Flûte entonne une douce mélodie et ensorcelle deux nouveaux esprits.";
      }
      return "Les loups se rendorment. La Sorcière s'éveille devant ses deux potions.";
    case "DAY_ANNOUNCEMENT": {
      const victims = gameState.nightVictims;
      const parts: string[] = [];

      if (victims.length === 0) {
        if (gameState.elderShieldTriggeredTonight) {
          parts.push(
            "Le jour se lève. Une force ancienne a repoussé l'attaque nocturne : aucune victime au village."
          );
        } else if (
          gameState.salvateurSavedTonight ||
          gameState.witchSaveTonight
        ) {
          parts.push(
            "L'aube éclaire le village. Grâce à une protection salutaire durant la nuit, personne n'a péri !"
          );
        } else if (gameState.infectTonight) {
          parts.push(
            "Le soleil se lève sur un village silencieux. Aucun corps n'est retrouvé ce matin, mais le danger rôde dans l'ombre."
          );
        } else {
          parts.push(
            "Le jour se lève paisiblement sur le village : tout le monde a survécu à la nuit."
          );
        }
      } else if (victims.length === 1) {
        if (victims[0].cause === "tetanos") {
          parts.push(
            `Le village découvre avec stupeur que ${victims[0].pseudo} vient de succomber à une blessure empoisonnée de la nuit précédente.`
          );
        } else if (victims[0].cause === "pyromane") {
          parts.push(
            `Des cendres fumantes s'élèvent à l'aube : ${victims[0].pseudo} a péri dans les flammes du Pyromane.`
          );
        } else {
          parts.push(
            `Le village découvre avec effroi que ${victims[0].pseudo} ne s'est pas réveillé cette nuit.`
          );
        }
      } else {
        const names = victims.map((v) => v.pseudo).join(" et ");
        parts.push(
          `Terrible matinée au village : ${names} ont péri durant la nuit.`
        );
      }

      if (gameState.bearGrowledTonight) {
        parts.push("Attention, l'ours du montreur grogne sourdement au réveil !");
      }

      if (corbeauTarget) {
        parts.push(
          `Une plume noire marque la porte de ${corbeauTarget.pseudo}, qui subit déjà deux voix contre lui.`
        );
      }

      return parts.join(" ");
    }
    case "DAY_VOTE":
      if (gameState.voteMode === "MAYOR_ELECTION") {
        return "Avant les premiers soupçons, le village doit élire son Maire. Sa voix comptera double lors de chaque conseil.";
      }
      return corbeauTarget
        ? `Le conseil du village est ouvert. Rappelons que ${corbeauTarget.pseudo} porte la malédiction du Corbeau. Débattez avec prudence et votez.`
        : "Le conseil du village est ouvert. Débattez avec prudence et désignez un suspect.";
    case "HUNTER_SHOT":
      return "Dans son dernier souffle, le Chasseur arme son fusil et désigne sa dernière cible.";
    case "VICTORY":
      return `${gameState.winnerTitle ?? "La partie est terminée."}. ${gameState.winnerReason ?? ""}`;
    default:
      return "";
  }
}

export function didPlayerWinVictory(
  player: RoomPlayerRecord | null,
  gameState: RoomGameState
): boolean | null {
  if (!player || !gameState.winnerCamp) return null;

  if (gameState.winnerCamp === "amoureux") {
    return Boolean(gameState.lovers?.includes(player.id));
  }

  if (gameState.winnerCamp === "solitaire") {
    const title = gameState.winnerTitle ?? "";
    if (title.includes("Ange")) return player.role === "ange";
    if (title.includes("Flûte")) return player.role === "joueur-de-flute";
    if (title.includes("Pyromane")) return player.role === "pyromane";
    if (title.includes("Loup-Garou Blanc")) {
      return player.role === "loup-garou-blanc";
    }
    return false;
  }

  if (gameState.winnerCamp === "loup") {
    return isEffectiveWolf(player, gameState);
  }

  if (gameState.winnerCamp === "village") {
    return (
      !isEffectiveWolf(player, gameState) &&
      player.role !== "loup-garou-blanc" &&
      player.role !== "joueur-de-flute" &&
      player.role !== "ange" &&
      player.role !== "pyromane"
    );
  }

  return null;
}

export function predictNextNarrationText(
  phase: GamePhase,
  gameState: RoomGameState,
  turnNumber: number,
  players: RoomPlayerRecord[]
): string | null {
  if (phase === "ROLE_REVEAL") {
    const first = resolveNextNightStep(
      "ROLE_REVEAL",
      null,
      players,
      gameState,
      1
    );
    if (!first) return null;
    return getAutoNarratorSpeech(
      first.phase,
      { ...gameState, nightStep: first.nightStep },
      1,
      players
    );
  }

  if (phase.startsWith("NIGHT_")) {
    const next = resolveNextNightStep(
      phase,
      gameState.nightStep,
      players,
      gameState,
      turnNumber
    );
    if (!next) return null;
    return getAutoNarratorSpeech(
      next.phase,
      { ...gameState, nightStep: next.nightStep },
      turnNumber,
      players
    );
  }

  if (phase === "DAY_ANNOUNCEMENT") {
    const alive = players.filter((p) => p.is_alive);
    const willElectMayor =
      turnNumber === 1 &&
      gameState.mayorEnabled &&
      !gameState.mayorPlayerId &&
      !gameState.mayorElectionDone &&
      alive.length >= 3;
    return getAutoNarratorSpeech(
      "DAY_VOTE",
      {
        ...gameState,
        voteMode: willElectMayor ? "MAYOR_ELECTION" : "ELIMINATION",
      },
      turnNumber,
      players
    );
  }

  if (phase === "DAY_VOTE" && gameState.voteMode === "MAYOR_ELECTION") {
    return getAutoNarratorSpeech(
      "DAY_VOTE",
      { ...gameState, voteMode: "ELIMINATION" },
      turnNumber,
      players
    );
  }

  return null;
}
