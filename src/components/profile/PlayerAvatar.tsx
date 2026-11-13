"use client";

import { Crown } from "lucide-react";
import { AVATAR_PRESETS } from "@/lib/profileStorage";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { PlayerProfile, RoleIconName } from "@/types/game";

interface PlayerAvatarProps {
  profile: PlayerProfile;
  size?: "sm" | "md" | "lg";
}

const PRESET_TO_ICON: Record<PlayerProfile["avatarPreset"], RoleIconName> = {
  wolf: "wolf",
  moon: "moon",
  crown: "sparkles",
  eye: "eye",
  flask: "flask",
  flame: "flame",
  shield: "shield",
  sparkles: "sparkles",
};

const SIZE_CLASSES = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

const ICON_SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Avatar du joueur avec couronne dorée lumineuse lorsque le Mode Owner est actif.
 */
export function PlayerAvatar({ profile, size = "sm" }: PlayerAvatarProps) {
  const preset =
    AVATAR_PRESETS.find((item) => item.id === profile.avatarPreset) ??
    AVATAR_PRESETS[0];

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${SIZE_CLASSES[size]} relative overflow-hidden rounded-full border ${
          profile.isOwner
            ? "border-amber-300/80 shadow-[0_0_16px_rgba(245,158,11,0.5)]"
            : "border-white/20"
        } bg-gradient-to-br ${preset.bgGradient} flex items-center justify-center`}
      >
        {profile.avatarType === "upload" && profile.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarDataUrl}
            alt={profile.nickname}
            className="h-full w-full object-cover"
          />
        ) : (
          <RoleIcon
            icon={PRESET_TO_ICON[profile.avatarPreset]}
            color={preset.accent}
            glow
            className={ICON_SIZE_CLASSES[size]}
          />
        )}
      </div>

      {profile.isOwner && (
        <span
          title="Mode Owner actif"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200/80 bg-gradient-to-br from-amber-300 to-amber-600 text-[#090A0F] shadow-[0_0_12px_rgba(251,191,36,0.9)]"
        >
          <Crown className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
