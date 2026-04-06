"use client";

import { useState } from "react";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import {
  Lock,
  Unlock,
  Trash2,
  Clock,
  Eye,
} from "lucide-react";
import type { MatchList } from "@/types/api";
import Link from "next/link";

interface MatchContextMenuProps {
  match: MatchList;
  tournamentId: string;
  onLockToggle: () => void;
  onPostpone: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function MatchContextMenu({
  match,
  tournamentId,
  onLockToggle,
  onPostpone,
  onDelete,
  children,
}: MatchContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  }

  return (
    <div onContextMenu={handleContextMenu} className="relative">
      {children}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
            style={{ left: position.x, top: position.y }}
          >
            <DropdownItem
              onClick={() => {
                onLockToggle();
                setOpen(false);
              }}
            >
              {match.is_locked ? (
                <>
                  <Unlock className="size-3.5" />
                  Déverrouiller
                </>
              ) : (
                <>
                  <Lock className="size-3.5" />
                  Verrouiller
                </>
              )}
            </DropdownItem>

            <Link
              href={`/admin/match/${match.id}/score?t=${tournamentId}`}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-popover-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              <Eye className="size-3.5" />
              Voir / Saisir score
            </Link>

            <DropdownItem
              onClick={() => {
                onPostpone();
                setOpen(false);
              }}
            >
              <Clock className="size-3.5" />
              Marquer reporté
            </DropdownItem>

            <DropdownItem
              destructive
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </DropdownItem>
          </div>
        </>
      )}
    </div>
  );
}
