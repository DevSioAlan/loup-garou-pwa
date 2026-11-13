"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Crown,
  Layers,
  Loader2,
  Mic,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { GAME_ROLES } from "@/data/roles";
import {
  drawRandomRoleFromComposition,
  generateBalancedComposition,
} from "@/lib/balancer";
import { triggerHaptic } from "@/lib/haptics";
import { ensurePlayerIdentity } from "@/lib/playerIdentity";
import { usePlayerProfile } from "@/lib/profileStorage";
import { createRoomInSupabase, generateRoomCode } from "@/lib/roomService";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { AuraTitle } from "@/components/ui/AuraTitle";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { RoleCard } from "@/components/game/RoleCard";
import { RoleStrip } from "@/components/game/RoleStrip";
import { GameConfigurator } from "@/components/game/GameConfigurator";
import { OwnerControlPanel } from "@/components/game/OwnerControlPanel";
import { RulesMemoModal } from "@/components/game/RulesMemoModal";
import { JoinRoomModal } from "@/components/room/JoinRoomModal";
import type {
  DemoGamePhase,
  GameRole,
  NarratorMode,
  RoleComposition,
} from "@/types/game";

type ActiveTab = "card" | "configurator";

const PHASE_ORDER: DemoGamePhase[] = ["distribution", "night", "dawn", "vote"];

/**
 * Orchestrateur principal de l'accueil :
 * - Splash Screen animé avec crédit Alan Mirat
 * - Barre de profil rapide (localStorage) + Mode Owner secret (5 clics ou code alucard)
 * - Onglets mobiles : Carte Secrète 3D (14 rôles avec RoleStrip PC/mobile) & Configurateur intelligent (4-20 joueurs)
 * - Création (code 4 lettres + configurateur) et jonction de salon multijoueur Supabase
 */
