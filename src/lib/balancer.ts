import { GAME_ROLES, ROLE_BY_ID } from "@/data/roles";
import type { GameRole, RoleComposition } from "@/types/game";

export interface CompositionPresetInfo {
  label: string;
  composition: RoleComposition;
}

export interface CompositionStats {
  total: number;
  wolves: number;
  village: number;
  solitaire: number;
  balanceLabel: string;
  balanceTone: "balanced" | "wolves" | "village" | "mismatch";
}

const VARIANT_POOLS: Array<{
  label: string;
  villagePriority: string[];
  specialWolves: string[];
  solitaires: string[];
}> = [
  {
    label: "Classique Équilibrée",
    villagePriority: [
      "voyante",
      "sorciere",
      "chasseur",
      "cupidon",
      "salvateur",
      "corbeau",
      "montreur-dours",
      "petite-fille",
      "ancien",
      "idiot-du-village",
    ],
    specialWolves: [
      "loup-garou-blanc",
      "infect-pere-des-loups",
      "grand-mechant-loup",
    ],
    solitaires: ["enfant-sauvage", "joueur-de-flute", "ange"],
  },
  {
    label: "Nuit des Arcanes",
    villagePriority: [
      "voyante",
      "salvateur",
      "sorciere",
      "renard",
      "servante-devouee",
      "ancien",
      "chasseur",
      "petite-fille",
      "cupidon",
      "idiot-du-village",
    ],
    specialWolves: [
      "infect-pere-des-loups",
      "grand-mechant-loup",
      "loup-garou-blanc",
    ],
    solitaires: ["joueur-de-flute", "ange", "enfant-sauvage"],
  },
  {
    label: "Chaos & Trahisons",
    villagePriority: [
      "voyante",
      "corbeau",
      "chasseur",
      "chevalier-epee-rouillee",
      "cupidon",
      "sorciere",
      "idiot-du-village",
      "servante-devouee",
      "salvateur",
      "renard",
    ],
    specialWolves: [
      "loup-garou-blanc",
      "infect-pere-des-loups",
      "grand-mechant-loup",
    ],
    solitaires: ["enfant-sauvage", "joueur-de-flute", "ange"],
  },
  {
    label: "Bastion du Hameau",
    villagePriority: [
      "salvateur",
      "montreur-dours",
      "voyante",
      "chevalier-epee-rouillee",
      "ancien",
      "sorciere",
      "chasseur",
      "corbeau",
      "petite-fille",
      "cupidon",
    ],
    specialWolves: [
      "grand-mechant-loup",
      "infect-pere-des-loups",
      "loup-garou-blanc",
    ],
    solitaires: ["ange", "enfant-sauvage", "joueur-de-flute"],
  },
];

/**
 * Calcule une composition équilibrée pour N joueurs (4 à 20).
 * L'index `variantIndex` permet de générer plusieurs combinaisons valides et amusantes.
 */
