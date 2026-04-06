"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { MatchContextMenu } from "./match-context-menu";
import type { MatchList, MatchPhase, MatchStatus, ScheduleDay } from "@/types/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  live: "bg-green-500/20 text-green-400 border-green-500/30",
  finished: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  postponed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const PHASE_LABEL: Record<MatchPhase, string> = {
  group: "Poule",
  r16: "1/8",
  quarter: "1/4",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SlotId {
  fieldId: number;
  fieldName: string;
  time: string; // ISO string
}

interface PlanningGridProps {
  day: ScheduleDay;
  tournamentId: string;
  allMatches: MatchList[];
  conflictMatchIds: Set<string>;
  grayedOutMatchIds: Set<string>;
  onMoveMatch: (matchId: string, fieldId: number, startTime: string) => void;
  onSwapMatches: (matchIdA: string, matchIdB: string) => void;
  onConflictDrop: (matchId: string, fieldId: number, startTime: string, conflictTeam: string) => void;
  onLockToggle: (match: MatchList) => void;
  onPostpone: (match: MatchList) => void;
  onDelete: (match: MatchList) => void;
}

// ─── Draggable Match Cell ───────────────────────────────────────────────────

function DraggableMatchCell({
  match,
  tournamentId,
  isConflict,
  isGrayedOut,
  onLockToggle,
  onPostpone,
  onDelete,
}: {
  match: MatchList;
  tournamentId: string;
  isConflict: boolean;
  isGrayedOut: boolean;
  onLockToggle: (m: MatchList) => void;
  onPostpone: (m: MatchList) => void;
  onDelete: (m: MatchList) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: match.id,
    data: { match },
    disabled: match.is_locked,
  });

  const hasScore = match.score_home !== null && match.score_away !== null;
  const isLive = match.status === "live";

  return (
    <MatchContextMenu
      match={match}
      tournamentId={tournamentId}
      onLockToggle={() => onLockToggle(match)}
      onPostpone={() => onPostpone(match)}
      onDelete={() => onDelete(match)}
    >
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`block rounded-lg border p-2.5 text-xs transition-all cursor-grab active:cursor-grabbing select-none ${STATUS_COLOR[match.status]} ${
          isDragging ? "opacity-30 scale-95" : ""
        } ${isConflict ? "ring-2 ring-red-500 shadow-red-500/20 shadow-lg" : ""} ${
          isGrayedOut ? "opacity-30 pointer-events-none" : ""
        } ${match.is_locked ? "ring-1 ring-amber-500/50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {isLive && <LiveIndicator size="sm" />}
            <span className="font-medium truncate">
              {formatTime(match.start_time)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {match.is_locked && (
              <span className="text-[9px] text-amber-400" title="Verrouillé">🔒</span>
            )}
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
              {PHASE_LABEL[match.phase]}
            </Badge>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="truncate">{match.display_home}</span>
            {hasScore && <span className="font-bold ml-1">{match.score_home}</span>}
          </div>
          <div className="flex items-center justify-between">
            <span className="truncate">{match.display_away}</span>
            {hasScore && <span className="font-bold ml-1">{match.score_away}</span>}
          </div>
        </div>
        <div className="text-[9px] opacity-70 mt-1">
          {match.category_name} • {match.duration_minutes}min
        </div>
      </div>
    </MatchContextMenu>
  );
}

// ─── Droppable Slot ─────────────────────────────────────────────────────────

function DroppableSlot({
  slotId,
  children,
  hasMatch,
  draggedMatch,
  allMatches,
}: {
  slotId: string;
  children?: React.ReactNode;
  hasMatch: boolean;
  draggedMatch: MatchList | null;
  allMatches: MatchList[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  // Compute drop validity color
  let dropColor = "";
  if (isOver && draggedMatch && !hasMatch) {
    // Check if drop would create a conflict
    const parsed = JSON.parse(slotId) as SlotId;
    const slotTime = new Date(parsed.time).getTime();
    const dragDuration = draggedMatch.duration_minutes * 60_000;
    const homeTeam = draggedMatch.team_home;
    const awayTeam = draggedMatch.team_away;

    const hasConflict = allMatches.some((m) => {
      if (m.id === draggedMatch.id) return false;
      const mTime = new Date(m.start_time).getTime();
      const mEnd = mTime + m.duration_minutes * 60_000;
      const dragEnd = slotTime + dragDuration;
      const overlaps = slotTime < mEnd && dragEnd > mTime;
      if (!overlaps) return false;
      return (
        (homeTeam && (m.team_home === homeTeam || m.team_away === homeTeam)) ||
        (awayTeam && (m.team_home === awayTeam || m.team_away === awayTeam))
      );
    });

    dropColor = hasConflict
      ? "ring-2 ring-red-400 bg-red-500/10"
      : "ring-2 ring-green-400 bg-green-500/10";
  } else if (isOver && hasMatch) {
    dropColor = "ring-2 ring-blue-400 bg-blue-500/10"; // swap indicator
  }

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] rounded-lg transition-all ${dropColor} ${
        !children ? "border border-dashed border-border/50" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ─── Drag Overlay (floating preview) ────────────────────────────────────────

function DragPreview({ match }: { match: MatchList }) {
  return (
    <div className={`rounded-lg border p-2.5 text-xs shadow-xl ${STATUS_COLOR[match.status]} w-[180px]`}>
      <div className="font-medium mb-1">{formatTime(match.start_time)}</div>
      <div>{match.display_home}</div>
      <div>{match.display_away}</div>
      <div className="text-[9px] opacity-70 mt-1">{match.category_name}</div>
    </div>
  );
}

// ─── Main Grid ──────────────────────────────────────────────────────────────

export function PlanningGrid({
  day,
  tournamentId,
  allMatches,
  conflictMatchIds,
  grayedOutMatchIds,
  onMoveMatch,
  onSwapMatches,
  onConflictDrop,
  onLockToggle,
  onPostpone,
  onDelete,
}: PlanningGridProps) {
  const [activeMatch, setActiveMatch] = useState<MatchList | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Build time slots for empty cells
  const allTimeSlots = useMemo(() => {
    const slots = new Set<string>();
    for (const fs of day.fields) {
      for (const m of fs.matches) {
        slots.add(m.start_time);
        // Add slot after this match
        const endTime = new Date(
          new Date(m.start_time).getTime() + m.duration_minutes * 60_000
        ).toISOString();
        slots.add(endTime);
      }
    }
    return Array.from(slots).sort();
  }, [day]);

  // Build a match lookup: fieldId -> time -> match
  const matchMap = useMemo(() => {
    const map = new Map<string, MatchList>();
    for (const fs of day.fields) {
      for (const m of fs.matches) {
        map.set(`${fs.field.id}:${m.start_time}`, m);
      }
    }
    return map;
  }, [day]);

  function handleDragStart(event: DragStartEvent) {
    const match = event.active.data.current?.match as MatchList;
    setActiveMatch(match ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveMatch(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const draggedMatch = active.data.current.match as MatchList;
    const overId = over.id as string;

    // Dropping onto a slot
    try {
      const slot = JSON.parse(overId) as SlotId;
      const targetKey = `${slot.fieldId}:${slot.time}`;
      const occupant = matchMap.get(targetKey);

      if (occupant && occupant.id !== draggedMatch.id) {
        // Swap
        onSwapMatches(draggedMatch.id, occupant.id);
      } else if (!occupant) {
        // Check for team conflict
        const slotTime = new Date(slot.time).getTime();
        const dragDuration = draggedMatch.duration_minutes * 60_000;
        const homeTeam = draggedMatch.team_home;
        const awayTeam = draggedMatch.team_away;

        const conflictMatch = allMatches.find((m) => {
          if (m.id === draggedMatch.id) return false;
          const mTime = new Date(m.start_time).getTime();
          const mEnd = mTime + m.duration_minutes * 60_000;
          const dragEnd = slotTime + dragDuration;
          const overlaps = slotTime < mEnd && dragEnd > mTime;
          if (!overlaps) return false;
          return (
            (homeTeam && (m.team_home === homeTeam || m.team_away === homeTeam)) ||
            (awayTeam && (m.team_home === awayTeam || m.team_away === awayTeam))
          );
        });

        if (conflictMatch) {
          const conflictTeamName =
            draggedMatch.team_home &&
            (conflictMatch.team_home === draggedMatch.team_home ||
              conflictMatch.team_away === draggedMatch.team_home)
              ? draggedMatch.display_home
              : draggedMatch.display_away;
          onConflictDrop(draggedMatch.id, slot.fieldId, slot.time, conflictTeamName);
        } else {
          onMoveMatch(draggedMatch.id, slot.fieldId, slot.time);
        }
      }
    } catch {
      // Not a valid slot JSON
    }
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(day.fields.length, 6)}, minmax(180px, 1fr))`,
        }}
      >
        {day.fields.map((fieldSlot) => (
          <div key={fieldSlot.field.id} className="space-y-1.5">
            <div className="text-sm font-medium text-center py-1.5 bg-muted rounded-lg sticky top-0 z-10">
              {fieldSlot.field.name}
            </div>

            {/* Render time-ordered slots */}
            {allTimeSlots.map((time) => {
              const match = matchMap.get(`${fieldSlot.field.id}:${time}`);
              const slotId = JSON.stringify({
                fieldId: fieldSlot.field.id,
                fieldName: fieldSlot.field.name,
                time,
              } satisfies SlotId);

              // Only render empty slots if no match at this time for this field
              if (!match) {
                // Don't show empty slots that fall during an ongoing match on this field
                const isDuringMatch = fieldSlot.matches.some((m) => {
                  const mStart = new Date(m.start_time).getTime();
                  const mEnd = mStart + m.duration_minutes * 60_000;
                  const slotT = new Date(time).getTime();
                  return slotT > mStart && slotT < mEnd;
                });
                if (isDuringMatch) return null;

                return (
                  <DroppableSlot
                    key={slotId}
                    slotId={slotId}
                    hasMatch={false}
                    draggedMatch={activeMatch}
                    allMatches={allMatches}
                  />
                );
              }

              return (
                <DroppableSlot
                  key={slotId}
                  slotId={slotId}
                  hasMatch={true}
                  draggedMatch={activeMatch}
                  allMatches={allMatches}
                >
                  <DraggableMatchCell
                    match={match}
                    tournamentId={tournamentId}
                    isConflict={conflictMatchIds.has(match.id)}
                    isGrayedOut={grayedOutMatchIds.has(match.id)}
                    onLockToggle={onLockToggle}
                    onPostpone={onPostpone}
                    onDelete={onDelete}
                  />
                </DroppableSlot>
              );
            })}
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeMatch && <DragPreview match={activeMatch} />}
      </DragOverlay>
    </DndContext>
  );
}
