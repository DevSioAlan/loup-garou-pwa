"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GameRole, RoleComposition } from "@/types/game";

interface RoleStripProps {
  roles: GameRole[];
  selectedRoleId: string;
  composition: RoleComposition;
  onSelectRole: (roleId: string) => void;
}

/**
 * Barre horizontale des rôles :
 * - Swipe tactile fluide sans barre de défilement sur mobile (.no-scrollbar)
 * - Drag-to-scroll à la souris + conversion molette verticale -> horizontale sur PC
 * - Flèches discrètes gauche/droite (< / >)
 */
export function RoleStrip({
  roles,
  selectedRoleId,
  composition,
  onSelectRole,
}: RoleStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [updateScrollButtons, roles.length]);

  // Conversion molette verticale -> défilement horizontal fluide sur PC
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollRef.current) return;
    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el || !dragStateRef.current.isDown) return;
      const delta = e.clientX - dragStateRef.current.startX;
      if (Math.abs(delta) > 4) {
        dragStateRef.current.moved = true;
      }
      el.scrollLeft = dragStateRef.current.scrollLeft - delta;
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDown = false;
      setIsDragging(false);
      // Réinitialiser le flag moved après le cycle de clic
      window.setTimeout(() => {
        dragStateRef.current.moved = false;
      }, 0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const scrollByAmount = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 170, behavior: "smooth" });
  };

  return (
    <div className="relative flex w-full items-center gap-1">
      {/* Flèche gauche discrète */}
      <button
        type="button"
        aria-label="Défiler les rôles vers la gauche"
        disabled={!canScrollLeft}
        onClick={() => scrollByAmount(-1)}
        className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/45 text-amber-200/90 backdrop-blur-md transition-opacity ${
          canScrollLeft
            ? "opacity-90 hover:border-amber-300/40 hover:text-amber-100"
            : "pointer-events-none opacity-20"
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Piste scrollable (tactile + souris drag + molette) */}
      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        onMouseDown={handleMouseDown}
        className={`no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-0.5 py-1 select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {roles.map((role) => {
          const active = role.id === selectedRoleId;
          const inCompo = (composition[role.id] ?? 0) > 0;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                if (dragStateRef.current.moved) return;
                onSelectRole(role.id);
              }}
              className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all select-none ${
                active
                  ? "bg-white/14 text-amber-50"
                  : "border-white/10 bg-white/[0.04] text-slate-300/85 hover:border-white/25"
              }`}
              style={
                active
                  ? {
                      borderColor: `${role.aura.primary}99`,
                      boxShadow: `0 0 16px ${role.aura.primary}45`,
                    }
                  : undefined
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: role.aura.primary,
                  opacity: inCompo || active ? 1 : 0.4,
                }}
              />
              <span>{role.name}</span>
            </button>
          );
        })}
      </div>

      {/* Flèche droite discrète */}
      <button
        type="button"
        aria-label="Défiler les rôles vers la droite"
        disabled={!canScrollRight}
        onClick={() => scrollByAmount(1)}
        className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/45 text-amber-200/90 backdrop-blur-md transition-opacity ${
          canScrollRight
            ? "opacity-90 hover:border-amber-300/40 hover:text-amber-100"
            : "pointer-events-none opacity-20"
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
