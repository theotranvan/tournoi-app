"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useTeamSuggestions } from "@/hooks/use-teams";
import { cn } from "@/lib/utils";

interface TeamNameAutocompleteProps {
  tournamentId: string;
  excludeCategory?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (name: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

export function TeamNameAutocomplete({
  tournamentId,
  excludeCategory,
  value,
  onChange,
  onSelect,
  placeholder = "FC Exemple",
  id,
  required,
  className,
}: TeamNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data: suggestions = [] } = useTeamSuggestions(
    tournamentId,
    value,
    excludeCategory
  );

  // Filter out exact match from suggestions
  const filtered = suggestions.filter(
    (s) => s.toLowerCase() !== value.toLowerCase()
  );

  const showDropdown = open && value.length >= 1 && filtered.length > 0;
  const effectiveHighlightIndex =
    highlightIndex >= 0 && highlightIndex < filtered.length ? highlightIndex : -1;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSuggestion = useCallback(
    (name: string) => {
      onChange(name);
      onSelect?.(name);
      setOpen(false);
    },
    [onChange, onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && effectiveHighlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(filtered[effectiveHighlightIndex]);
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
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
          role="listbox"
        >
          {filtered.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === effectiveHighlightIndex}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
                i === effectiveHighlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(name);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="size-2 rounded-full bg-primary/40 shrink-0" />
              <span className="truncate">{name}</span>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                Déjà inscrit
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
