export type RoleFaction = "loup" | "village" | "solitaire";

export type RoleIconName =
  | "moon"
  | "wolf"
  | "flame"
  | "user"
  | "eye"
  | "flask"
  | "crosshair"
  | "heart"
  | "sparkles"
  | "shield"
  | "scroll"
  | "smile"
  | "paw"
  | "feather"
  | "bird"
  | "dog"
  | "crown"
  | "music"
  | "biohazard"
  | "sword"
  | "users"
  | "pawprint";

export interface RoleAuraTheme {
  /** Couleur principale de l'aura (hex) */
  primary: string;
  /** Couleur secondaire pour les halos et dégradés */
  secondary: string;
  /** Ombre lumineuse autour de la carte révélée */
  glowShadow: string;
  /** Classe de bordure lumineuse */
  borderClass: string;
  /** Classe de badge de faction */
  badgeClass: string;
  /** Dégradé de fond de la face révélée */
  surfaceGradient: string;
}

export interface GameRole {
  id: string;
  name: string;
  subtitle: string;
  faction: RoleFaction;
  factionLabel: string;
  icon: RoleIconName;
  ability: string;
  lore: string;
  maxCount: number;
  minPlayers: number;
  aura: RoleAuraTheme;
}

export type RoleComposition = Record<string, number>;

export type AvatarPresetId =
  | "wolf"
  | "moon"
  | "crown"
  | "eye"
  | "flask"
  | "flame"
  | "shield"
  | "sparkles"
  | "bird"
  | "fox"
  | "music"
  | "sword";

export interface PlayerProfile {
  nickname: string;
  avatarType: "preset" | "upload";
  avatarPreset: AvatarPresetId;
  avatarDataUrl: string | null;
  isOwner: boolean;
}

export type DemoGamePhase = "distribution" | "night" | "dawn" | "vote";

export type NarratorMode = "auto" | "human";

export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT_CUPIDON"
  | "NIGHT_SEER"
  | "NIGHT_WEREWOLVES"
  | "NIGHT_WITCH"
  | "DAY_ANNOUNCEMENT"
  | "DAY_VOTE"
  | "HUNTER_SHOT"
  | "VICTORY";

export type NightStepId =
  | "cupidon"
  | "enfant-sauvage"
  | "fratrie"
  | "salvateur"
  | "voyante"
  | "renard"
  | "loups"
  | "loup-blanc"
  | "grand-mechant-loup"
  | "sorciere"
  | "corbeau"
  | "joueur-de-flute"
  | null;

export interface NightVictimEntry {
  playerId: string;
  pseudo: string;
  roleId: string | null;
  cause:
    | "loups"
    | "sorciere"
    | "chagrin"
    | "village"
    | "chasseur"
    | "tetanos";
}

export interface GameLogEntry {
  id: string;
  turn: number;
  phase: "night" | "day" | "system";
  text: string;
  timestamp: string;
}

export type PlayerReactionType = "suspect" | "innocent" | "shock" | "wolf";

export interface PlayerReactionEntry {
  playerId: string;
  reaction: PlayerReactionType;
  sentAt: number;
}

export interface RoomGameState {
  lovers: [string, string] | null;
  witchLifeUsed: boolean;
  witchDeathUsed: boolean;
  wolfTargetId: string | null;
  witchSaveTonight: boolean;
  witchKillTargetId: string | null;
  seerInspectedId: string | null;
  cupidonTargets: string[];
  nightVictims: NightVictimEntry[];
  lastAnnouncement: string;
  hunterPendingPlayerId: string | null;
  hunterReturnPhase: "DAY_VOTE" | "NIGHT" | null;
  winnerCamp: "village" | "loup" | "solitaire" | "amoureux" | null;
  winnerTitle: string | null;
  winnerReason: string | null;
  phaseDeadline: string | null;
  readyUserIds: string[];
  elderShieldUsed: boolean;
  nightStep: NightStepId;
  salvateurLastTargetId: string | null;
  salvateurTargetId: string | null;
  salvateurSavedTonight: boolean;
  foxUsedWrongly: boolean;
  foxCheckedTonight: boolean;
  foxLastResult: { names: string[]; hasWolf: boolean } | null;
  corbeauTargetId: string | null;
  infectUsed: boolean;
  infectTonight: boolean;
  infectedPlayerIds: string[];
  grandMechantSecondTargetId: string | null;
  charmedPlayerIds: string[];
  piperTargetsTonight: string[];
  wildChildModelId: string | null;
  wildChildTransformed: boolean;
  servanteUsed: boolean;
  rustyKnightPendingWolfId: string | null;
  idiotSparedPlayerIds: string[];
  loupBlancTargetId: string | null;
  bearGrowledTonight: boolean;
  elderShieldTriggeredTonight: boolean;
  eventLog: GameLogEntry[];
  reactions: Record<string, PlayerReactionEntry>;
}

export interface RoomRecord {
  id: string;
  code: string;
  host_user_id: string;
  narrator_mode: NarratorMode;
  phase: GamePhase;
  turn_number: number;
  role_composition: RoleComposition;
  game_state: RoomGameState;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayerRecord {
  id: string;
  room_id: string;
  user_id: string;
  pseudo: string;
  avatar_data: string | null;
  is_owner: boolean;
  role: string | null;
  is_alive: boolean;
  has_voted: boolean;
  target_id: string | null;
  joined_at: string;
}
