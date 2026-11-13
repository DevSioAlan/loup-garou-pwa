"use client";

import type { BackdropTheme } from "@/types/game";

export interface BloodMoonBackdropProps {
  theme?: BackdropTheme;
}

const STARS = [
  { x: 9, y: 12, size: 2, opacity: 0.65, delay: 0 },
  { x: 18, y: 26, size: 1.5, opacity: 0.45, delay: 1.1 },
  { x: 27, y: 8, size: 2, opacity: 0.55, delay: 0.6 },
  { x: 38, y: 19, size: 1.5, opacity: 0.42, delay: 2.2 },
  { x: 64, y: 11, size: 1.8, opacity: 0.5, delay: 1.4 },
  { x: 74, y: 24, size: 2.2, opacity: 0.68, delay: 0.3 },
  { x: 84, y: 10, size: 1.5, opacity: 0.5, delay: 1.9 },
  { x: 91, y: 31, size: 2, opacity: 0.55, delay: 2.6 },
  { x: 13, y: 52, size: 1.5, opacity: 0.36, delay: 0.9 },
  { x: 24, y: 69, size: 1.2, opacity: 0.32, delay: 1.7 },
  { x: 79, y: 58, size: 1.5, opacity: 0.38, delay: 0.4 },
  { x: 88, y: 74, size: 2, opacity: 0.46, delay: 2.1 },
  { x: 46, y: 7, size: 1.6, opacity: 0.52, delay: 1.3 },
  { x: 55, y: 29, size: 1.2, opacity: 0.35, delay: 2.8 },
];

const AMBIENT_PARTICLES = [
  { x: 12, y: 78, size: 4, delay: 0 },
  { x: 22, y: 64, size: 3, delay: 1.4 },
  { x: 34, y: 84, size: 5, delay: 2.6 },
  { x: 48, y: 72, size: 3, delay: 0.7 },
  { x: 61, y: 86, size: 4, delay: 3.1 },
  { x: 74, y: 68, size: 3.5, delay: 1.9 },
  { x: 86, y: 80, size: 4.5, delay: 0.4 },
  { x: 92, y: 58, size: 3, delay: 2.3 },
  { x: 16, y: 42, size: 3.5, delay: 3.5 },
  { x: 68, y: 44, size: 3, delay: 1.1 },
];

/**
 * Arrière-plan atmosphérique dynamique multi-phases (Nuit, Jour, Victoire, Défaite)
 * utilisant uniquement des dégradés radiaux et transformations GPU 60 FPS.
 */
