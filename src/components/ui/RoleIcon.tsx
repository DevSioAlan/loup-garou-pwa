"use client";

import { motion, type TargetAndTransition } from "framer-motion";
import {
  Biohazard,
  Bird,
  Crosshair,
  Crown,
  Dog,
  Drama,
  Eye,
  Feather,
  Flame,
  FlameKindling,
  FlaskConical,
  Gavel,
  Heart,
  Moon,
  Music,
  PawPrint,
  ScrollText,
  Shield,
  Smile,
  Sparkles,
  Sword,
  User,
  Users,
  VenetianMask,
  Wand2,
} from "lucide-react";
import type { RoleIconName } from "@/types/game";

interface RoleIconProps {
  icon: RoleIconName;
  className?: string;
  color?: string;
  glow?: boolean;
  animated?: boolean;
  strokeWidth?: number;
}

function getIconAnimation(icon: RoleIconName): {
  animate: TargetAndTransition;
  duration: number;
} {
  switch (icon) {
    case "moon":
      return {
        animate: { scale: [1, 1.08, 1], opacity: [0.88, 1, 0.88] },
        duration: 3.4,
      };
    case "flame":
    case "pyro":
      return {
        animate: {
          scale: [1, 1.09, 0.96, 1.06, 1],
          y: [0, -1.5, 0.5, -1, 0],
        },
        duration: 2.6,
      };
    case "sparkles":
    case "feather":
    case "bird":
      return {
        animate: {
          y: [0, -2, 0],
          rotate: [0, 5, -4, 0],
          opacity: [0.85, 1, 0.85],
        },
        duration: 3.2,
      };
    case "music":
      return {
        animate: {
          y: [0, -2.5, 0],
          rotate: [-5, 6, -5],
          scale: [1, 1.07, 1],
        },
        duration: 2.5,
      };
    case "sword":
    case "gavel":
      return {
        animate: {
          rotate: [-4, 4, -4],
          scale: [1, 1.06, 1],
        },
        duration: 3.1,
      };
    case "biohazard":
      return {
        animate: {
          rotate: [0, 12, -12, 0],
          scale: [1, 1.08, 1],
          opacity: [0.85, 1, 0.85],
        },
        duration: 3.5,
      };
    case "heart":
      return {
        animate: { scale: [1, 1.1, 1, 1.06, 1] },
        duration: 2.8,
      };
    case "eye":
    case "wand":
    case "mask":
    case "drama":
      return {
        animate: { scale: [1, 1.07, 1], opacity: [0.86, 1, 0.86] },
        duration: 3.0,
      };
    default:
      return {
        animate: { y: [0, -1.5, 0], scale: [1, 1.04, 1] },
        duration: 3.6,
      };
  }
}

function renderGlyph(
  icon: RoleIconName,
  className: string,
  style: React.CSSProperties | undefined,
  strokeWidth: number
) {
  const props = {
    className,
    style,
    strokeWidth,
    "aria-hidden": true as const,
  };

  switch (icon) {
    case "moon":
      return <Moon {...props} />;
    case "wolf":
    case "paw":
    case "pawprint":
      return <PawPrint {...props} />;
    case "flame":
      return <Flame {...props} />;
    case "eye":
      return <Eye {...props} />;
    case "flask":
      return <FlaskConical {...props} />;
    case "crosshair":
      return <Crosshair {...props} />;
    case "shield":
      return <Shield {...props} />;
    case "heart":
      return <Heart {...props} />;
    case "sparkles":
      return <Sparkles {...props} />;
    case "scroll":
      return <ScrollText {...props} />;
    case "smile":
      return <Smile {...props} />;
    case "feather":
      return <Feather {...props} />;
    case "bird":
      return <Bird {...props} />;
    case "dog":
      return <Dog {...props} />;
    case "crown":
      return <Crown {...props} />;
    case "music":
      return <Music {...props} />;
    case "biohazard":
      return <Biohazard {...props} />;
    case "sword":
      return <Sword {...props} />;
    case "users":
      return <Users {...props} />;
    case "wand":
      return <Wand2 {...props} />;
    case "mask":
      return <VenetianMask {...props} />;
    case "pyro":
      return <FlameKindling {...props} />;
    case "drama":
      return <Drama {...props} />;
    case "gavel":
      return <Gavel {...props} />;
    case "user":
    default:
      return <User {...props} />;
  }
}

/**
 * Rendu unifié des icônes de rôles et d'avatars avec micro-animations GPU fluides.
 */
export function RoleIcon({
  icon,
  className = "h-5 w-5",
  color,
  glow = false,
  animated = true,
  strokeWidth = 1.8,
}: RoleIconProps) {
  const style: React.CSSProperties | undefined =
    color || glow
      ? {
          color,
          filter: glow && color ? `drop-shadow(0 0 12px ${color})` : undefined,
        }
      : undefined;

  if (!animated) {
    return renderGlyph(icon, className, style, strokeWidth);
  }

  const { animate, duration } = getIconAnimation(icon);

  return (
    <motion.span
      animate={animate}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      className="inline-flex items-center justify-center will-change-transform"
    >
      {renderGlyph(icon, className, style, strokeWidth)}
    </motion.span>
  );
}
