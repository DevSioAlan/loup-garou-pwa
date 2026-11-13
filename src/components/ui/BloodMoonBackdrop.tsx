"use client";

export interface BloodMoonBackdropProps {
  theme?: "night" | "day";
}

const STARS = [
  { x: 9, y: 12, size: 2, opacity: 0.55 },
  { x: 18, y: 26, size: 1.5, opacity: 0.35 },
  { x: 27, y: 8, size: 2, opacity: 0.45 },
  { x: 38, y: 19, size: 1, opacity: 0.35 },
  { x: 64, y: 11, size: 1.5, opacity: 0.4 },
  { x: 74, y: 24, size: 2, opacity: 0.6 },
  { x: 84, y: 10, size: 1.5, opacity: 0.45 },
  { x: 91, y: 31, size: 2, opacity: 0.5 },
  { x: 13, y: 52, size: 1.5, opacity: 0.3 },
  { x: 24, y: 69, size: 1, opacity: 0.28 },
  { x: 79, y: 58, size: 1.5, opacity: 0.32 },
  { x: 88, y: 74, size: 2, opacity: 0.4 },
  { x: 46, y: 7, size: 1.5, opacity: 0.48 },
  { x: 55, y: 29, size: 1, opacity: 0.3 },
];

/**
 * Arrière-plan atmosphérique dynamique Jour/Nuit avec Lune texturée et aurores GPU.
 */
