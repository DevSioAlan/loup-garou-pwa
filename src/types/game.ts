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
  | "feather";

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
  | "sparkles";

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

export interface NightVictimEntry {
  playerId: string;
  pseudo: string;
  roleId: string | null;
  cause: "loups" | "sorciere" | "chagrin" | "village" | "chasseur";
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
