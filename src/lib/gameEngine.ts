import { ROLE_BY_ID } from "@/data/roles";
import { AVATAR_PRESETS } from "@/lib/profileStorage";
import type {
  AvatarPresetId,
  GamePhase,
  NightVictimEntry,
  PlayerProfile,
  RoleComposition,
  RoomGameState,
  RoomPlayerRecord,
} from "@/types/game";

export const WOLF_ROLE_IDS = new Set([
  "loup-garou",
  "loup-garou-blanc",
  "grand-mechant-loup",
]);

export function isWolfRole(roleId: string | null | undefined): boolean {
  return Boolean(roleId && WOLF_ROLE_IDS.has(roleId));
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
  };
}

/**
 * Génère un code de salon aléatoire à 4 lettres majuscules lisibles.
 */
export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function encodeProfileAvatar(profile: PlayerProfile): string {
  if (profile.avatarType === "upload" && profile.avatarDataUrl) {
    return profile.avatarDataUrl;
  }
  return `preset:${profile.avatarPreset}`;
}

export function decodeAvatarToProfile(
  avatarData: string | null,
  pseudo: string,
  isOwner: boolean
): PlayerProfile {
  if (avatarData && avatarData.startsWith("data:image/")) {
    return {
      nickname: pseudo,
      avatarType: "upload",
      avatarPreset: "wolf",
      avatarDataUrl: avatarData,
      isOwner,
    };
  }

  const presetCandidate = avatarData?.startsWith("preset:")
    ? (avatarData.slice("preset:".length) as AvatarPresetId)
    : "wolf";
  const validPreset = AVATAR_PRESETS.some((p) => p.id === presetCandidate)
    ? presetCandidate
    : "wolf";

  return {
    nickname: pseudo,
    avatarType: "preset",
    avatarPreset: validPreset,
    avatarDataUrl: null,
    isOwner,
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Distribue aléatoirement les rôles configurés aux joueurs connectés.
 * Adapte proprement le deck si le nombre de joueurs diffère (ex. tests rapides).
 */
export function dealRolesToPlayers(
  players: RoomPlayerRecord[],
  composition: RoleComposition
): Array<{ playerId: string; roleId: string }> {
  const count = players.length;
  if (count === 0) return [];

  const fullDeck: string[] = [];
  for (const [roleId, qty] of Object.entries(composition)) {
    for (let i = 0; i < qty; i++) {
      fullDeck.push(roleId);
    }
  }

  let deck = fullDeck;
  if (deck.length < count) {
    while (deck.length < count) {
      deck.push("simple-villageois");
    }
  } else if (deck.length > count) {
    const wolves = deck.filter((r) => isWolfRole(r));
    const specials = deck.filter(
      (r) => !isWolfRole(r) && r !== "simple-villageois"
    );
    const villagers = deck.filter((r) => r === "simple-villageois");

    const trimmed: string[] = [];
    if (count >= 2 && wolves.length > 0) {
      trimmed.push(wolves[0]);
    }
    for (const s of specials) {
      if (trimmed.length < count) trimmed.push(s);
    }
    for (let i = 1; i < wolves.length && trimmed.length < count; i++) {
      trimmed.push(wolves[i]);
    }
    for (const v of villagers) {
      if (trimmed.length < count) trimmed.push(v);
    }
    while (trimmed.length < count) {
      trimmed.push("simple-villageois");
    }
    deck = trimmed;
  }

  const shuffledRoles = shuffleArray(deck);
  return players.map((player, idx) => ({
    playerId: player.id,
    roleId: shuffledRoles[idx] ?? "simple-villageois",
  }));
}

export function getPhaseDurationSeconds(phase: GamePhase): number | null {
  switch (phase) {
    case "ROLE_REVEAL":
      return 16;
    case "NIGHT_CUPIDON":
      return 22;
    case "NIGHT_SEER":
      return 20;
    case "NIGHT_WEREWOLVES":
      return 28;
    case "NIGHT_WITCH":
      return 24;
    case "DAY_ANNOUNCEMENT":
      return 10;
    case "DAY_VOTE":
      return 45;
    case "HUNTER_SHOT":
      return 22;
    case "LOBBY":
    case "VICTORY":
    default:
      return null;
  }
}

export function buildPhaseDeadline(phase: GamePhase): string | null {
  const sec = getPhaseDurationSeconds(phase);
  if (!sec) return null;
  return new Date(Date.now() + sec * 1000).toISOString();
}

export function hasAliveRole(
  players: RoomPlayerRecord[],
  roleId: string
): boolean {
  return players.some((p) => p.is_alive && p.role === roleId);
}

export function hasAliveWolf(players: RoomPlayerRecord[]): boolean {
  return players.some((p) => p.is_alive && isWolfRole(p.role));
}

/**
 * Calcule la prochaine phase nocturne disponible selon les rôles encore en vie.
 */
export function resolveNextNightPhase(
  currentPhase: GamePhase,
  players: RoomPlayerRecord[],
  turnNumber: number
): GamePhase {
  const sequence: GamePhase[] = [
    "NIGHT_CUPIDON",
    "NIGHT_SEER",
    "NIGHT_WEREWOLVES",
    "NIGHT_WITCH",
    "DAY_ANNOUNCEMENT",
  ];

  const startIndex =
    currentPhase === "ROLE_REVEAL" || currentPhase === "DAY_VOTE"
      ? 0
      : sequence.indexOf(currentPhase) + 1;

  for (let i = Math.max(0, startIndex); i < sequence.length; i++) {
    const candidate = sequence[i];
    if (candidate === "NIGHT_CUPIDON") {
      if (turnNumber === 1 && hasAliveRole(players, "cupidon")) {
        return "NIGHT_CUPIDON";
      }
      continue;
    }
    if (candidate === "NIGHT_SEER") {
      if (hasAliveRole(players, "voyante")) {
        return "NIGHT_SEER";
      }
      continue;
    }
    if (candidate === "NIGHT_WEREWOLVES") {
      if (hasAliveWolf(players)) {
        return "NIGHT_WEREWOLVES";
      }
      continue;
    }
    if (candidate === "NIGHT_WITCH") {
      if (hasAliveRole(players, "sorciere")) {
        return "NIGHT_WITCH";
      }
      continue;
    }
    return candidate;
  }

  return "DAY_ANNOUNCEMENT";
}

/**
 * Vérifie les conditions de victoire de chaque camp.
 */
export function evaluateVictory(
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber: number,
  justDiedIds: string[]
): {
  winnerCamp: RoomGameState["winnerCamp"];
  winnerTitle: string | null;
  winnerReason: string | null;
} {
  if (turnNumber === 1) {
    const deadAngel = players.find(
      (p) => justDiedIds.includes(p.id) && p.role === "ange"
    );
    if (deadAngel) {
      return {
        winnerCamp: "solitaire",
        winnerTitle: `Victoire de l'Ange (${deadAngel.pseudo})`,
        winnerReason:
          "L'Ange a été éliminé dès le tout premier tour et s'envole vers la victoire !",
      };
    }
  }

  const alive = players.filter((p) => p.is_alive);
  const aliveWolves = alive.filter((p) => isWolfRole(p.role));
  const aliveVillagers = alive.filter((p) => !isWolfRole(p.role));

  if (alive.length === 1 && alive[0].role === "loup-garou-blanc") {
    return {
      winnerCamp: "solitaire",
      winnerTitle: `Victoire du Loup-Garou Blanc (${alive[0].pseudo})`,
      winnerReason:
        "Le Loup-Garou Blanc a trahi la meute et dévoré le dernier survivant.",
    };
  }

  if (gameState.lovers && alive.length === 2) {
    const [a, b] = gameState.lovers;
    const aliveIds = new Set(alive.map((p) => p.id));
    if (aliveIds.has(a) && aliveIds.has(b)) {
      const pA = alive.find((p) => p.id === a);
      const pB = alive.find((p) => p.id === b);
      const mixed =
        Boolean(pA && pB) &&
        isWolfRole(pA?.role) !== isWolfRole(pB?.role);
      if (mixed) {
        return {
          winnerCamp: "amoureux",
          winnerTitle: "Victoire des Amoureux",
          winnerReason: `${pA?.pseudo} et ${pB?.pseudo} ont survécu ensemble à la Lune de Sang.`,
        };
      }
    }
  }

  if (aliveWolves.length === 0 && alive.length > 0) {
    return {
      winnerCamp: "village",
      winnerTitle: "Victoire du Village",
      winnerReason:
        "Tous les Loups-Garous ont été démasqués. La paix revient sur le hameau.",
    };
  }

  if (aliveWolves.length >= aliveVillagers.length && alive.length > 0) {
    return {
      winnerCamp: "loup",
      winnerTitle: "Victoire des Loups-Garous",
      winnerReason:
        "La meute règne désormais sans partage sous la Lune de Sang.",
    };
  }

  return {
    winnerCamp: null,
    winnerTitle: null,
    winnerReason: null,
  };
}

/**
 * Calcule la cible majoritaire des votes d'un groupe de joueurs.
 */
export function tallyTargetFromVoters(
  voters: RoomPlayerRecord[]
): { targetId: string | null; isTie: boolean } {
  const counts = new Map<string, number>();
  for (const voter of voters) {
    if (!voter.target_id) continue;
    counts.set(voter.target_id, (counts.get(voter.target_id) ?? 0) + 1);
  }

  if (counts.size === 0) return { targetId: null, isTie: false };

  let bestId: string | null = null;
  let bestCount = 0;
  let tie = false;

  for (const [targetId, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestId = targetId;
      tie = false;
    } else if (count === bestCount) {
      tie = true;
    }
  }

  return { targetId: tie ? null : bestId, isTie: tie };
}

/**
 * Applique un ou plusieurs décès initiaux en gérant la chaîne Amoureux + Chasseur.
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
} {
  const updatedPlayers = players.map((p) => ({ ...p }));
  const victims: NightVictimEntry[] = [];
  let elderShieldTriggered = gameState.elderShieldUsed;

  const queue = [...initialDeaths];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || processed.has(item.playerId)) continue;
    const player = updatedPlayers.find((p) => p.id === item.playerId);
    if (!player || !player.is_alive) continue;

    if (
      item.cause === "loups" &&
      player.role === "ancien" &&
      !elderShieldTriggered
    ) {
      elderShieldTriggered = true;
      processed.add(item.playerId);
      continue;
    }

    processed.add(item.playerId);
    player.is_alive = false;
    victims.push({
      playerId: player.id,
      pseudo: player.pseudo,
      roleId: player.role,
      cause: item.cause,
    });

    if (gameState.lovers) {
      const [a, b] = gameState.lovers;
      const partnerId = a === player.id ? b : b === player.id ? a : null;
      if (partnerId && !processed.has(partnerId)) {
        queue.push({ playerId: partnerId, cause: "chagrin" });
      }
    }
  }

  const deadHunter = victims.find((v) => v.roleId === "chasseur");

  return {
    updatedPlayers,
    victims,
    hunterPendingPlayerId: deadHunter ? deadHunter.playerId : null,
    elderShieldTriggered,
  };
}

export function getPhaseLabel(phase: GamePhase): string {
  switch (phase) {
    case "LOBBY":
      return "Salon d'attente";
    case "ROLE_REVEAL":
      return "Découverte des Rôles";
    case "NIGHT_CUPIDON":
      return "Nuit — Cupidon";
    case "NIGHT_SEER":
      return "Nuit — Voyante";
    case "NIGHT_WEREWOLVES":
      return "Nuit — Loups-Garous";
    case "NIGHT_WITCH":
      return "Nuit — Sorcière";
    case "DAY_ANNOUNCEMENT":
      return "Aube — Annonce";
    case "DAY_VOTE":
      return "Jour — Vote du Village";
    case "HUNTER_SHOT":
      return "Dernier Tir du Chasseur";
    case "VICTORY":
      return "Fin de la Partie";
  }
}

export function getHumanNarratorScript(
  phase: GamePhase,
  players: RoomPlayerRecord[],
  gameState: RoomGameState,
  turnNumber: number
): {
  headline: string;
  script: string;
  actionHint: string;
} {
  const aliveRoleNames = players
    .filter((p) => p.is_alive && p.role)
    .map((p) => ROLE_BY_ID[p.role!]?.name ?? p.role)
    .filter((v, i, a) => a.indexOf(v) === i);

  switch (phase) {
    case "ROLE_REVEAL":
      return {
        headline: "Distribution secrète",
        script:
          "« Chacun maintient son doigt sur sa carte secrète pour découvrir son identité. Ne laissez personne voir votre écran ! »",
        actionHint: `Rôles en jeu : ${aliveRoleNames.join(", ")}.`,
      };
    case "NIGHT_CUPIDON":
      return {
        headline: "Appel de Cupidon (Nuit 1)",
        script:
          "« Le village s'endort... Cupidon se réveille et désigne deux joueurs sur son téléphone qui seront liés par l'amour jusqu'à la fin. »",
        actionHint:
          gameState.cupidonTargets.length === 2
            ? "Cupidon a lié deux amoureux. Vous pouvez passer à l'étape suivante."
            : "En attente du choix de Cupidon.",
      };
    case "NIGHT_SEER":
      return {
        headline: "Appel de la Voyante",
        script:
          "« Cupidon se rendort. La Voyante ouvre les yeux et choisit un joueur sur son écran pour percer sa véritable nature. »",
        actionHint: gameState.seerInspectedId
          ? "La Voyante a consulté sa vision. Vous pouvez continuer."
          : "En attente de la Voyante.",
      };
    case "NIGHT_WEREWOLVES": {
      const wolvesCount = players.filter(
        (p) => p.is_alive && isWolfRole(p.role)
      ).length;
      const wolvesVoted = players.filter(
        (p) => p.is_alive && isWolfRole(p.role) && p.has_voted
      ).length;
      return {
        headline: `Appel des Loups-Garous (Nuit ${turnNumber})`,
        script:
          "« La Voyante ferme les yeux. Les Loups-Garous se réveillent en silence, se reconnaissent et votent ensemble sur leur téléphone pour dévorer une victime. »",
        actionHint: `${wolvesVoted}/${wolvesCount} loup(s) ont voté.`,
      };
    }
    case "NIGHT_WITCH":
      return {
        headline: "Appel de la Sorcière",
        script:
          "« Les Loups-Garous se rendorment. La Sorcière se réveille, observe la victime de la nuit et choisit d'utiliser ou non sa potion de vie ou de mort. »",
        actionHint: `Potions restantes — Vie : ${
          gameState.witchLifeUsed ? "utilisée" : "dispo"
        } • Mort : ${gameState.witchDeathUsed ? "utilisée" : "dispo"}.`,
      };
    case "DAY_ANNOUNCEMENT":
      return {
        headline: `Réveil du Village (Jour ${turnNumber})`,
        script: `« Le jour se lève sur le village ! Tout le monde ouvre les yeux. ${
          gameState.lastAnnouncement || "Découvrons ce qu'il s'est passé cette nuit."
        } »`,
        actionHint: "Laissez le village réagir puis lancez le débat et le vote.",
      };
    case "DAY_VOTE": {
      const aliveCount = players.filter((p) => p.is_alive).length;
      const votedCount = players.filter(
        (p) => p.is_alive && p.has_voted
      ).length;
      return {
        headline: "Débat & Vote du Village",
        script:
          "« Débattez entre vous pour démasquer les loups, puis votez directement sur votre téléphone contre le joueur que vous souhaitez éliminer. »",
        actionHint: `${votedCount}/${aliveCount} villageois vivants ont voté.`,
      };
    }
    case "HUNTER_SHOT": {
      const hunter = players.find(
        (p) => p.id === gameState.hunterPendingPlayerId
      );
      return {
        headline: "Dernier souffle du Chasseur",
        script: `« ${
          hunter?.pseudo ?? "Le Chasseur"
        } est tombé, mais dans son dernier souffle il emporte quelqu'un avec lui ! Qu'il désigne sa cible sur son écran. »`,
        actionHint: "En attente du tir du Chasseur.",
      };
    }
    case "VICTORY":
      return {
        headline: gameState.winnerTitle ?? "Fin de la partie",
        script: `« ${
          gameState.winnerReason ?? "La partie est terminée !"
        } Félicitations aux survivants ! »`,
        actionHint: "Vous pouvez relancer une nouvelle partie depuis le salon.",
      };
    case "LOBBY":
    default:
      return {
        headline: "Préparation du salon",
        script: "En attente des joueurs avant de lancer la partie.",
        actionHint: "",
      };
  }
}

export function getAutoNarratorSpeech(
  phase: GamePhase,
  gameState: RoomGameState,
  turnNumber: number
): string {
  switch (phase) {
    case "ROLE_REVEAL":
      return "La partie commence. Maintenez votre doigt sur votre carte pour découvrir votre rôle en secret.";
    case "NIGHT_CUPIDON":
      return "La nuit tombe sur le village. Cupidon se réveille et choisit deux amoureux.";
    case "NIGHT_SEER":
      return "La Voyante ouvre les yeux et choisit un joueur pour connaître son secret.";
    case "NIGHT_WEREWOLVES":
      return `Nuit ${turnNumber}. Les Loups-Garous se réveillent et désignent leur victime.`;
    case "NIGHT_WITCH":
      return "Les loups se rendorment. La Sorcière se réveille et observe la victime de la nuit.";
    case "DAY_ANNOUNCEMENT":
      return `Le jour se lève sur le village. ${
        gameState.lastAnnouncement || "Tout le monde ouvre les yeux."
      }`;
    case "DAY_VOTE":
      return "Le débat est ouvert. Votez sur votre téléphone pour éliminer un suspect.";
    case "HUNTER_SHOT":
      return "Le Chasseur est éliminé ! Il doit immédiatement désigner sa dernière cible.";
    case "VICTORY":
      return `${gameState.winnerTitle ?? "Fin de la partie."} ${
        gameState.winnerReason ?? ""
      }`;
    default:
      return "";
  }
}
