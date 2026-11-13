"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Lock, Moon } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { GameRole } from "@/types/game";

interface RoleCardProps {
  role: GameRole;
}

/**
 * Carte de rôle interactive Dark Fantasy :
 * - Maintenir appuyé (onPointerDown) : retourne la carte en 3D, vibre brièvement (haptique) et révèle le rôle.
 * - Déplacer le doigt (onPointerMove) : parallaxe 3D + reflet holographique réactif au toucher.
 * - Relâcher ou quitter la zone (onPointerUp / onPointerLeave / onPointerCancel) : se referme instantanément.
 * - select-none + -webkit-touch-callout:none pour bloquer le menu contextuel mobile.
 */
export function RoleCard({ role }: RoleCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Sécurité supplémentaire : fermeture automatique si le relâchement a lieu hors fenêtre
  useEffect(() => {
    if (!isRevealed) return;

    const closeCard = () => {
      setIsRevealed(false);
      setTilt({ x: 0, y: 0 });
    };
    window.addEventListener("pointerup", closeCard);
    window.addEventListener("pointercancel", closeCard);
    window.addEventListener("blur", closeCard);

    return () => {
      window.removeEventListener("pointerup", closeCard);
      window.removeEventListener("pointercancel", closeCard);
      window.removeEventListener("blur", closeCard);
    };
  }, [isRevealed]);

  const updatePointerTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const handleRevealStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRevealed) {
      triggerHaptic(25);
    }
    setIsRevealed(true);
    updatePointerTilt(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRevealed) return;
    updatePointerTilt(e);
  };

  const handleRevealEnd = () => {
    setIsRevealed(false);
    setTilt({ x: 0, y: 0 });
  };

  // Calcul du tilt 3D et de la position du reflet holographique
  const rotateYTarget = isRevealed ? 180 + tilt.x * 9 : 0;
  const rotateXTarget = isRevealed ? -tilt.y * 8 : 0;
  const sheenX = 50 - tilt.x * 32;
  const sheenY = 50 + tilt.y * 32;

  return (
    <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]">
      {/* Aura lumineuse colorée dynamique + parallaxe subtile derrière la carte */}
      <motion.div
        aria-hidden="true"
        animate={{
          opacity: isRevealed ? 0.95 : 0.25,
          scale: isRevealed ? 1.09 : 0.94,
          x: isRevealed ? tilt.x * 14 : 0,
          y: isRevealed ? tilt.y * 12 : 0,
        }}
        transition={{
          duration: isRevealed ? 0.28 : 0.2,
          ease: "easeOut",
        }}
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] blur-2xl"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${role.aura.primary}75 0%, ${role.aura.secondary}45 50%, transparent 80%)`,
        }}
      />

      {/* Zone tactile 3D interactive */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Carte secrète de ${role.name}. Maintenir appuyé pour révéler le rôle.`}
        aria-pressed={isRevealed}
        onPointerDown={handleRevealStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handleRevealEnd}
        onPointerLeave={handleRevealEnd}
        onPointerCancel={handleRevealEnd}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!isRevealed) triggerHaptic(25);
            setIsRevealed(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleRevealEnd();
          }
        }}
        className="perspective-1200 no-callout select-none touch-none cursor-pointer rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#090A0F]"
      >
        <motion.div
          animate={{
            rotateY: rotateYTarget,
            rotateX: rotateXTarget,
            scale: isRevealed ? 1.03 : 1,
          }}
          transition={
            isRevealed
              ? { type: "spring", stiffness: 320, damping: 26, mass: 0.78 }
              : { type: "spring", stiffness: 520, damping: 34, mass: 0.55 }
          }
          className="preserve-3d relative aspect-[3/4.2] w-full will-change-transform"
        >
          {/* FACE CACHÉE (0°) — Dos de carte mystique en verre dépoli */}
          <div className="backface-hidden glass-panel absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[26px] p-5">
            {/* Bordure intérieure dorée */}
            <div className="pointer-events-none absolute inset-2.5 rounded-[18px] border border-amber-400/25" />

            {/* Ornements de coins */}
            <span className="pointer-events-none absolute left-4 top-4 h-2.5 w-2.5 border-l-2 border-t-2 border-amber-300/60" />
            <span className="pointer-events-none absolute right-4 top-4 h-2.5 w-2.5 border-r-2 border-t-2 border-amber-300/60" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-2.5 w-2.5 border-b-2 border-l-2 border-amber-300/60" />
            <span className="pointer-events-none absolute bottom-4 right-4 h-2.5 w-2.5 border-b-2 border-r-2 border-amber-300/60" />

            {/* En-tête dos de carte */}
            <div className="relative z-10 flex w-full items-center justify-between px-1 pt-1 text-[10px] font-semibold tracking-[0.22em] uppercase text-amber-200/70">
              <span>Identité</span>
              <span className="inline-flex items-center gap-1 text-rose-300/80">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Scellée
              </span>
            </div>

            {/* Sceau central Lune de Sang */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
                className="flex h-32 w-32 items-center justify-center rounded-full border border-dashed border-amber-400/30"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-rose-400/35 bg-gradient-to-b from-rose-950/60 via-[#120D1D]/80 to-[#090A0F]/90 shadow-[inset_0_0_24px_rgba(225,29,72,0.3)]" />
              </motion.div>
              <Moon
                className="pointer-events-none absolute h-10 w-10 text-amber-200 drop-shadow-[0_0_14px_rgba(212,175,55,0.65)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>

            {/* Instruction tactile */}
            <div className="relative z-10 flex flex-col items-center gap-1.5 pb-1 text-center">
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/35 bg-amber-400/10 text-amber-200"
              >
                <Fingerprint className="h-5 w-5" aria-hidden="true" />
              </motion.div>
              <p className="text-xs font-medium tracking-wide text-amber-100/90">
                Maintenir appuyé
              </p>
              <p className="text-[11px] text-slate-400">
                pour révéler votre rôle
              </p>
            </div>
          </div>

          {/* FACE RÉVÉLÉE (180°) — Rôle avec aura colorée & reflet holographique */}
          <div
            className={`backface-hidden absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[26px] border bg-gradient-to-b ${role.aura.surfaceGradient} ${role.aura.borderClass} p-5 backdrop-blur-2xl`}
            style={{
              transform: "rotateY(180deg)",
              boxShadow: isRevealed
                ? role.aura.glowShadow
                : "0 20px 50px rgba(0, 0, 0, 0.65)",
            }}
          >
            {/* Reflet holographique interactif suivant le doigt */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-200"
              style={{
                opacity: isRevealed ? 0.55 : 0,
                background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255, 255, 255, 0.22) 0%, ${role.aura.primary}25 32%, transparent 65%)`,
              }}
            />

            {/* Lueur interne en haut de la carte */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 left-1/2 h-36 w-56 -translate-x-1/2 rounded-full blur-2xl"
              style={{
                background: `radial-gradient(circle, ${role.aura.primary}55 0%, transparent 70%)`,
              }}
            />

            {/* Badge de faction */}
            <div className="relative z-10 flex w-full items-center justify-between pt-0.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase ${role.aura.badgeClass}`}
              >
                {role.factionLabel}
              </span>
              <span className="text-[10px] font-medium tracking-[0.16em] uppercase text-slate-300/75">
                Secret
              </span>
            </div>

            {/* Emblème du rôle */}
            <div className="relative z-10 my-1 flex flex-col items-center text-center">
              <div
                className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/35 backdrop-blur-md"
                style={{
                  boxShadow: `0 0 26px ${role.aura.primary}45, inset 0 0 18px ${role.aura.primary}30`,
                }}
              >
                <RoleIcon
                  icon={role.icon}
                  color={role.aura.primary}
                  glow
                  animated
                  className="h-10 w-10 transition-transform duration-300"
                  strokeWidth={1.75}
                />
              </div>

              <h2 className="font-display text-2xl font-bold tracking-wide text-amber-50">
                {role.name}
              </h2>
              <p
                className="mt-0.5 text-[11px] font-medium tracking-wider uppercase"
                style={{ color: role.aura.primary }}
              >
                {role.subtitle}
              </p>
            </div>

            {/* Pouvoir & Lore */}
            <div className="relative z-10 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
              <p className="text-xs leading-relaxed text-slate-200/95">
                {role.ability}
              </p>
              <p className="text-[11px] italic text-slate-400">
                « {role.lore} »
              </p>
            </div>

            {/* Indication de fermeture instantanée */}
            <p className="relative z-10 text-[10px] font-medium tracking-[0.16em] uppercase text-slate-300/70">
              Relâchez pour masquer
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
