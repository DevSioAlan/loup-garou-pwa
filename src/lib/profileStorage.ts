import { useCallback, useSyncExternalStore } from "react";
import type { AvatarPresetId, PlayerProfile } from "@/types/game";

const STORAGE_KEY = "lune_de_sang_profile_v1";
const PROFILE_EVENT = "lune-de-sang-profile-change";

export const OWNER_SECRET_CODE = "alucard";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 Mo
export const MAX_GIF_BYTES = MAX_UPLOAD_BYTES;
const MAX_VIDEO_SECONDS = 15;

export const AVATAR_PRESETS: Array<{
  id: AvatarPresetId;
  label: string;
  accent: string;
  secondary: string;
  bgGradient: string;
}> = [
  {
    id: "wolf",
    label: "Loup",
    accent: "#FB7185",
    secondary: "#9B1B30",
    bgGradient: "from-rose-900/80 via-[#240B16] to-[#090A0F]",
  },
  {
    id: "moon",
    label: "Lune",
    accent: "#FCD34D",
    secondary: "#E11D48",
    bgGradient: "from-amber-900/70 via-[#22170D] to-[#090A0F]",
  },
  {
    id: "eye",
    label: "Oracle",
    accent: "#C084FC",
    secondary: "#6366F1",
    bgGradient: "from-purple-900/80 via-[#1B1030] to-[#090A0F]",
  },
  {
    id: "flask",
    label: "Alchimie",
    accent: "#34D399",
    secondary: "#8B5CF6",
    bgGradient: "from-emerald-900/75 via-[#0B201E] to-[#090A0F]",
  },
  {
    id: "shield",
    label: "Garde",
    accent: "#38BDF8",
    secondary: "#1D4ED8",
    bgGradient: "from-sky-900/75 via-[#0D1A2B] to-[#090A0F]",
  },
  {
    id: "flame",
    label: "Braise",
    accent: "#FB923C",
    secondary: "#DC2626",
    bgGradient: "from-orange-900/75 via-[#24120B] to-[#090A0F]",
  },
  {
    id: "crown",
    label: "Noble",
    accent: "#FBBF24",
    secondary: "#9333EA",
    bgGradient: "from-yellow-900/70 via-[#241B0A] to-[#090A0F]",
  },
  {
    id: "sparkles",
    label: "Astral",
    accent: "#818CF8",
    secondary: "#EC4899",
    bgGradient: "from-indigo-900/75 via-[#13142C] to-[#090A0F]",
  },
  {
    id: "bird",
    label: "Corbeau",
    accent: "#A5B4FC",
    secondary: "#312E81",
    bgGradient: "from-indigo-950/85 via-[#141328] to-[#090A0F]",
  },
  {
    id: "fox",
    label: "Renard",
    accent: "#FB923C",
    secondary: "#F59E0B",
    bgGradient: "from-orange-950/80 via-[#28140C] to-[#090A0F]",
  },
  {
    id: "music",
    label: "Flûte",
    accent: "#22D3EE",
    secondary: "#A855F7",
    bgGradient: "from-cyan-950/80 via-[#0E1B29] to-[#090A0F]",
  },
  {
    id: "sword",
    label: "Chevalier",
    accent: "#F59E0B",
    secondary: "#B45309",
    bgGradient: "from-amber-950/80 via-[#24190C] to-[#090A0F]",
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
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function checkVideoDuration(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
    };
    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      if (Number.isFinite(dur) && dur > MAX_VIDEO_SECONDS) {
        reject(
          new Error(
            `Vidéo trop longue (${Math.round(dur)}s) : choisissez une boucle courte de ${MAX_VIDEO_SECONDS}s maximum.`
          )
        );
        return;
      }
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Format vidéo non lisible par ce navigateur."));
    };
    video.src = url;
  });
}

/**
 * Traite un avatar importé depuis l'appareil (jusqu'à 4 Mo) :
 * - .gif animés conservés intacts en Data URL sans passer par <canvas>
 * - Boucles vidéo courtes .mp4 / .webm (<= 4 Mo, <= 15s) conservées en Data URL
 * - Images statiques (JPEG/PNG/WebP...) recadrées en carré 192x192 et compressées
 *   intelligemment en WebP (avec repli JPEG si WebP indisponible).
 */
export async function processAvatarFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Ce fichier fait ${sizeMb} Mo : la limite maximale est de 4 Mo.`
    );
  }

  const lowerName = file.name.toLowerCase();
  const isGif = file.type === "image/gif" || lowerName.endsWith(".gif");
  const isVideo =
    file.type.startsWith("video/") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".webm");

  if (isGif) {
    return readFileAsDataUrl(file);
  }

  if (isVideo) {
    const supportedVideo =
      file.type === "video/mp4" ||
      file.type === "video/webm" ||
      lowerName.endsWith(".mp4") ||
      lowerName.endsWith(".webm");
    if (!supportedVideo) {
      throw new Error("Formats vidéo acceptés : .mp4 ou .webm uniquement.");
    }
    await checkVideoDuration(file);
    return readFileAsDataUrl(file);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Format d'image non supporté."));
    img.onload = () => {
      const size = 192;
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

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      const webpUrl = canvas.toDataURL("image/webp", 0.84);
      if (webpUrl.startsWith("data:image/webp")) {
        resolve(webpUrl);
        return;
      }
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.src = rawDataUrl;
  });
}
