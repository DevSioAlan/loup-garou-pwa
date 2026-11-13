import type { GameRole } from "@/types/game";

export const GAME_ROLES: GameRole[] = [
  {
    id: "loup-garou",
    name: "Loup-Garou",
    subtitle: "Prédateur de la Lune de Sang",
    faction: "loup",
    factionLabel: "Meute",
    icon: "moon",
    ability:
      "Chaque nuit, concertez-vous en silence avec la meute pour dévorer un villageois. Le jour, fondez-vous dans la foule.",
    lore: "Sous l'éclipse écarlate, l'instinct chasse toute pitié.",
    maxCount: 8,
    minPlayers: 4,
    aura: {
      primary: "#E11D48",
      secondary: "#9B1B30",
      glowShadow:
        "0 0 38px rgba(225, 29, 72, 0.55), 0 0 80px rgba(155, 27, 48, 0.35)",
      borderClass: "border-rose-400/50",
      badgeClass: "bg-rose-500/20 text-rose-200 border-rose-400/40",
      surfaceGradient: "from-rose-950/75 via-[#180A14]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "loup-garou-blanc",
    name: "Loup-Garou Blanc",
    subtitle: "Traître Solitaire de la Meute",
    faction: "solitaire",
    factionLabel: "Solitaire",
    icon: "wolf",
    ability:
      "Chassez avec les loups, mais une nuit sur deux vous pouvez dévorer un autre Loup-Garou. Votre but : rester le dernier survivant.",
    lore: "Même les crocs de ses frères ne suffisent pas à le rassasier.",
    maxCount: 1,
    minPlayers: 10,
    aura: {
      primary: "#E2E8F0",
      secondary: "#BE123C",
      glowShadow:
        "0 0 38px rgba(226, 232, 240, 0.48), 0 0 80px rgba(190, 18, 60, 0.32)",
      borderClass: "border-slate-200/55",
      badgeClass: "bg-slate-200/15 text-slate-100 border-slate-300/45",
      surfaceGradient: "from-slate-800/70 via-[#1B1018]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "grand-mechant-loup",
    name: "Grand Méchant Loup",
    subtitle: "Alpha Impitoyable",
    faction: "loup",
    factionLabel: "Meute",
    icon: "flame",
    ability:
      "Tant qu'aucun autre Loup-Garou n'a été éliminé, vous pouvez dévorer une seconde victime solitaire chaque nuit.",
    lore: "Son hurlement glace le sang jusqu'au seuil des chaumières.",
    maxCount: 1,
    minPlayers: 10,
    aura: {
      primary: "#EA580C",
      secondary: "#9B1B30",
      glowShadow:
        "0 0 38px rgba(234, 88, 12, 0.55), 0 0 80px rgba(155, 27, 48, 0.35)",
      borderClass: "border-orange-400/55",
      badgeClass: "bg-orange-500/20 text-orange-200 border-orange-400/45",
      surfaceGradient: "from-orange-950/75 via-[#1C0D0D]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "voyante",
    name: "Voyante",
    subtitle: "Oracle des Voiles Nocturnes",
    faction: "village",
    factionLabel: "Village",
    icon: "eye",
    ability:
      "Chaque nuit, percez le secret d'un joueur et découvrez sa véritable nature sans éveiller les soupçons.",
    lore: "Les astres murmurent ce que les visages dissimulent.",
    maxCount: 1,
    minPlayers: 4,
    aura: {
      primary: "#A855F7",
      secondary: "#6366F1",
      glowShadow:
        "0 0 38px rgba(168, 85, 247, 0.55), 0 0 80px rgba(99, 102, 241, 0.35)",
      borderClass: "border-purple-400/50",
      badgeClass: "bg-purple-500/20 text-purple-200 border-purple-400/40",
      surfaceGradient: "from-purple-950/75 via-[#120D24]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "sorciere",
    name: "Sorcière",
    subtitle: "Alchimiste des Deux Fioles",
    faction: "village",
    factionLabel: "Village",
    icon: "flask",
    ability:
      "Vous détenez une potion de vie et une potion de mort, chacune utilisable une seule fois durant la partie.",
    lore: "Entre élixir d'éveil et venin d'ombre, votre choix pèse sur l'aube.",
    maxCount: 1,
    minPlayers: 5,
    aura: {
      primary: "#10B981",
      secondary: "#8B5CF6",
      glowShadow:
        "0 0 38px rgba(16, 185, 129, 0.5), 0 0 80px rgba(139, 92, 246, 0.32)",
      borderClass: "border-emerald-400/50",
      badgeClass: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
      surfaceGradient: "from-emerald-950/70 via-[#0C191C]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "chasseur",
    name: "Chasseur",
    subtitle: "Sentinelle du Dernier Souffle",
    faction: "village",
    factionLabel: "Village",
    icon: "crosshair",
    ability:
      "Si vous succombez à la nuit ou au vote du village, emportez immédiatement un joueur de votre choix dans votre chute.",
    lore: "Même tombé à genoux, votre flèche trouve toujours sa cible.",
    maxCount: 1,
    minPlayers: 5,
    aura: {
      primary: "#F59E0B",
      secondary: "#D4AF37",
      glowShadow:
        "0 0 38px rgba(245, 158, 11, 0.52), 0 0 80px rgba(212, 175, 55, 0.32)",
      borderClass: "border-amber-400/55",
      badgeClass: "bg-amber-500/20 text-amber-200 border-amber-400/45",
      surfaceGradient: "from-amber-950/70 via-[#1B140B]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "salvateur",
    name: "Salvateur",
    subtitle: "Garde du Rempart Sacré",
    faction: "village",
    factionLabel: "Village",
    icon: "shield",
    ability:
      "Chaque nuit, protégez un joueur (ou vous-même) contre l'attaque des loups, sans jamais protéger deux fois de suite la même personne.",
    lore: "Votre bouclier brille là où les ténèbres pensaient frapper.",
    maxCount: 1,
    minPlayers: 7,
    aura: {
      primary: "#0EA5E9",
      secondary: "#1D4ED8",
      glowShadow:
        "0 0 38px rgba(14, 165, 233, 0.52), 0 0 80px rgba(29, 78, 216, 0.32)",
      borderClass: "border-sky-400/50",
      badgeClass: "bg-sky-500/20 text-sky-200 border-sky-400/40",
      surfaceGradient: "from-sky-950/75 via-[#0B1526]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "cupidon",
    name: "Cupidon",
    subtitle: "Tisseur des Destins Liés",
    faction: "village",
    factionLabel: "Village",
    icon: "heart",
    ability:
      "La première nuit, désignez deux amoureux. Si l'un périt, l'autre meurt de chagrin à l'instant même.",
    lore: "Une flèche d'or suffit à lier deux âmes pour la vie... ou la tombe.",
    maxCount: 1,
    minPlayers: 7,
    aura: {
      primary: "#EC4899",
      secondary: "#A855F7",
      glowShadow:
        "0 0 38px rgba(236, 72, 153, 0.52), 0 0 80px rgba(168, 85, 247, 0.32)",
      borderClass: "border-pink-400/50",
      badgeClass: "bg-pink-500/20 text-pink-200 border-pink-400/40",
      surfaceGradient: "from-pink-950/70 via-[#1E0E20]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "petite-fille",
    name: "Petite Fille",
    subtitle: "Guetteuse de la Pénombre",
    faction: "village",
    factionLabel: "Village",
    icon: "sparkles",
    ability:
      "Vous pouvez espionner discrètement l'activité nocturne des loups au péril d'être repérée si vous attirez l'attention.",
    lore: "À travers la serrure entrouverte, les ombres trahissent leurs secrets.",
    maxCount: 1,
    minPlayers: 8,
    aura: {
      primary: "#818CF8",
      secondary: "#4F46E5",
      glowShadow:
        "0 0 38px rgba(129, 140, 248, 0.5), 0 0 80px rgba(79, 70, 229, 0.3)",
      borderClass: "border-indigo-400/50",
      badgeClass: "bg-indigo-500/20 text-indigo-200 border-indigo-400/40",
      surfaceGradient: "from-indigo-950/75 via-[#101226]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "ancien",
    name: "Ancien",
    subtitle: "Mémoire Impérissable",
    faction: "village",
    factionLabel: "Village",
    icon: "scroll",
    ability:
      "Vous survivez à la première morsure des loups. Mais si le village vous exécute par erreur, tous les innocents perdent leurs pouvoirs.",
    lore: "Sa sagesse protège le hameau tant que nul ne lève la main sur lui.",
    maxCount: 1,
    minPlayers: 9,
    aura: {
      primary: "#D4AF37",
      secondary: "#78350F",
      glowShadow:
        "0 0 38px rgba(212, 175, 55, 0.5), 0 0 80px rgba(120, 53, 15, 0.32)",
      borderClass: "border-yellow-400/50",
      badgeClass: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40",
      surfaceGradient: "from-yellow-950/65 via-[#1A150D]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "idiot-du-village",
    name: "Idiot du Village",
    subtitle: "Gracié par l'Absurde",
    faction: "village",
    factionLabel: "Village",
    icon: "smile",
    ability:
      "Si le village vote votre élimination, votre innocence éclate : vous restez en vie mais perdez votre droit de vote.",
    lore: "Nul ne craint celui dont les rires désarment jusqu'au bourreau.",
    maxCount: 1,
    minPlayers: 10,
    aura: {
      primary: "#14B8A6",
      secondary: "#0F766E",
      glowShadow:
        "0 0 38px rgba(20, 184, 166, 0.48), 0 0 80px rgba(15, 118, 110, 0.3)",
      borderClass: "border-teal-400/50",
      badgeClass: "bg-teal-500/20 text-teal-200 border-teal-400/40",
      surfaceGradient: "from-teal-950/70 via-[#0B191B]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "enfant-sauvage",
    name: "Enfant Sauvage",
    subtitle: "Disciple au Cœur Indompté",
    faction: "village",
    factionLabel: "Village*",
    icon: "paw",
    ability:
      "Choisissez un modèle au début de la partie. Tant qu'il vit, vous êtes villageois ; s'il meurt, vous rejoignez la meute des loups.",
    lore: "Lorsque son guide tombe, la bête qui sommeillait s'éveille.",
    maxCount: 1,
    minPlayers: 10,
    aura: {
      primary: "#84CC16",
      secondary: "#9B1B30",
      glowShadow:
        "0 0 38px rgba(132, 204, 22, 0.48), 0 0 80px rgba(155, 27, 48, 0.28)",
      borderClass: "border-lime-400/50",
      badgeClass: "bg-lime-500/20 text-lime-200 border-lime-400/40",
      surfaceGradient: "from-lime-950/65 via-[#13190E]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "ange",
    name: "Ange",
    subtitle: "Âme en Quête de Délivrance",
    faction: "solitaire",
    factionLabel: "Solitaire",
    icon: "feather",
    ability:
      "Si vous parvenez à vous faire éliminer dès le tout premier vote ou la première nuit, vous remportez immédiatement la partie.",
    lore: "Ses ailes dorées n'attendent qu'un bûcher pour regagner les cieux.",
    maxCount: 1,
    minPlayers: 11,
    aura: {
      primary: "#FDE047",
      secondary: "#C084FC",
      glowShadow:
        "0 0 38px rgba(253, 224, 71, 0.52), 0 0 80px rgba(192, 132, 252, 0.34)",
      borderClass: "border-amber-200/60",
      badgeClass: "bg-amber-300/20 text-amber-100 border-amber-200/50",
      surfaceGradient: "from-amber-900/55 via-[#1C1628]/90 to-[#090A0F]/95",
    },
  },
  {
    id: "simple-villageois",
    name: "Simple Villageois",
    subtitle: "Veilleur du Hameau",
    faction: "village",
    factionLabel: "Village",
    icon: "user",
    ability:
      "Aucun pouvoir nocturne, mais votre intuition, votre parole et votre vote restent les armes les plus sûres du village.",
    lore: "Dans l'ombre des soupçons, le bon sens vaut toutes les magies.",
    maxCount: 16,
    minPlayers: 4,
    aura: {
      primary: "#94A3B8",
      secondary: "#475569",
      glowShadow:
        "0 0 34px rgba(148, 163, 184, 0.42), 0 0 70px rgba(71, 85, 105, 0.28)",
      borderClass: "border-slate-400/45",
      badgeClass: "bg-slate-500/20 text-slate-200 border-slate-400/35",
      surfaceGradient: "from-slate-900/75 via-[#131722]/90 to-[#090A0F]/95",
    },
  },
];

export const ROLE_BY_ID: Record<string, GameRole> = Object.fromEntries(
  GAME_ROLES.map((role) => [role.id, role])
);
