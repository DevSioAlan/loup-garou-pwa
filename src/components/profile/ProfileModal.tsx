"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, KeyRound, ShieldCheck, Upload, X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import {
  AVATAR_PRESETS,
  processAvatarFile,
  verifyOwnerSecretCode,
} from "@/lib/profileStorage";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { AvatarPresetId, PlayerProfile, RoleIconName } from "@/types/game";

interface ProfileModalProps {
  open: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onUpdateProfile: (next: PlayerProfile) => boolean;
}

const PRESET_ICON_MAP: Record<AvatarPresetId, RoleIconName> = {
  wolf: "wolf",
  moon: "moon",
  crown: "sparkles",
  eye: "eye",
  flask: "flask",
  flame: "flame",
  shield: "shield",
  sparkles: "sparkles",
};

/**
 * Modale mobile-first de profil rapide sans compte :
 * - Pseudo sauvegardé dans localStorage
 * - Galerie d'icônes animées Dark Fantasy + upload photo/GIF animé (1,5 Mo max)
 * - Champ code secret pour activer le Mode Owner
 */
export function ProfileModal({
  open,
  profile,
  onClose,
  onUpdateProfile,
}: ProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [secretFeedback, setSecretFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleNicknameChange = (value: string) => {
    onUpdateProfile({
      ...profile,
      nickname: value.slice(0, 20),
    });
  };

  const handleSelectPreset = (presetId: AvatarPresetId) => {
    setUploadError(null);
    onUpdateProfile({
      ...profile,
      avatarType: "preset",
      avatarPreset: presetId,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    try {
      const dataUrl = await processAvatarFile(file);
      const saved = onUpdateProfile({
        ...profile,
        avatarType: "upload",
        avatarDataUrl: dataUrl,
      });
      if (!saved) {
        setUploadError(
          "Espace local insuffisant pour sauvegarder ce fichier. Essayez un GIF plus léger."
        );
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Impossible de charger cette image. Essayez un autre fichier."
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyOwnerSecretCode(secretInput)) {
      triggerHaptic(25);
      onUpdateProfile({
        ...profile,
        isOwner: true,
      });
      setSecretInput("");
      setSecretFeedback("Mode Owner activé avec succès.");
    } else {
      setSecretFeedback("Code secret invalide.");
    }
  };

  const handleDisableOwner = () => {
    onUpdateProfile({
      ...profile,
      isOwner: false,
    });
    setSecretFeedback("Mode Owner désactivé.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="profile-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            key="profile-sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-amber-300/20 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <PlayerAvatar profile={profile} size="md" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display text-lg font-bold text-amber-100">
                      Profil du Joueur
                    </h2>
                    {profile.isOwner && (
                      <Crown
                        className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sauvegardé automatiquement sur cet appareil
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le profil"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Pseudo */}
              <div className="space-y-1.5">
                <label
                  htmlFor="player-nickname"
                  className="block text-xs font-semibold tracking-wider uppercase text-amber-200/80"
                >
                  Pseudo
                </label>
                <input
                  id="player-nickname"
                  type="text"
                  value={profile.nickname}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                  onBlur={() => {
                    if (!profile.nickname.trim()) {
                      handleNicknameChange("Veilleur");
                    }
                  }}
                  placeholder="Ex: Alan, LoupNocturne..."
                  maxLength={20}
                  className="min-h-[46px] w-full rounded-2xl border border-white/15 bg-black/40 px-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-300/60 focus:outline-none"
                />
              </div>

              {/* Choix d'avatar */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold tracking-wider uppercase text-amber-200/80">
                      Avatar
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Icônes animées ou photo / GIF (1,5 Mo max)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-400/20"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Photo / GIF</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/webp,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const selected =
                      profile.avatarType === "preset" &&
                      profile.avatarPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`flex flex-col items-center gap-1 rounded-2xl border p-2.5 transition-all ${
                          selected
                            ? "border-amber-300/70 bg-white/12 shadow-[0_0_18px_rgba(212,175,55,0.22)]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${preset.bgGradient} border border-white/15`}
                        >
                          <RoleIcon
                            icon={PRESET_ICON_MAP[preset.id]}
                            color={preset.accent}
                            glow={selected}
                            animated
                            className="h-5 w-5"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-300">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {uploadError && (
                  <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Accès secret Mode Owner */}
              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/35 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    <span className="text-xs font-semibold text-amber-100">
                      Accès Owner
                    </span>
                  </div>
                  {profile.isOwner && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/45 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Actif
                    </span>
                  )}
                </div>

                {profile.isOwner ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                    <span>Couronne &amp; panneau de contrôle débloqués.</span>
                    <button
                      type="button"
                      onClick={handleDisableOwner}
                      className="shrink-0 rounded-xl border border-white/15 px-2.5 py-1 text-[11px] text-slate-300 hover:border-rose-400/40 hover:text-rose-200"
                    >
                      Désactiver
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSecretSubmit} className="flex gap-2">
                    <input
                      type="password"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      placeholder="Entrez le code secret..."
                      className="min-h-[40px] flex-1 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-300/50 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] rounded-xl border border-amber-300/35 bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-400/25"
                    >
                      Valider
                    </button>
                  </form>
                )}

                {secretFeedback && (
                  <p className="text-[11px] text-amber-200/90">{secretFeedback}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-sm font-bold text-[#090A0F] shadow-[0_6px_22px_rgba(212,175,55,0.35)] active:scale-[0.98]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Enregistrer et fermer</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
