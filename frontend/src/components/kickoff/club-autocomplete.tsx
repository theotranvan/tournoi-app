"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useClubFFFSearch } from "@/hooks/use-clubs";
import { cn } from "@/lib/utils";
import type { FFFClub } from "@/types/api";

interface ClubAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (club: FFFClub) => void;
  placeholder?: string;
  className?: string;
}

export function ClubAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher un club FFF…",
  className,
}: ClubAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data: clubs = [] } = useClubFFFSearch(value);

  const showDropdown = open && value.length >= 2 && clubs.length > 0;
  const effectiveHighlightIndex =
    highlightIndex >= 0 && highlightIndex < clubs.length ? highlightIndex : -1;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectClub = useCallback(
    (club: FFFClub) => {
      onChange(club.name);
      onSelect?.(club);
      setOpen(false);
    },
    [onChange, onSelect],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, clubs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && effectiveHighlightIndex >= 0) {
      e.preventDefault();
      selectClub(clubs[effectiveHighlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (effectiveHighlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[effectiveHighlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [effectiveHighlightIndex]);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
          role="listbox"
        >
          {clubs.map((club, i) => (
            <li
              key={club.fff_id}
              role="option"
              aria-selected={i === effectiveHighlightIndex}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                i === effectiveHighlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectClub(club);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <ClubLogo club={club} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{club.name}</p>
                {club.colors && (
                  <p className="text-xs text-muted-foreground truncate">
                    {club.colors}
                  </p>
                )}
              </div>
              {(club.city || club.postal_code) && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {[club.city, club.postal_code?.slice(0, 2)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClubLogo({ club }: { club: FFFClub }) {
  const [imgError, setImgError] = useState(false);

  if (club.logo && !imgError) {
    return (
      <img
        src={club.logo}
        alt={club.short_name || club.name}
        width={32}
        height={32}
        className="rounded-full object-contain bg-muted shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <Avatar
      fallback={club.short_name || club.name}
      size="sm"
    />
  );
}
