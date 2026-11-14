"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fingerprint, Lock, Moon } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { GameRole } from "@/types/game";

interface RoleCardProps {
  role: GameRole;
  /**
   * Active l'aura distinctive dès la sélection de la carte (accueil / galerie),
   * tout en la gardant neutre face cachée en partie multijoueur pour préserver le secret.
   */
  ambientWhenSelected?: boolean;
}

type RoleAuraFamily = "wolf" | "mystic" | "village" | "solitaire";

function getRoleAuraFamily(roleId: string): RoleAuraFamily {
  if (
    roleId === "loup-garou" ||
    roleId === "loup-garou-blanc" ||
    roleId === "grand-mechant-loup" ||
    roleId === "infect-pere-des-loups" ||
    roleId === "loup-mystique"
  ) {
    return "wolf";
  }
  if (
    roleId === "voyante" ||
    roleId === "sorciere" ||
    roleId === "cupidon" ||
    roleId === "corbeau" ||
    roleId === "renard" ||
    roleId === "voleur" ||
    roleId === "comedien"
  ) {
    return "mystic";
  }
  if (
    roleId === "ange" ||
    roleId === "enfant-sauvage" ||
    roleId === "joueur-de-flute" ||
    roleId === "pyromane"
  ) {
    return "solitaire";
  }
  return "village";
}

const WOLF_EMBERS = [
  { left: "6%", bottom: "26%", size: 4.5, delay: 0, duration: 3.0, drift: -14 },
  { left: "14%", bottom: "6%", size: 3.5, delay: 0.9, duration: 3.4, drift: -10 },
  { left: "86%", bottom: "8%", size: 4, delay: 0.4, duration: 3.2, drift: 12 },
  { left: "94%", bottom: "28%", size: 4.5, delay: 1.5, duration: 3.6, drift: 14 },
];

const MYSTIC_STARS = [
  { top: "4%", left: "6%", size: 5, delay: 0 },
  { top: "14%", right: "4%", size: 5.5, delay: 0.6 },
  { top: "48%", left: "2%", size: 4.5, delay: 1.2 },
  { bottom: "14%", right: "3%", size: 5, delay: 0.4 },
  { bottom: "4%", left: "8%", size: 4.5, delay: 1.0 },
];

interface RoleAuraStageProps {
  role: GameRole;
  active: boolean;
  intense: boolean;
  tilt: { x: number; y: number };
}

/**
 * Aura animée GPU-compositée derrière et autour de la carte, adaptée au camp et au rôle.
 */