export function BloodMoonBackdrop({
  theme = "night",
}: BloodMoonBackdropProps) {
  const isDay = theme === "day";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-1000"
      style={{
        backgroundColor: isDay ? "#17110e" : "#090a0f",
      }}
    >
      {/* Dégradé de ciel profond */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 85% 65% at 50% 0%, rgba(30, 14, 24, 0.72), transparent 70%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(18, 12, 32, 0.58), transparent 72%)",
          opacity: isDay ? 0.2 : 1,
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 95% 70% at 50% 0%, rgba(180, 83, 9, 0.34), rgba(120, 53, 15, 0.16) 45%, transparent 74%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(69, 26, 3, 0.42), transparent 72%)",
          opacity: isDay ? 1 : 0,
        }}
      />

      {/* Aurores & brumes animées */}
      <div
        className="animate-aurora-breathe absolute -top-36 left-1/2 h-[30rem] w-[42rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle at 50% 55%, rgba(251, 191, 36, 0.32), rgba(234, 88, 12, 0.18) 46%, rgba(180, 83, 9, 0.08) 68%, transparent 78%)"
            : "radial-gradient(circle at 50% 55%, rgba(225, 29, 72, 0.28), rgba(155, 27, 48, 0.2) 44%, rgba(124, 58, 237, 0.12) 66%, transparent 76%)",
        }}
      />

      <div
        className="animate-aurora-drift-left absolute -left-24 top-[14%] h-[26rem] w-[26rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.07) 58%, transparent 76%)"
            : "radial-gradient(circle, rgba(124, 58, 237, 0.18), rgba(88, 28, 135, 0.08) 58%, transparent 75%)",
        }}
      />

      <div
        className="animate-aurora-drift-right absolute -right-24 top-[28%] h-[28rem] w-[28rem] rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(circle, rgba(251, 146, 60, 0.18), rgba(217, 119, 6, 0.08) 55%, transparent 74%)"
            : "radial-gradient(circle, rgba(190, 18, 60, 0.2), rgba(127, 29, 29, 0.08) 55%, transparent 74%)",
        }}
      />

      <div
        className="animate-mist-glide absolute -bottom-24 left-1/2 h-[22rem] w-[46rem] -translate-x-1/2 rounded-full blur-3xl transition-all duration-1000"
        style={{
          background: isDay
            ? "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.12), rgba(120, 53, 15, 0.08) 52%, transparent 74%)"
            : "radial-gradient(ellipse at center, rgba(109, 40, 217, 0.13), rgba(155, 27, 48, 0.08) 50%, transparent 72%)",
        }}
      />

      {/* Astre lunaire réaliste avec mers lunaires, cratères et limbe atmosphérique */}
      <div
        className="absolute right-2 top-1 h-36 w-36 transition-all duration-1000 sm:right-12 sm:top-4 sm:h-52 sm:w-52"
        style={{
          transform: isDay ? "translate3d(-16px, -6px, 0) scale(0.92)" : "translate3d(0, 0, 0) scale(1)",
          opacity: isDay ? 0.52 : 0.92,
        }}
      >
        {/* Halo volumétrique */}
        <div
          className="absolute -inset-6 rounded-full blur-2xl transition-all duration-1000"
          style={{
            background: isDay
              ? "radial-gradient(circle, rgba(253, 224, 71, 0.34), rgba(245, 158, 11, 0.16) 55%, transparent 75%)"
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

            <radialGradient id="moon-limb-shadow" cx="68%" cy="66%" r="65%">
              <stop offset="35%" stopColor="rgba(0,0,0,0)" />
              <stop offset="78%" stopColor="rgba(12,4,8,0.34)" />
              <stop offset="100%" stopColor="rgba(6,2,6,0.72)" />
            </radialGradient>

            <clipPath id="moon-disc-clip">
              <circle cx="100" cy="100" r="88" />
            </clipPath>
          </defs>

          {/* Disque lunaire */}
          <g clipPath="url(#moon-disc-clip)">
            <circle
              cx="100"
              cy="100"
              r="88"
              fill={isDay ? "url(#moon-photosphere-day)" : "url(#moon-photosphere-night)"}
            />

            {/* Mers lunaires sombres (Maria) */}
            <g fill={isDay ? "rgba(120, 53, 15, 0.22)" : "rgba(42, 7, 15, 0.38)"}>
              <ellipse cx="74" cy="72" rx="28" ry="21" transform="rotate(-18 74 72)" />
              <ellipse cx="116" cy="64" rx="20" ry="15" transform="rotate(14 116 64)" />
              <ellipse cx="64" cy="118" rx="22" ry="27" transform="rotate(12 64 118)" />
              <ellipse cx="128" cy="108" rx="24" ry="18" transform="rotate(-24 128 108)" />
              <path d="M88,88 Q106,80 118,96 Q104,118 82,108 Z" />
            </g>

            {/* Cratères majeurs (relief + bordure claire) */}
            <g>
              <circle cx="108" cy="134" r="10.5" fill="rgba(25, 4, 10, 0.34)" />
              <circle
                cx="107"
                cy="133"
                r="10.2"
                fill="none"
                stroke="rgba(255, 224, 210, 0.25)"
                strokeWidth="1.2"
              />

              <circle cx="62" cy="86" r="8" fill="rgba(25, 4, 10, 0.3)" />
              <circle
                cx="61"
                cy="85"
                r="7.8"
                fill="none"
                stroke="rgba(255, 224, 210, 0.22)"
                strokeWidth="1"
              />

              <circle cx="136" cy="84" r="6.5" fill="rgba(25, 4, 10, 0.28)" />
              <circle cx="92" cy="54" r="5.2" fill="rgba(25, 4, 10, 0.26)" />
              <circle cx="80" cy="144" r="4.5" fill="rgba(25, 4, 10, 0.25)" />
              <circle cx="142" cy="128" r="5" fill="rgba(25, 4, 10, 0.25)" />
              <circle cx="46" cy="110" r="4" fill="rgba(25, 4, 10, 0.24)" />
            </g>

            {/* Rayons d'éjecta fins autour de Tycho */}
            <g
              stroke={isDay ? "rgba(254, 243, 199, 0.22)" : "rgba(255, 216, 208, 0.16)"}
              strokeWidth="0.9"
            >
              <line x1="108" y1="134" x2="82" y2="162" />
              <line x1="108" y1="134" x2="146" y2="152" />
              <line x1="108" y1="134" x2="94" y2="96" />
              <line x1="108" y1="134" x2="128" y2="104" />
            </g>

            {/* Ombrage sphérique du terminateur */}
            <circle cx="100" cy="100" r="88" fill="url(#moon-limb-shadow)" />
          </g>

          {/* Limbe atmosphérique fin */}
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={
              isDay
                ? "rgba(253, 224, 71, 0.45)"
                : "rgba(254, 205, 211, 0.28)"
            }
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* Champ d'étoiles fixe */}
      <div
        className="transition-opacity duration-1000"
        style={{ opacity: isDay ? 0.14 : 1 }}
      >
        {STARS.map((star, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-amber-100"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* Grain subtil type vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#090a0f]/82" />
    </div>
  );
}