export function generateBalancedComposition(
  rawCount: number,
  variantIndex = 0
): CompositionPresetInfo {
  const playerCount = Math.max(4, Math.min(20, Math.round(rawCount)));
  const variant =
    VARIANT_POOLS[((variantIndex % VARIANT_POOLS.length) + VARIANT_POOLS.length) % VARIANT_POOLS.length];

  const composition: RoleComposition = Object.fromEntries(
    GAME_ROLES.map((role) => [role.id, 0])
  );

  // 1. Nombre cible de loups selon la taille du village (~1 loup pour 4 joueurs)
  let totalWolves = 1;
  if (playerCount >= 6 && playerCount <= 9) totalWolves = 2;
  else if (playerCount >= 10 && playerCount <= 14) totalWolves = 3;
  else if (playerCount >= 15) totalWolves = 4;

  // À partir de 10+ joueurs, on peut introduire un loup spécial selon la variante
  let normalWolves = totalWolves;
  if (playerCount >= 10) {
    const firstSpecial = variant.specialWolves[0];
    if (
      firstSpecial &&
      (firstSpecial === "loup-garou-blanc" ||
        firstSpecial === "grand-mechant-loup" ||
        firstSpecial === "infect-pere-des-loups")
    ) {
      composition[firstSpecial] = 1;
      normalWolves -= 1;
    }
  }
  if (playerCount >= 15 && normalWolves >= 2) {
    const secondSpecial = variant.specialWolves[1];
    if (secondSpecial && composition[secondSpecial] === 0) {
      composition[secondSpecial] = 1;
      normalWolves -= 1;
    }
  }
  composition["loup-garou"] = Math.max(1, normalWolves);

  let assigned = Object.values(composition).reduce((sum, n) => sum + n, 0);

  // 2. Ajout éventuel d'un rôle solitaire / ambigu (Enfant Sauvage ou Ange) à 10+ joueurs
  if (playerCount >= 10 && variantIndex % 2 === 1) {
    const solitaireId = variant.solitaires[0];
    if (solitaireId && assigned < playerCount) {
      composition[solitaireId] = 1;
      assigned += 1;
    }
  }
  if (playerCount >= 13 && variantIndex % 4 >= 2) {
    const secondSolitaire = variant.solitaires[1];
    if (secondSolitaire && composition[secondSolitaire] === 0 && assigned < playerCount) {
      composition[secondSolitaire] = 1;
      assigned += 1;
    }
  }

  // 3. Ajout progressif des rôles clés du Village selon le nombre de joueurs
  // Objectif : garder au moins ~1-3 Simples Villageois dès 6+ joueurs pour la déduction
  const targetMinVillagers =
    playerCount <= 5 ? 1 : playerCount <= 8 ? 2 : playerCount <= 13 ? 3 : 4;
  const maxSpecialSlots = Math.max(1, playerCount - assigned - targetMinVillagers);

  let addedSpecials = 0;
  for (const roleId of variant.villagePriority) {
    if (addedSpecials >= maxSpecialSlots || assigned >= playerCount) break;
    const role = ROLE_BY_ID[roleId];
    if (!role || playerCount < role.minPlayers) continue;

    composition[roleId] = 1;
    assigned += 1;
    addedSpecials += 1;
  }

  // 4. Compléter le reste avec des Simples Villageois
  const remaining = playerCount - assigned;
  if (remaining > 0) {
    composition["simple-villageois"] = remaining;
  }

  return {
    label: variant.label,
    composition,
  };
}

/**
 * Calcule les statistiques d'équilibre d'une composition donnée.
 */
export function getCompositionStats(
  composition: RoleComposition,
  targetPlayers: number
): CompositionStats {
  let total = 0;
  let wolves = 0;
  let village = 0;
  let solitaire = 0;

  for (const role of GAME_ROLES) {
    const count = composition[role.id] ?? 0;
    total += count;
    if (role.faction === "loup") wolves += count;
    else if (role.faction === "solitaire") solitaire += count;
    else village += count;
  }

  if (total !== targetPlayers) {
    return {
      total,
      wolves,
      village,
      solitaire,
      balanceLabel:
        total < targetPlayers
          ? `Il manque ${targetPlayers - total} rôle${targetPlayers - total > 1 ? "s" : ""}`
          : `${total - targetPlayers} rôle${total - targetPlayers > 1 ? "s" : ""} en trop`,
      balanceTone: "mismatch",
    };
  }

  const effectiveWolves = wolves + (composition["loup-garou-blanc"] ?? 0);
  const ratio = effectiveWolves / Math.max(1, total);

  if (effectiveWolves === 0 || ratio < 0.16) {
    return {
      total,
      wolves,
      village,
      solitaire,
      balanceLabel: "Avantage Village",
      balanceTone: "village",
    };
  }

  if (ratio > 0.36) {
    return {
      total,
      wolves,
      village,
      solitaire,
      balanceLabel: "Meute Très Forte",
      balanceTone: "wolves",
    };
  }

  return {
    total,
    wolves,
    village,
    solitaire,
    balanceLabel: "Équilibre Optimal",
    balanceTone: "balanced",
  };
}

/**
 * Tire un rôle aléatoire pondéré par la composition configurée (utilisé par le mode démo / Owner).
 */
export function drawRandomRoleFromComposition(
  composition: RoleComposition,
  avoidRoleId?: string
): GameRole {
  const deck: GameRole[] = [];
  for (const role of GAME_ROLES) {
    const count = composition[role.id] ?? 0;
    for (let i = 0; i < count; i++) {
      deck.push(role);
    }
  }

  if (deck.length === 0) {
    return GAME_ROLES[0];
  }

  const filtered =
    avoidRoleId && deck.some((r) => r.id !== avoidRoleId)
      ? deck.filter((r) => r.id !== avoidRoleId)
      : deck;

  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
}
