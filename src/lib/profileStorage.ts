import { useCallback, useSyncExternalStore } from "react";
import type { AvatarPresetId, PlayerProfile } from "@/types/game";

const STORAGE_KEY = "lune_de_sang_profile_v1";
const PROFILE_EVENT = "lune-de-sang-profile-change";

export const OWNER_SECRET_CODE = "alucard";
export const MAX_GIF_BYTES = 1.5 * 1024 * 1024; // 1,5 Mo

export const AVATAR_PRESETS: Array<{
  id: AvatarPresetId;
  label: string;
  accent: string;
  bgGradient: string;
}> = [
  {
    id: "wolf",
    label: "Loup",
    accent: "#FB7185",
    bgGradient: "from-rose-900/80 via-[#240B16] to-[#090A0F]",
  },
  {
    id: "moon",
    label: "Lune",
    accent: "#FCD34D",
    bgGradient: "from-amber-900/70 via-[#22170D] to-[#090A0F]",
  },
  {
    id: "eye",
    label: "Oracle",
    accent: "#C084FC",
    bgGradient: "from-purple-900/80 via-[#1B1030] to-[#090A0F]",
  },
  {
    id: "flask",
    label: "Alchimie",
    accent: "#34D399",
    bgGradient: "from-emerald-900/75 via-[#0B201E] to-[#090A0F]",
  },
  {
    id: "shield",
    label: "Garde",
    accent: "#38BDF8",
    bgGradient: "from-sky-900/75 via-[#0D1A2B] to-[#090A0F]",
  },
  {
    id: "flame",
    label: "Braise",
    accent: "#FB923C",
    bgGradient: "from-orange-900/75 via-[#24120B] to-[#090A0F]",
  },
  {
    id: "crown",
    label: "Noble",
    accent: "#FBBF24",
    bgGradient: "from-yellow-900/70 via-[#241B0A] to-[#090A0F]",
  },
  {
    id: "sparkles",
    label: "Astral",
    accent: "#818CF8",
    bgGradient: "from-indigo-900/75 via-[#13142C] to-[#090A0F]",
  },
];

export const DEFAULT_PROFILE: PlayerProfile = {
  nickname: "Veilleur",
  avatarType: "preset",
  avatarPreset: "wolf",
  avatarDataUrl: null,
  isOwner: false,
};

let cachedRaw: string | null | undefined = undefined;
let cachedProfile: PlayerProfile = DEFAULT_PROFILE;

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedProfile;
    }
    cachedRaw = raw;

    if (!raw) {
      cachedProfile = DEFAULT_PROFILE;
      return cachedProfile;
    }

    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    cachedProfile = {
      nickname:
        typeof parsed.nickname === "string" && parsed.nickname.trim().length > 0
          ? parsed.nickname.slice(0, 20)
          : DEFAULT_PROFILE.nickname,
      avatarType:
        parsed.avatarType === "upload" && parsed.avatarDataUrl
          ? "upload"
          : "preset",
      avatarPreset: parsed.avatarPreset ?? DEFAULT_PROFILE.avatarPreset,
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" ? parsed.avatarDataUrl : null,
      isOwner: Boolean(parsed.isOwner),
    };
    return cachedProfile;
  } catch {
    cachedProfile = DEFAULT_PROFILE;
    return cachedProfile;
  }
}

export function savePlayerProfile(profile: PlayerProfile): boolean {
  if (typeof window === "undefined") return false;
  try {
    const serialized = JSON.stringify(profile);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedProfile = profile;
    window.dispatchEvent(new Event(PROFILE_EVENT));
    return true;
  } catch {
    return false;
  }
}

function subscribeProfile(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };
  const handleCustom = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PROFILE_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PROFILE_EVENT, handleCustom);
  };
}

function getServerSnapshot(): PlayerProfile {
  return DEFAULT_PROFILE;
}

/**
 * Hook SSR-safe synchronisé avec localStorage sans effet de bord dans useEffect.
 */
export function usePlayerProfile(): [
  PlayerProfile,
  (next: PlayerProfile) => boolean,
] {
  const profile = useSyncExternalStore(
    subscribeProfile,
    loadPlayerProfile,
    getServerSnapshot
  );

  const updateProfile = useCallback((next: PlayerProfile): boolean => {
    return savePlayerProfile(next);
  }, []);

  return [profile, updateProfile];
}

export function verifyOwnerSecretCode(input: string): boolean {
  return input.trim().toLowerCase() === OWNER_SECRET_CODE;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Traite un avatar importé depuis le téléphone :
 * - Les fichiers .gif animés sont conservés intacts en Data URL (max 1,5 Mo) sans passer par <canvas>.
 * - Les autres images (JPEG/PNG/WebP) sont recadrées et compressées en 160x160 JPEG.
 */
export async function processAvatarFile(file: File): Promise<string> {
  const isGif =
    file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

  if (isGif) {
    if (file.size > MAX_GIF_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Ce GIF fait ${sizeMb} Mo : la limite est de 1,5 Mo pour préserver le stockage local.`
      );
    }
    return readFileAsDataUrl(file);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Format d'image non supporté."));
    img.onload = () => {
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Contexte canvas indisponible."));
        return;
      }

      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;

      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = rawDataUrl;
  });
}