export function BloodMoonBackdrop({
  theme = "night",
}: BloodMoonBackdropProps) {
  const isNight = theme === "night";
  const isDay = theme === "day";
  const isVictory = theme === "victory";
  const isDefeat = theme === "defeat";

  const baseColor = isDay
    ? "#17110e"
    : isVictory
      ? "#07140f"
      : isDefeat
        ? "#0e060f"
        : "#090a0f";

  return (
    <div
      aria-hidden="true"
      className="gpu-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: baseColor }}
    >
      {/* Nuit : ciel cramoisi & indigo */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 85% 65% at 50% 0%, rgba(30, 14, 24, 0.78), transparent 70%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(18, 12, 32, 0.62), transparent 72%)",
          opacity: isNight ? 1 : 0.15,
        }}
      />

      {/* Jour : aube dorée & ambrée */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 95% 70% at 50% 0%, rgba(217, 119, 6, 0.36), rgba(146, 64, 14, 0.18) 45%, transparent 74%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(69, 26, 3, 0.45), transparent 72%)",
          opacity: isDay ? 1 : 0,
        }}
      />

      {/* Victoire : ciel Émeraude & Or céleste */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 95% 70% at 50% 0%, rgba(16, 185, 129, 0.28), rgba(212, 175, 55, 0.16) 46%, transparent 75%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(6, 78, 59, 0.44), transparent 72%)",
          opacity: isVictory ? 1 : 0,
        }}
      />

      {/* Défaite : crépuscule Pourpre sombre & Cendres */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 95% 70% at 50% 0%, rgba(136, 19, 55, 0.34), rgba(88, 28, 135, 0.2) 48%, transparent 75%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(24, 12, 26, 0.55), transparent 72%)",
          opacity: isDefeat ? 1 : 0,
        }}
      />

      {/* Aurores animées GPU */}
      <div
        className="animate-aurora-breathe absolute -top-36 left-1/2 h-[30rem] w-[42rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle at 50% 55%, rgba(251, 191, 36, 0.34), rgba(234, 88, 12, 0.18) 46%, rgba(180, 83, 9, 0.08) 68%, transparent 78%)"
            : isVictory
              ? "radial-gradient(circle at 50% 55%, rgba(52, 211, 153, 0.28), rgba(251, 191, 36, 0.2) 46%, rgba(16, 185, 129, 0.08) 68%, transparent 78%)"
              : isDefeat
                ? "radial-gradient(circle at 50% 55%, rgba(159, 18, 57, 0.3), rgba(88, 28, 135, 0.22) 46%, rgba(30, 27, 46, 0.1) 68%, transparent 78%)"
                : "radial-gradient(circle at 50% 55%, rgba(225, 29, 72, 0.3), rgba(155, 27, 48, 0.2) 44%, rgba(124, 58, 237, 0.14) 66%, transparent 76%)",
        }}
      />

      <div
        className="animate-aurora-drift-left absolute -left-24 top-[14%] h-[26rem] w-[26rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.07) 58%, transparent 76%)"
            : isVictory
              ? "radial-gradient(circle, rgba(16, 185, 129, 0.22), rgba(5, 150, 105, 0.08) 58%, transparent 76%)"
              : isDefeat
                ? "radial-gradient(circle, rgba(107, 33, 168, 0.2), rgba(59, 7, 100, 0.08) 58%, transparent 76%)"
                : "radial-gradient(circle, rgba(124, 58, 237, 0.18), rgba(88, 28, 135, 0.08) 58%, transparent 75%)",
        }}
      />

      <div
        className="animate-aurora-drift-right absolute -right-24 top-[28%] h-[28rem] w-[28rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle, rgba(251, 146, 60, 0.2), rgba(217, 119, 6, 0.08) 55%, transparent 74%)"
            : isVictory
              ? "radial-gradient(circle, rgba(251, 191, 36, 0.2), rgba(16, 185, 129, 0.08) 55%, transparent 74%)"
              : isDefeat
                ? "radial-gradient(circle, rgba(153, 27, 27, 0.22), rgba(76, 5, 25, 0.09) 55%, transparent 74%)"
                : "radial-gradient(circle, rgba(190, 18, 60, 0.2), rgba(127, 29, 29, 0.08) 55%, transparent 74%)",
        }}
      />

      <div
        className="animate-mist-glide absolute -bottom-24 left-1/2 h-[22rem] w-[46rem] -translate-x-1/2 rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.13), rgba(120, 53, 15, 0.08) 52%, transparent 74%)"
            : isVictory
              ? "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.16), rgba(212, 175, 55, 0.08) 52%, transparent 74%)"
              : isDefeat
                ? "radial-gradient(ellipse at center, rgba(107, 33, 168, 0.15), rgba(136, 19, 55, 0.09) 52%, transparent 74%)"
                : "radial-gradient(ellipse at center, rgba(109, 40, 217, 0.14), rgba(155, 27, 48, 0.08) 50%, transparent 72%)",
        }}
      />

      {/* Astre principal + rayons solaires diffus (Jour) */}
      <div
        className="absolute right-2 top-1 h-36 w-36 transition-all duration-1000 sm:right-12 sm:top-4 sm:h-52 sm:w-52"
        style={{
          transform: isDay
            ? "translate3d(-16px, -6px, 0) scale(0.94)"
            : isVictory
              ? "translate3d(-8px, -2px, 0) scale(1.04)"
              : "translate3d(0, 0, 0) scale(1)",
          opacity: isDay ? 0.68 : isDefeat ? 0.56 : 0.94,
        }}
      >
        {/* Rayons solaires rotatifs très diffus uniquement le Jour */}
        {isDay && (
          <div
            className="animate-solar-rays absolute -inset-16 rounded-full opacity-45"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg 22deg, rgba(253, 224, 71, 0.22) 32deg, transparent 44deg 86deg, rgba(251, 191, 36, 0.18) 98deg, transparent 110deg 158deg, rgba(253, 224, 71, 0.2) 170deg, transparent 184deg 236deg, rgba(245, 158, 11, 0.18) 250deg, transparent 266deg 315deg, rgba(253, 224, 71, 0.2) 330deg, transparent 345deg 360deg)",
              maskImage:
                "radial-gradient(circle, rgba(0,0,0,1) 18%, rgba(0,0,0,0.45) 52%, transparent 74%)",
              WebkitMaskImage:
                "radial-gradient(circle, rgba(0,0,0,1) 18%, rgba(0,0,0,0.45) 52%, transparent 74%)",
            }}
          />
        )}

        {/* Halo volumétrique */}
        <div
          className="absolute -inset-6 rounded-full blur-2xl transition-all duration-1000"
          style={{
            background: isDay
              ? "radial-gradient(circle, rgba(253, 224, 71, 0.36), rgba(245, 158, 11, 0.16) 55%, transparent 75%)"
              : isVictory
                ? "radial-gradient(circle, rgba(52, 211, 153, 0.34), rgba(251, 191, 36, 0.22) 55%, transparent 76%)"
                : isDefeat
                  ? "radial-gradient(circle, rgba(136, 19, 55, 0.3), rgba(88, 28, 135, 0.18) 55%, transparent 76%)"
                  : "radial-gradient(circle, rgba(239, 68, 68, 0.34), rgba(155, 27, 48, 0.18) 56%, transparent 76%)",
          }}
        />

        <svg
          viewBox="0 0 200 200"
          className="relative h-full w-full drop-shadow-[0_0_28px_rgba(185,28,28,0.45)]"
        >
          <defs>
            <radialGradient id="moon-photosphere-night" cx="38%" cy="34%" r="68%">
              <stop offset="0%" stopColor="#fde8e0" />
              <stop offset="28%" stopColor="#f3a49b" />
              <stop offset="60%" stopColor="#be283c" />
              <stop offset="86%" stopColor="#5d111e" />
              <stop offset="100%" stopColor="#26060d" />
            </radialGradient>

            <radialGradient id="moon-photosphere-day" cx="42%" cy="38%" r="66%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="35%" stopColor="#fde68a" />
              <stop offset="72%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>

            <radialGradient id="moon-photosphere-victory" cx="40%" cy="36%" r="68%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="34%" stopColor="#a7f3d0" />
              <stop offset="68%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#064e3b" />
            </radialGradient>

            <radialGradient id="moon-photosphere-defeat" cx="44%" cy="40%" r="68%">
              <stop offset="0%" stopColor="#e9d5ff" />
              <stop offset="30%" stopColor="#9333ea" />
              <stop offset="65%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#1c0917" />
            </radialGradient>

            <radialGradient id="moon-limb-shadow" cx="68%" cy="66%" r="65%">
              <stop offset="35%" stopColor="rgba(0,0,0,0)" />
              <stop offset="78%" stopColor="rgba(12,4,8,0.34)" />
              <stop offset="100%" stopColor="rgba(6,2,6,0.72)" />
            </radialGradient>

            <clipPath id="moon-disc-clip">
              <circle cx="100" cy="100" r="88" />
            </clipPath>
          </defs>

          <g clipPath="url(#moon-disc-clip)">
            <circle
              cx="100"
              cy="100"
              r="88"
              fill={
                isDay
                  ? "url(#moon-photosphere-day)"
                  : isVictory
                    ? "url(#moon-photosphere-victory)"
                    : isDefeat
                      ? "url(#moon-photosphere-defeat)"
                      : "url(#moon-photosphere-night)"
              }
            />

            <g
              fill={
                isDay
                  ? "rgba(120, 53, 15, 0.2)"
                  : isVictory
                    ? "rgba(6, 78, 59, 0.28)"
                    : "rgba(42, 7, 15, 0.38)"
              }
            >
              <ellipse cx="74" cy="72" rx="28" ry="21" transform="rotate(-18 74 72)" />
              <ellipse cx="116" cy="64" rx="20" ry="15" transform="rotate(14 116 64)" />
              <ellipse cx="64" cy="118" rx="22" ry="27" transform="rotate(12 64 118)" />
              <ellipse cx="128" cy="108" rx="24" ry="18" transform="rotate(-24 128 108)" />
              <path d="M88,88 Q106,80 118,96 Q104,118 82,108 Z" />
            </g>

            <g>
              <circle cx="108" cy="134" r="10.5" fill="rgba(25, 4, 10, 0.3)" />
              <circle
                cx="107"
                cy="133"
                r="10.2"
                fill="none"
                stroke="rgba(255, 224, 210, 0.24)"
                strokeWidth="1.2"
              />
              <circle cx="62" cy="86" r="8" fill="rgba(25, 4, 10, 0.28)" />
              <circle
                cx="61"
                cy="85"
                r="7.8"
                fill="none"
                stroke="rgba(255, 224, 210, 0.22)"
                strokeWidth="1"
              />
              <circle cx="136" cy="84" r="6.5" fill="rgba(25, 4, 10, 0.25)" />
              <circle cx="92" cy="54" r="5.2" fill="rgba(25, 4, 10, 0.24)" />
              <circle cx="80" cy="144" r="4.5" fill="rgba(25, 4, 10, 0.22)" />
              <circle cx="142" cy="128" r="5" fill="rgba(25, 4, 10, 0.22)" />
              <circle cx="46" cy="110" r="4" fill="rgba(25, 4, 10, 0.22)" />
            </g>

            <g
              stroke={
                isDay
                  ? "rgba(254, 243, 199, 0.22)"
                  : isVictory
                    ? "rgba(209, 250, 229, 0.22)"
                    : "rgba(255, 216, 208, 0.16)"
              }
              strokeWidth="0.9"
            >
              <line x1="108" y1="134" x2="82" y2="162" />
              <line x1="108" y1="134" x2="146" y2="152" />
              <line x1="108" y1="134" x2="94" y2="96" />
              <line x1="108" y1="134" x2="128" y2="104" />
            </g>

            <circle cx="100" cy="100" r="88" fill="url(#moon-limb-shadow)" />
          </g>

          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={
              isDay
                ? "rgba(253, 224, 71, 0.45)"
                : isVictory
                  ? "rgba(110, 231, 183, 0.42)"
                  : isDefeat
                    ? "rgba(216, 180, 254, 0.24)"
                    : "rgba(254, 205, 211, 0.28)"
            }
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* Étoiles scintillantes (Nuit & Défaite légère) */}
      <div
        className="transition-opacity duration-1000"
        style={{ opacity: isDay ? 0.08 : isVictory ? 0.5 : 1 }}
      >
        {STARS.map((star, index) => (
          <span
            key={index}
            className="animate-star-twinkle absolute rounded-full bg-amber-100"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Particules dynamiques selon Jour / Victoire / Défaite */}
      {(isDay || isVictory || isDefeat) && (
        <div className="pointer-events-none absolute inset-0">
          {AMBIENT_PARTICLES.map((p, index) => (
            <span
              key={`${theme}-${index}`}
              className={`absolute rounded-full ${
                isVictory
                  ? "animate-victory-ember"
                  : isDefeat
                    ? "animate-defeat-ash"
                    : "animate-golden-float"
              }`}
              style={{
                left: `${p.x}%`,
                top: isDefeat ? `${Math.max(6, 100 - p.y)}%` : `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                background: isVictory
                  ? index % 2 === 0
                    ? "rgba(251, 191, 36, 0.8)"
                    : "rgba(52, 211, 153, 0.8)"
                  : isDefeat
                    ? index % 2 === 0
                      ? "rgba(225, 29, 72, 0.55)"
                      : "rgba(192, 132, 252, 0.45)"
                    : "rgba(253, 224, 71, 0.65)",
                boxShadow: isVictory
                  ? "0 0 10px rgba(251, 191, 36, 0.5)"
                  : isDay
                    ? "0 0 8px rgba(251, 191, 36, 0.4)"
                    : "none",
              }}
            />
          ))}
        </div>
      )}

      {/* Vignette inférieure */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#090a0f]/82" />
    </div>
  );
}
