"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  Minus,
  Plus,
  Shuffle,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { GAME_ROLES } from "@/data/roles";
import { getCompositionStats } from "@/lib/balancer";
import { RoleIcon } from "@/components/ui/RoleIcon";
import type { GameRole, RoleComposition } from "@/types/game";

interface GameConfiguratorProps {
  playerCount: number;
  composition: RoleComposition;
  presetLabel: string;
  isCustomEdited: boolean;
  onChangePlayerCount: (nextCount: number) => void;
  onVaryComposition: () => void;
  onAutoBalance: () => void;
  onAdjustRole: (roleId: string, delta: number) => void;
  onInspectRole: (role: GameRole) => void;
}

/**
 * Configurateur de partie intelligent :
 * - Choix du nombre de joueurs (4 à 30) via slider ou boutons +/-
 * - Auto-équilibrage intelligent & bouton "Varier la composition"
 * - Ajustement manuel rôle par rôle (+ / -) pour tous les rôles du catalogue
 */
export function GameConfigurator({
  playerCount,
  composition,
  presetLabel,
  isCustomEdited,
  onChangePlayerCount,
  onVaryComposition,
  onAutoBalance,
  onAdjustRole,
  onInspectRole,
}: GameConfiguratorProps) {
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const stats = getCompositionStats(composition, playerCount);

  const toneBadgeClass =
    stats.balanceTone === "balanced"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
      : stats.balanceTone === "mismatch"
        ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
        : "border-amber-400/40 bg-amber-500/15 text-amber-200";

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* Carte principale : Nombre de joueurs & Auto-équilibrage */}
      <section className="glass-panel rounded-3xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold tracking-wide text-amber-100">
              Nombre de joueurs
            </h2>
          </div>
          <span className="rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-0.5 text-sm font-bold text-amber-100">
            {playerCount}
          </span>
        </div>

        {/* Slider + boutons - / + */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Retirer un joueur"
            disabled={playerCount <= 4}
            onClick={() => onChangePlayerCount(playerCount - 1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-white transition-transform active:scale-95 disabled:opacity-35"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex-1">
            <input
              type="range"
              min={4}
              max={30}
              value={playerCount}
              aria-label="Sélecteur de nombre de joueurs"
              onChange={(e) => onChangePlayerCount(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>4 min</span>
              <span>17</span>
              <span>30 max</span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Ajouter un joueur"
            disabled={playerCount >= 30}
            onClick={() => onChangePlayerCount(playerCount + 1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-white transition-transform active:scale-95 disabled:opacity-35"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton Varier la composition + État d'équilibre */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onVaryComposition}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-2xl border border-purple-400/35 bg-gradient-to-r from-purple-600/25 via-rose-600/20 to-amber-500/20 px-3.5 text-xs font-semibold text-amber-100 transition-transform active:scale-[0.98]"
          >
            <Shuffle className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <span>Varier la composition</span>
          </button>

          {isCustomEdited && (
            <button
              type="button"
              onClick={onAutoBalance}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border border-amber-300/35 bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 transition-transform active:scale-[0.98]"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ré-équilibrer</span>
            </button>
          )}
        </div>

        {/* Résumé Factions & Équilibre */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-[11px]">
          <div className="flex items-center gap-2.5 text-slate-300">
            <span className="text-rose-300 font-medium">
              {stats.wolves} Loup{stats.wolves > 1 ? "s" : ""}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-sky-200 font-medium">
              {stats.village} Village
            </span>
            {stats.solitaire > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-amber-200 font-medium">
                  {stats.solitaire} Solitaire{stats.solitaire > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${toneBadgeClass}`}
          >
            {stats.balanceTone === "balanced" && (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            )}
            <span>
              {stats.balanceLabel} ({stats.total}/{playerCount})
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-300" aria-hidden="true" />
            Variante : <strong className="text-slate-200">{isCustomEdited ? "Personnalisée" : presetLabel}</strong>
          </span>
          <span>Touchez un rôle pour lire son pouvoir</span>
        </div>
      </section>

      {/* Liste des 14 rôles avec ajustement manuel + / - */}
      <section aria-label="Catalogue complet des rôles" className="space-y-2">
        {GAME_ROLES.map((role) => {
          const count = composition[role.id] ?? 0;
          const isActive = count > 0;
          const isExpanded = expandedRoleId === role.id;

          return (
            <div
              key={role.id}
              className={`rounded-2xl border transition-all ${
                isActive
                  ? "border-white/20 bg-white/[0.06] shadow-[0_6px_22px_rgba(0,0,0,0.4)]"
                  : "border-white/8 bg-white/[0.02] opacity-80"
              }`}
              style={
                isActive
                  ? {
                      borderColor: `${role.aura.primary}55`,
                      boxShadow: `0 0 18px ${role.aura.primary}18`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2.5 p-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRoleId((prev) => (prev === role.id ? null : role.id))
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45"
                    style={{
                      boxShadow: isActive
                        ? `0 0 14px ${role.aura.primary}38`
                        : undefined,
                    }}
                  >
                    <RoleIcon
                      icon={role.icon}
                      color={role.aura.primary}
                      glow={isActive}
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-amber-50">
                        {role.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider ${role.aura.badgeClass}`}
                      >
                        {role.factionLabel}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-400">
                      {role.subtitle}
                    </p>
                  </div>
                </button>

                {/* Boutons manuels - / + */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Retirer ${role.name}`}
                    disabled={count <= 0}
                    onClick={() => onAdjustRole(role.id, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-slate-200 transition-transform active:scale-90 disabled:opacity-25"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>

                  <span
                    className={`w-6 text-center text-sm font-bold ${
                      isActive ? "text-amber-200" : "text-slate-500"
                    }`}
                  >
                    {count}
                  </span>

                  <button
                    type="button"
                    aria-label={`Ajouter ${role.name}`}
                    disabled={count >= role.maxCount}
                    onClick={() => onAdjustRole(role.id, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-slate-200 transition-transform active:scale-90 disabled:opacity-25"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 px-3 py-2.5 text-xs text-slate-300 space-y-2">
                  <p className="leading-relaxed">{role.ability}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] italic text-slate-400">
                      « {role.lore} »
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectRole(role)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span>Voir en 3D</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