export function RoleDemoShowcase() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("card");
  const [selectedRoleId, setSelectedRoleId] = useState<string>(GAME_ROLES[0].id);

  // Profil joueur sauvegardé en localStorage (SSR-safe)
  const [profile, updateProfile] = usePlayerProfile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Configurateur & équilibrage intelligent
  const [playerCount, setPlayerCount] = useState<number>(8);
  const [variantIndex, setVariantIndex] = useState<number>(0);
  const [isCustomEdited, setIsCustomEdited] = useState<boolean>(false);
  const initialPreset = generateBalancedComposition(8, 0);
  const [presetLabel, setPresetLabel] = useState<string>(initialPreset.label);
  const [composition, setComposition] = useState<RoleComposition>(
    initialPreset.composition
  );

  // Création de salon multijoueur
  const [draftRoomCode, setDraftRoomCode] = useState<string | null>(null);
  const [narratorMode, setNarratorMode] = useState<NarratorMode>("auto");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomCreateError, setRoomCreateError] = useState<string | null>(null);

  // État local de démonstration pour le Mode Owner
  const [currentPhase, setCurrentPhase] =
    useState<DemoGamePhase>("distribution");
  const [ownerNotice, setOwnerNotice] = useState<string | null>(null);
  const [phaseInfo, setPhaseInfo] = useState<string | null>(null);

  // Détection des 5 clics rapides sur le crédit "Alan Mirat"
  const creditTapsRef = useRef<number[]>([]);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const selectedRole =
    GAME_ROLES.find((role) => role.id === selectedRoleId) ?? GAME_ROLES[0];

  const handlePlayerCountChange = (nextCount: number) => {
    const clamped = Math.max(4, Math.min(20, nextCount));
    setPlayerCount(clamped);
    const nextPreset = generateBalancedComposition(clamped, variantIndex);
    setComposition(nextPreset.composition);
    setPresetLabel(nextPreset.label);
    setIsCustomEdited(false);
  };

  const handleVaryComposition = () => {
    triggerHaptic(25);
    const nextVariant = variantIndex + 1;
    setVariantIndex(nextVariant);
    const nextPreset = generateBalancedComposition(playerCount, nextVariant);
    setComposition(nextPreset.composition);
    setPresetLabel(nextPreset.label);
    setIsCustomEdited(false);
  };

  const handleAutoBalance = () => {
    triggerHaptic(25);
    const nextPreset = generateBalancedComposition(playerCount, variantIndex);
    setComposition(nextPreset.composition);
    setPresetLabel(nextPreset.label);
    setIsCustomEdited(false);
  };

  const handleAdjustRole = (roleId: string, delta: number) => {
    const role = GAME_ROLES.find((item) => item.id === roleId);
    if (!role) return;

    setComposition((prev) => {
      const current = prev[roleId] ?? 0;
      const nextValue = Math.max(0, Math.min(role.maxCount, current + delta));
      if (nextValue === current) return prev;
      setIsCustomEdited(true);
      return {
        ...prev,
        [roleId]: nextValue,
      };
    });
  };

  const handleInspectRoleOnCard = (role: GameRole) => {
    setSelectedRoleId(role.id);
    setActiveTab("card");
  };

  // Contrôles Owner locaux
  const handleForceNextPhase = () => {
    const idx = PHASE_ORDER.indexOf(currentPhase);
    const nextPhase = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    setCurrentPhase(nextPhase);
    setOwnerNotice(`Passage forcé vers : ${nextPhase.toUpperCase()}`);
  };

  const handleRedealRoles = () => {
    triggerHaptic(25);
    const drawn = drawRandomRoleFromComposition(composition, selectedRoleId);
    setSelectedRoleId(drawn.id);
    setActiveTab("card");
    setOwnerNotice(`Nouvelle carte tirée : ${drawn.name}`);
  };

  const handleResetGame = () => {
    setCurrentPhase("distribution");
    setOwnerNotice("Partie réinitialisée à la phase de distribution.");
  };

  const handleCreditTap = () => {
    const now = Date.now();
    const recent = creditTapsRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    creditTapsRef.current = recent;

    if (recent.length >= 5) {
      creditTapsRef.current = [];
      triggerHaptic(25);
      if (!profile.isOwner) {
        updateProfile({ ...profile, isOwner: true });
        setPhaseInfo(
          "Mode Owner activé ! Couronne dorée et panneau de contrôle débloqués."
        );
      } else {
        setPhaseInfo("Mode Owner déjà actif sur cet appareil.");
      }
    }
  };

  // Bouton principal "Créer un salon" : génère un code à 4 lettres et ouvre le configurateur de rôles
  const handlePrepareRoom = () => {
    triggerHaptic(25);
    const code = generateRoomCode();
    setDraftRoomCode(code);
    setRoomCreateError(null);
    setActiveTab("configurator");
    setPhaseInfo(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLaunchRoom = async () => {
    if (creatingRoom) return;
    setCreatingRoom(true);
    setRoomCreateError(null);
    setPhaseInfo(null);
    triggerHaptic(25);

    try {
      const identity = await ensurePlayerIdentity();
      const created = await createRoomInSupabase({
        code: draftRoomCode ?? generateRoomCode(),
        userId: identity.userId,
        profile,
        composition,
        narratorMode,
      });
      router.push(`/room/${created.code}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de créer le salon sur Supabase.";
      setRoomCreateError(message);
    } finally {
      setCreatingRoom(false);
    }
  };

  return (
    <>
      <SplashScreen visible={showSplash} onDismiss={dismissSplash} />

      <div className="flex w-full flex-1 flex-col justify-between gap-4">
        {/* Barre supérieure : Profil rapide + Mémo + Nombre de joueurs */}
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="glass-panel flex min-h-[46px] max-w-full items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-left transition-transform active:scale-[0.98]"
          >
            <PlayerAvatar profile={profile} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="max-w-[125px] truncate text-xs font-semibold text-amber-50">
                  {profile.nickname}
                </span>
                {profile.isOwner && (
                  <Crown
                    className="h-3.5 w-3.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {profile.isOwner ? "Owner • Modifier" : "Modifier le profil"}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMemoModalOpen(true)}
              aria-label="Ouvrir le mémo rapide des rôles"
              className="glass-panel inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-purple-100 transition-transform active:scale-95"
            >
              <BookOpen className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
              <span>Mémo</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab((prev) =>
                  prev === "card" ? "configurator" : "card"
                )
              }
              className="glass-panel inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-amber-100 transition-transform active:scale-95"
            >
              <Users className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              <span>{playerCount}j</span>
            </button>
          </div>
        </div>

        {/* Titre avec aura */}
        <AuraTitle />

        {/* Sélecteur d'onglets mobile-first */}
        <div
          role="tablist"
          aria-label="Navigation d'accueil"
          className="glass-panel grid grid-cols-2 gap-1.5 rounded-2xl p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "card"}
            onClick={() => setActiveTab("card")}
            className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "card"
                ? "bg-gradient-to-r from-rose-700/85 to-amber-600/80 text-white shadow-[0_4px_16px_rgba(155,27,48,0.45)]"
                : "text-slate-300/80 hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Carte 3D ({GAME_ROLES.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "configurator"}
            onClick={() => setActiveTab("configurator")}
            className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "configurator"
                ? "bg-gradient-to-r from-purple-700/85 to-rose-700/80 text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)]"
                : "text-slate-300/80 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Compo &amp; Rôles</span>
          </button>
        </div>

        {/* Contenu de l'onglet actif */}
        <AnimatePresence mode="wait">
          {activeTab === "card" ? (
            <motion.section
              key="tab-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              aria-label="Démonstration de la carte de rôle"
              className="flex w-full flex-col items-center gap-3.5"
            >
              {/* Barre de rôles ergonomique : swipe mobile + drag souris + molette + flèches */}
              <RoleStrip
                roles={GAME_ROLES}
                selectedRoleId={selectedRole.id}
                composition={composition}
                onSelectRole={setSelectedRoleId}
              />

              <RoleCard role={selectedRole} />
            </motion.section>
          ) : (
            <motion.section
              key="tab-configurator"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              aria-label="Configurateur de partie"
              className="w-full space-y-3.5"
            >
              {/* Panneau de création de salon dès qu'un code à 4 lettres est généré */}
              {draftRoomCode && (
                <div className="glass-panel rounded-3xl border-amber-300/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-200/80">
                        Nouveau Salon Prêt
                      </p>
                      <p className="font-display text-2xl font-bold tracking-[0.25em] text-amber-100">
                        {draftRoomCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftRoomCode(generateRoomCode());
                        setRoomCreateError(null);
                      }}
                      className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-amber-300/40"
                    >
                      Autre code
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNarratorMode("auto");
                        setRoomCreateError(null);
                      }}
                      className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold ${
                        narratorMode === "auto"
                          ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                          : "border-white/10 bg-black/30 text-slate-300"
                      }`}
                    >
                      <Bot className="h-3.5 w-3.5 text-amber-300" />
                      <span>Narrateur Auto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNarratorMode("human");
                        setRoomCreateError(null);
                      }}
                      className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold ${
                        narratorMode === "human"
                          ? "border-purple-400/60 bg-purple-500/15 text-purple-100"
                          : "border-white/10 bg-black/30 text-slate-300"
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5 text-purple-300" />
                      <span>Narrateur Humain</span>
                    </button>
                  </div>

                  {roomCreateError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-2xl border border-rose-400/45 bg-rose-500/15 px-3 py-2.5 text-xs text-rose-100"
                    >
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-rose-300"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{roomCreateError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={creatingRoom}
                    onClick={handleLaunchRoom}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-sm font-bold text-white shadow-[0_8px_24px_rgba(155,27,48,0.45)] active:scale-[0.98] disabled:opacity-50"
                  >
                    {creatingRoom ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Création du salon...</span>
                      </>
                    ) : (
                      <>
                        <span>Ouvrir le salon ({draftRoomCode})</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              <GameConfigurator
                playerCount={playerCount}
                composition={composition}
                presetLabel={presetLabel}
                isCustomEdited={isCustomEdited}
                onChangePlayerCount={handlePlayerCountChange}
                onVaryComposition={handleVaryComposition}
                onAutoBalance={handleAutoBalance}
                onAdjustRole={handleAdjustRole}
                onInspectRole={handleInspectRoleOnCard}
              />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Panneau Owner discret (uniquement si Mode Owner actif) */}
        {profile.isOwner && (
          <OwnerControlPanel
            currentPhase={currentPhase}
            onForceNextPhase={handleForceNextPhase}
            onRedealRoles={handleRedealRoles}
            onResetGame={handleResetGame}
            lastActionNotice={ownerNotice}
          />
        )}

        {/* Barre inférieure accessible au pouce + Crédit Alan Mirat */}
        <footer className="w-full space-y-2.5 pt-1">
          <AnimatePresence mode="wait">
            {phaseInfo && (
              <motion.div
                key={phaseInfo}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="glass-panel flex items-start gap-2.5 rounded-2xl border-amber-400/35 px-3.5 py-2.5 text-xs text-amber-100/95"
              >
                <ShieldAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">{phaseInfo}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-panel rounded-3xl p-3">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handlePrepareRoom}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600/90 px-3 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(155,27,48,0.45)] transition-transform active:scale-[0.98] sm:text-sm"
              >
                <Wand2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Créer un salon</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  setJoinModalOpen(true);
                }}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-white/[0.06] px-3 text-xs font-semibold text-amber-100 transition-transform hover:bg-white/10 active:scale-[0.98] sm:text-sm"
              >
                <Users className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>Rejoindre un salon</span>
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3 w-3 text-purple-300" aria-hidden="true" />
              <span>Multijoueur Temps Réel Supabase • {playerCount} joueurs</span>
            </div>
          </div>

          {/* Crédit créateur (5 clics rapides pour débloquer le Mode Owner) */}
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={handleCreditTap}
              className="no-callout select-none rounded-full px-3 py-1 font-display credit-glow-text text-[11px] tracking-[0.2em] uppercase text-amber-200/80 transition-opacity hover:text-amber-100 active:opacity-75"
            >
              Créé par Alan Mirat
            </button>
          </div>
        </footer>
      </div>

      <ProfileModal
        open={profileModalOpen}
        profile={profile}
        onClose={() => setProfileModalOpen(false)}
        onUpdateProfile={updateProfile}
      />

      <RulesMemoModal
        open={memoModalOpen}
        onClose={() => setMemoModalOpen(false)}
      />

      <JoinRoomModal
        open={joinModalOpen}
        profile={profile}
        onClose={() => setJoinModalOpen(false)}
      />
    </>
  );
}