function RoleAuraStage({ role, active, intense, tilt }: RoleAuraStageProps) {
  const family = getRoleAuraFamily(role.id);
  const stageOpacity = intense ? 1 : active ? 0.78 : 0.22;
  const stageScale = intense ? 1.06 : active ? 1 : 0.94;

  const primaryGlow = role.aura.primary;
  const secondaryGlow = role.aura.secondary;

  return (
    <motion.div
      aria-hidden="true"
      animate={{
        opacity: stageOpacity,
        scale: stageScale,
        x: intense ? tilt.x * 16 : 0,
        y: intense ? tilt.y * 14 : 0,
      }}
      transition={{ duration: intense ? 0.3 : 0.42, ease: "easeOut" }}
      className="pointer-events-none absolute -inset-7 -z-10 will-change-transform"
    >
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key={`${role.id}-${family}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative h-full w-full"
          >
            {/* Halo ambiant principal doux */}
            <motion.div
              animate={{
                opacity: intense ? [0.78, 1, 0.78] : [0.52, 0.76, 0.52],
                scale: [0.97, 1.04, 0.97],
              }}
              transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-2 rounded-[2.6rem] blur-2xl will-change-transform"
              style={{
                background: `radial-gradient(circle at 50% 48%, ${primaryGlow}68 0%, ${secondaryGlow}42 46%, transparent 78%)`,
              }}
            />

            {/* 1. CAMP DES LOUPS : lueur cramoisie/argentée pulsante + fines ondes + braises subtiles */}
            {family === "wolf" && (
              <>
                {[0, 1].map((wave) => (
                  <motion.span
                    key={`wolf-wave-${wave}`}
                    animate={{
                      scale: [0.84, 1.12],
                      opacity: [intense ? 0.52 : 0.34, 0],
                    }}
                    transition={{
                      duration: 3.4,
                      delay: wave * 1.7,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className="absolute inset-4 rounded-[2.2rem] border will-change-transform"
                    style={{
                      borderColor:
                        role.id === "loup-garou-blanc"
                          ? "rgba(226, 232, 240, 0.38)"
                          : "rgba(244, 63, 94, 0.42)",
                      boxShadow: `0 0 24px ${primaryGlow}38`,
                    }}
                  />
                ))}

                {WOLF_EMBERS.map((ember, idx) => (
                  <motion.span
                    key={`wolf-ember-${idx}`}
                    animate={{
                      y: [0, -78, -135],
                      x: [0, ember.drift, ember.drift * 0.4],
                      opacity: [0, intense ? 0.85 : 0.55, 0],
                      scale: [0.7, 1.15, 0.5],
                    }}
                    transition={{
                      duration: ember.duration,
                      delay: ember.delay,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className="absolute rounded-full will-change-transform"
                    style={{
                      left: ember.left,
                      bottom: ember.bottom,
                      width: ember.size,
                      height: ember.size,
                      backgroundColor:
                        role.id === "loup-garou-blanc" && idx % 2 === 1
                          ? "#E2E8F0"
                          : "#FB7185",
                      boxShadow:
                        role.id === "loup-garou-blanc" && idx % 2 === 1
                          ? "0 0 10px rgba(226, 232, 240, 0.75)"
                          : `0 0 10px ${primaryGlow}95`,
                    }}
                  />
                ))}
              </>
            )}

            {/* 2. RÔLES MYSTIQUES : halo violet/indigo éthéré + volutes douces + scintillements */}
            {family === "mystic" && (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full opacity-75 blur-2xl will-change-transform"
                  style={{
                    background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${primaryGlow}46 70deg, transparent 150deg, rgba(99, 102, 241, 0.42) 235deg, transparent 360deg)`,
                  }}
                />

                {MYSTIC_STARS.map((star, idx) => (
                  <motion.span
                    key={`mystic-star-${idx}`}
                    animate={{
                      opacity: [0.15, intense ? 0.95 : 0.68, 0.15],
                      scale: [0.65, 1.35, 0.65],
                    }}
                    transition={{
                      duration: 2.6 + (idx % 3) * 0.6,
                      delay: star.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute rounded-full bg-indigo-100 will-change-transform"
                    style={{
                      top: star.top,
                      left: star.left,
                      right: star.right,
                      bottom: star.bottom,
                      width: star.size,
                      height: star.size,
                      boxShadow: `0 0 12px ${primaryGlow}, 0 0 22px rgba(129, 140, 248, 0.7)`,
                    }}
                  />
                ))}
              </>
            )}

            {/* 3. RÔLES PROTECTEURS & VILLAGE : aura ambrée/dorée ou émeraude avec rayonnement doux */}
            {family === "village" && (
              <>
                <motion.div
                  animate={{ rotate: 360, opacity: [0.42, 0.7, 0.42] }}
                  transition={{
                    rotate: { duration: 30, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="absolute inset-1 rounded-full blur-2xl will-change-transform"
                  style={{
                    background: `conic-gradient(from 30deg at 50% 50%, transparent 0deg, ${primaryGlow}36 45deg, transparent 90deg, ${secondaryGlow}36 150deg, transparent 210deg, ${primaryGlow}34 280deg, transparent 360deg)`,
                  }}
                />
                <motion.div
                  animate={{ scale: [0.95, 1.03, 0.95], opacity: [0.3, 0.56, 0.3] }}
                  transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-5 rounded-[2.2rem] border will-change-transform"
                  style={{
                    borderColor: `${secondaryGlow}38`,
                    boxShadow: `0 0 28px ${secondaryGlow}30`,
                  }}
                />
              </>
            )}

            {/* 4. RÔLES SOLITAIRES : lueur céleste opalescente ou sauvage à oscillation lente */}
            {family === "solitaire" && (
              <>
                <motion.div
                  animate={{
                    x: [-14, 14, -14],
                    y: [-10, 10, -10],
                    scale: [0.95, 1.07, 0.95],
                  }}
                  transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-2 rounded-full blur-2xl will-change-transform"
                  style={{
                    background:
                      role.id === "ange"
                        ? "radial-gradient(circle at 38% 36%, rgba(253, 224, 71, 0.44) 0%, rgba(186, 230, 253, 0.34) 48%, transparent 74%)"
                        : "radial-gradient(circle at 38% 36%, rgba(132, 204, 22, 0.42) 0%, rgba(190, 18, 60, 0.28) 52%, transparent 74%)",
                  }}
                />
                <motion.div
                  animate={{
                    x: [14, -14, 14],
                    y: [10, -10, 10],
                    scale: [1.05, 0.94, 1.05],
                  }}
                  transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-2 rounded-full blur-2xl will-change-transform"
                  style={{
                    background:
                      role.id === "ange"
                        ? "radial-gradient(circle at 64% 64%, rgba(192, 132, 252, 0.4) 0%, rgba(224, 242, 254, 0.28) 46%, transparent 74%)"
                        : role.id === "joueur-de-flute"
                          ? "radial-gradient(circle at 64% 64%, rgba(16, 185, 129, 0.44) 0%, rgba(56, 189, 248, 0.3) 48%, transparent 74%)"
                          : "radial-gradient(circle at 64% 64%, rgba(225, 29, 72, 0.36) 0%, rgba(212, 175, 55, 0.24) 48%, transparent 74%)",
                  }}
                />
              </>
            )}

            {/* 5. SIGNATURES VISUELLES SPÉCIFIQUES À CHAQUE RÔLE */}
            {role.id === "infect-pere-des-loups" && (
              <motion.div
                animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.35, 0.72, 0.35] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-1 rounded-[2.6rem] blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 30% 70%, rgba(132, 204, 22, 0.42), rgba(22, 101, 52, 0.28) 50%, transparent 76%)",
                }}
              />
            )}

            {role.id === "corbeau" && (
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                className="absolute inset-1 rounded-full border border-violet-400/25"
                style={{
                  boxShadow: "0 0 38px rgba(139, 92, 246, 0.38)",
                }}
              />
            )}

            {role.id === "joueur-de-flute" && (
              <>
                <motion.div
                  animate={{ scale: [0.85, 1.24], opacity: [0.55, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-3 rounded-full border border-emerald-400/45"
                />
                <motion.div
                  animate={{ scale: [0.85, 1.24], opacity: [0.55, 0] }}
                  transition={{ duration: 2.6, delay: 1.3, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-3 rounded-full border border-sky-400/40"
                />
              </>
            )}

            {role.id === "renard" && (
              <motion.div
                animate={{ x: [-12, 12, -12], opacity: [0.38, 0.7, 0.38] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-2 rounded-[2.4rem] blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 70% 30%, rgba(249, 115, 22, 0.44), rgba(251, 146, 60, 0.18) 55%, transparent 76%)",
                }}
              />
            )}

            {role.id === "chevalier-epee-rouillee" && (
              <motion.div
                animate={{ rotate: [-6, 6, -6], opacity: [0.35, 0.65, 0.35] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-3 rounded-[2rem] border border-orange-500/35 blur-[1px]"
                style={{
                  boxShadow: "0 0 34px rgba(234, 88, 12, 0.34)",
                }}
              />
            )}

            {(role.id === "soeurs" || role.id === "freres") && (
              <motion.div
                animate={{ scale: [0.96, 1.06, 0.96], opacity: [0.42, 0.74, 0.42] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-4 rounded-[2.4rem] border"
                style={{
                  borderColor: `${role.aura.primary}44`,
                  boxShadow: `0 0 32px ${role.aura.primary}40`,
                }}
              />
            )}

            {(role.id === "servante-devouee" ||
              role.id === "montreur-dours" ||
              role.id === "comedien" ||
              role.id === "juge-begue") && (
              <motion.div
                animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.4, 0.72, 0.4] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-2 rounded-full blur-2xl"
                style={{
                  background: `radial-gradient(circle, ${role.aura.primary}55, ${role.aura.secondary}26 55%, transparent 76%)`,
                }}
              />
            )}

            {role.id === "loup-mystique" && (
              <motion.div
                animate={{ scale: [0.94, 1.1, 0.94], opacity: [0.42, 0.8, 0.42] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-2 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, rgba(225, 29, 72, 0.5), rgba(147, 51, 234, 0.34) 52%, transparent 78%)",
                }}
              />
            )}

            {role.id === "pyromane" && (
              <motion.div
                animate={{ scale: [0.96, 1.12, 0.96], opacity: [0.48, 0.86, 0.48] }}
                transition={{ duration: 2.3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-2 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 62%, rgba(249, 115, 22, 0.56), rgba(220, 38, 38, 0.36) 50%, transparent 78%)",
                }}
              />
            )}

            {role.id === "voleur" && (
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                className="absolute inset-3 rounded-full border border-dashed border-cyan-400/35 blur-[1px]"
              />
            )}
          </motion.div>
        ) : (
          /* Mode scellé neutre en partie multijoueur pour préserver le secret du rôle */
          <motion.div
            key="sealed-neutral-aura"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-4 rounded-[2.4rem] blur-2xl"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(155, 27, 48, 0.36) 0%, rgba(124, 58, 237, 0.2) 52%, transparent 78%)",
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Carte de rôle interactive Dark Frosted Glass :
 * - Maintenir appuyé (onPointerDown) : retourne la carte en 3D avec ressort Apple fluide, reflet vitré glissant et révélation du rôle.
 * - Déplacer le doigt (onPointerMove) : parallaxe 3D + reflet spéculaire réactif au toucher.
 * - Relâcher ou quitter la zone (onPointerUp / onPointerLeave / onPointerCancel) : se referme instantanément.
 * - select-none + -webkit-touch-callout:none pour bloquer le menu contextuel mobile.
 */
export function RoleCard({ role, ambientWhenSelected = false }: RoleCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pulseWave, setPulseWave] = useState(0);

  // Sécurité supplémentaire : fermeture automatique si le relâchement a lieu hors fenêtre
  useEffect(() => {
    if (!isRevealed) return;

    const closeCard = () => {
      setIsRevealed(false);
      setTilt({ x: 0, y: 0 });
    };
    window.addEventListener("pointerup", closeCard);
    window.addEventListener("pointercancel", closeCard);
    window.addEventListener("touchend", closeCard);
    window.addEventListener("touchcancel", closeCard);
    window.addEventListener("blur", closeCard);

    return () => {
      window.removeEventListener("pointerup", closeCard);
      window.removeEventListener("pointercancel", closeCard);
      window.removeEventListener("touchend", closeCard);
      window.removeEventListener("touchcancel", closeCard);
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
      triggerHaptic(28);
      setPulseWave((n) => n + 1);
    }
    setIsRevealed(true);
    updatePointerTilt(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRevealed) return;
    updatePointerTilt(e);
  };

  const handleRevealEnd = () => {
    if (isRevealed) {
      triggerHaptic(14);
    }
    setIsRevealed(false);
    setTilt({ x: 0, y: 0 });
  };

  // Calcul du tilt 3D et de la position du reflet holographique
  const rotateYTarget = isRevealed ? 180 + tilt.x * 9 : 0;
  const rotateXTarget = isRevealed ? -tilt.y * 8 : 0;
  const sheenX = 50 - tilt.x * 32;
  const sheenY = 50 + tilt.y * 32;
  const showAura = isRevealed || ambientWhenSelected;

  return (
    <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]">
      {/* Aura distinctive animée derrière et autour de la carte */}
      <RoleAuraStage
        role={role}
        active={showAura}
        intense={isRevealed}
        tilt={tilt}
      />

      {/* Onde tactile universelle (sert de retour haptique visuel sur iOS/desktop) */}
      <AnimatePresence>
        {pulseWave > 0 && (
          <motion.div
            key={pulseWave}
            aria-hidden="true"
            initial={{ opacity: 0.55, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.07 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
            className="pointer-events-none absolute -inset-1 z-20 rounded-[28px] border"
            style={{ borderColor: `${role.aura.primary}90` }}
          />
        )}
      </AnimatePresence>

      {/* Zone tactile 3D interactive multi-navigateurs */}
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
            if (!isRevealed) {
              triggerHaptic(28);
              setPulseWave((n) => n + 1);
            }
            setIsRevealed(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleRevealEnd();
          }
        }}
        style={{
          perspective: "1200px",
          WebkitPerspective: "1200px",
        }}
        className="perspective-1200 no-callout select-none touch-pan-y cursor-pointer rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#07080D]"
      >
        <motion.div
          animate={{
            rotateY: rotateYTarget,
            rotateX: rotateXTarget,
            scale: isRevealed ? 1.03 : 1,
          }}
          transition={
            isRevealed
              ? { type: "spring", stiffness: 250, damping: 24, mass: 0.84 }
              : { type: "spring", stiffness: 460, damping: 32, mass: 0.58 }
          }
          onAnimationStart={() => setIsFlipping(true)}
          onAnimationComplete={() => setIsFlipping(false)}
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            willChange: isRevealed || isFlipping ? "transform" : "auto",
          }}
          className="preserve-3d relative aspect-[3/4.2] w-full"
        >
          {/* FACE CACHÉE (0°) — Enveloppe 3D pure sans backdrop-filter direct pour préserver backface-visibility */}
          <div
            aria-hidden={isRevealed}
            className="backface-hidden absolute inset-0 rounded-[26px]"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg) translateZ(2px)",
              transformStyle: "flat",
              pointerEvents: isRevealed ? "none" : "auto",
            }}
          >
            <div
              className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[26px] border border-white/15 p-5 transition-[border-color,box-shadow] duration-300"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.015) 38%, rgba(9, 10, 15, 0) 100%), linear-gradient(160deg, rgba(20, 21, 32, 0.94) 0%, rgba(12, 13, 18, 0.96) 55%, rgba(8, 9, 14, 0.98) 100%)",
                boxShadow: ambientWhenSelected
                  ? `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 32px ${role.aura.primary}22, 0 24px 56px -12px rgba(0, 0, 0, 0.72)`
                  : "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 24px 56px -12px rgba(0, 0, 0, 0.72), 0 6px 20px rgba(0, 0, 0, 0.36)",
                ...(ambientWhenSelected
                  ? {
                      borderColor: `${role.aura.primary}4A`,
                    }
                  : {}),
              }}
            >
              {/* Reflet vitré diagonal lors du déclenchement du retournement */}
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={{
                  x: isRevealed ? "140%" : "-140%",
                  opacity: isRevealed ? [0, 0.75, 0] : 0,
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-2/3 -skew-x-12"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.22) 50%, transparent 100%)",
                }}
              />

              {/* Bordure intérieure fine */}
              <div className="pointer-events-none absolute inset-2.5 rounded-[18px] border border-white/12" />

              {/* Ornements de coins */}
              <span className="pointer-events-none absolute left-4 top-4 h-2.5 w-2.5 border-l-2 border-t-2 border-amber-300/55" />
              <span className="pointer-events-none absolute right-4 top-4 h-2.5 w-2.5 border-r-2 border-t-2 border-amber-300/55" />
              <span className="pointer-events-none absolute bottom-4 left-4 h-2.5 w-2.5 border-b-2 border-l-2 border-amber-300/55" />
              <span className="pointer-events-none absolute bottom-4 right-4 h-2.5 w-2.5 border-b-2 border-r-2 border-amber-300/55" />

              {/* En-tête dos de carte */}
              <div className="relative z-10 flex w-full items-center justify-between px-1 pt-1 text-[10px] font-semibold tracking-[0.22em] uppercase text-amber-200/75">
                <span>Identité</span>
                <span className="inline-flex items-center gap-1 text-rose-300/85">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Scellée
                </span>
              </div>

              {/* Sceau central Lune de Sang */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
                  className="flex h-32 w-32 items-center justify-center rounded-full border border-dashed border-amber-300/30"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-gradient-to-b from-rose-950/55 via-[#12131C]/80 to-[#090A0F]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_24px_rgba(225,29,72,0.28)]" />
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
                  animate={{ scale: [1, 1.07, 1], opacity: [0.78, 1, 0.78] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                >
                  <Fingerprint className="h-5 w-5" aria-hidden="true" />
                </motion.div>
                <p className="text-xs font-medium tracking-wide text-amber-100/95">
                  Maintenir appuyé
                </p>
                <p className="text-[11px] text-slate-400">
                  pour révéler votre rôle
                </p>
              </div>
            </div>
          </div>

          {/* FACE RÉVÉLÉE (180°) — Enveloppe 3D pure à l'endroit avec flash vitré & aura du rôle */}
          <div
            aria-hidden={!isRevealed}
            className="backface-hidden absolute inset-0 rounded-[26px]"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
              transformStyle: "flat",
              pointerEvents: isRevealed ? "auto" : "none",
            }}
          >
            <div
              className={`relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[26px] border ${role.aura.borderClass} p-5`}
              style={{
                background: `linear-gradient(165deg, ${role.aura.primary}29 0%, rgba(16, 17, 25, 0.94) 48%, rgba(9, 10, 15, 0.98) 100%)`,
                boxShadow: isRevealed
                  ? `inset 0 1px 0 rgba(255, 255, 255, 0.24), ${role.aura.glowShadow}`
                  : "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 24px 56px -12px rgba(0, 0, 0, 0.72)",
              }}
            >
              {/* Reflet vitré glissant / flash lumineux à l'ouverture de la carte */}
              <motion.div
                key={`flash-${pulseWave}`}
                aria-hidden="true"
                initial={{ x: "-135%", opacity: 0 }}
                animate={{
                  x: isRevealed ? "160%" : "-135%",
                  opacity: isRevealed ? [0, 0.92, 0] : 0,
                }}
                transition={{ duration: 0.68, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.34) 48%, rgba(255, 255, 255, 0.12) 60%, transparent 100%)",
                }}
              />

              {/* Reflet spéculaire holographique interactif suivant le doigt */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 transition-opacity duration-200"
                style={{
                  opacity: isRevealed ? 0.66 : 0,
                  background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255, 255, 255, 0.26) 0%, ${role.aura.primary}2E 32%, transparent 65%)`,
                }}
              />

              {/* Lueur interne douce en haut de la carte */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 left-1/2 h-36 w-56 -translate-x-1/2 rounded-full blur-2xl"
                style={{
                  background: `radial-gradient(circle, ${role.aura.primary}55 0%, transparent 72%)`,
                }}
              />

              {/* Badge de faction */}
              <div className="relative z-10 flex w-full items-center justify-between pt-0.5">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ${role.aura.badgeClass}`}
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
                  className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/55"
                  style={{
                    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 28px ${role.aura.primary}48, inset 0 0 18px ${role.aura.primary}2E`,
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

              {/* Pouvoir & Lore sur cartouche sombre optimisée mobile */}
              <div className="relative z-10 flex flex-col gap-2 rounded-2xl border border-white/12 bg-black/55 p-3 text-center">
                <p className="text-xs leading-relaxed text-slate-100/95">
                  {role.ability}
                </p>
                <p className="text-[11px] italic text-slate-300/80">
                  « {role.lore} »
                </p>
              </div>

              {/* Bouton/indication de fermeture instantanée */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevealEnd();
                }}
                className="relative z-10 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-medium tracking-[0.16em] uppercase text-slate-200/85 transition hover:bg-black/75"
              >
                Relâcher ou toucher pour masquer
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
