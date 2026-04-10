"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Users,
  Trophy,
  LayoutGrid,
  Play,
  CheckCircle2,
  Copy,
  Loader2,
  Send,
  Plus,
  Pencil,
  Trash2,
  Shuffle,
  Printer,
  FlaskConical,
  BarChart3,
  Mic2,
  LayoutList,
  Table2,
  Info,
  ListTodo,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useTournament } from "@/hooks/use-tournaments";
import { useCategories } from "@/hooks/use-categories";
import { useFields } from "@/hooks/use-fields";
import { useDays } from "@/hooks/use-days";
import { useTeams } from "@/hooks/use-teams";
import { useGroups } from "@/hooks/use-groups";
import { useMatches } from "@/hooks/use-matches";
import {
  usePublishTournament,
  useStartTournament,
  useFinishTournament,
  useDuplicateTournament,
  useUpdateTournament,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateField,
  useUpdateField,
} from "@/hooks/use-mutations";
import {
  useCreateTeam,
  useDeleteTeam,
  useGenerateGroups,
  useCreateGroup,
} from "@/hooks/use-team-mutations";
import { ClubAutocomplete } from "@/components/kickoff/club-autocomplete";
import { TournamentChecklist } from "@/components/kickoff/tournament-checklist";
import { TournamentStepper } from "@/components/kickoff/tournament-stepper";
import type { StepperStep } from "@/components/kickoff/tournament-stepper";
import { ProFeatureButton } from "@/components/ui/pro-feature-gate";
import type {
  TournamentStatus,
  Category,
  CategoryPayload,
  TournamentField,
  FieldPayload,
  Day,
  TeamPayload,
  GroupPayload,
  MatchStatus,
  MatchPhase,
  MatchList,
  FFFClub,
} from "@/types/api";

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Programmé",
  live: "En cours",
  finished: "Terminé",
  cancelled: "Annulé",
  postponed: "Reporté",
};

const MATCH_STATUS_VARIANT: Record<MatchStatus, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "outline",
  live: "default",
  finished: "secondary",
  cancelled: "destructive",
  postponed: "secondary",
};

const PHASE_LABEL: Record<MatchPhase, string> = {
  group: "Poule",
  r16: "1/8",
  quarter: "1/4",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  live: "En cours",
  finished: "Terminé",
  archived: "Archivé",
};

const STATUS_VARIANT: Record<TournamentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  published: "outline",
  live: "default",
  finished: "secondary",
  archived: "secondary",
};

// ─── Category Form Dialog ───────────────────────────────────────────────────

function CategoryFormDialog({
  open,
  onOpenChange,
  tournamentId,
  category,
  days,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  category?: Category;
  days?: Day[];
}) {
  const isEdit = !!category;
  const createMut = useCreateCategory(tournamentId);
  const updateMut = useUpdateCategory(tournamentId, category?.id ?? 0);
  const isPending = createMut.isPending || updateMut.isPending;

  const [form, setForm] = useState<CategoryPayload>({
    name: category?.name ?? "",
    display_order: category?.display_order ?? 0,
    color: category?.color ?? "#16a34a",
    points_win: category?.points_win ?? 3,
    points_draw: category?.points_draw ?? 1,
    points_loss: category?.points_loss ?? 0,
    match_duration: category?.match_duration ?? null,
    players_per_team: category?.players_per_team ?? null,
    day: category?.day ?? null,
    number_of_pools: category?.number_of_pools ?? null,
    finals_format: category?.finals_format ?? undefined,
    min_rest_matches: category?.min_rest_matches ?? undefined,
    max_consecutive_matches: category?.max_consecutive_matches ?? undefined,
  });

  // Reinitialize form when category prop changes (e.g. editing a different category)
  useEffect(() => {
    setForm({
      name: category?.name ?? "",
      display_order: category?.display_order ?? 0,
      color: category?.color ?? "#16a34a",
      points_win: category?.points_win ?? 3,
      points_draw: category?.points_draw ?? 1,
      points_loss: category?.points_loss ?? 0,
      match_duration: category?.match_duration ?? null,
      players_per_team: category?.players_per_team ?? null,
      day: category?.day ?? null,
      number_of_pools: category?.number_of_pools ?? null,
      finals_format: category?.finals_format ?? undefined,
      min_rest_matches: category?.min_rest_matches ?? undefined,
      max_consecutive_matches: category?.max_consecutive_matches ?? undefined,
    });
  }, [category?.id, open]);

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const sortedDays = (days ?? []).slice().sort((a, b) => a.order - b.order);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { ...form, name: form.name.trim() };
    if (isEdit) {
      updateMut.mutate(payload, { onSuccess: () => onOpenChange(false) });
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="U13"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-9 p-1"
              />
            </div>

            {/* Day assignment */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Jour assigné</Label>
              <Select
                value={form.day != null ? String(form.day) : ""}
                onChange={(e) =>
                  set("day", e.target.value ? Number(e.target.value) : null)
                }
                options={[
                  { value: "", label: "— Tous les jours —" },
                  ...sortedDays.map((d) => ({
                    value: String(d.id),
                    label: d.label || d.date,
                  })),
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Pts victoire</Label>
              <Input
                type="number"
                min={0}
                value={form.points_win ?? 3}
                onChange={(e) => set("points_win", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pts nul</Label>
              <Input
                type="number"
                min={0}
                value={form.points_draw ?? 1}
                onChange={(e) => set("points_draw", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Durée match (min) *</Label>
              <Input
                type="number"
                min={1}
                value={form.match_duration ?? ""}
                onChange={(e) =>
                  set(
                    "match_duration",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Défaut tournoi"
                className={!form.match_duration ? "border-amber-300" : ""}
              />
              {!form.match_duration && (
                <p className="text-[11px] text-amber-600">
                  Utilisera la valeur par défaut du tournoi
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Joueurs/équipe</Label>
              <Input
                type="number"
                min={1}
                value={form.players_per_team ?? ""}
                onChange={(e) =>
                  set(
                    "players_per_team",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="—"
              />
            </div>

            {/* Pools & Finals */}
            <div className="space-y-1.5">
              <Label>Nombre de poules</Label>
              <Input
                type="number"
                min={1}
                value={form.number_of_pools ?? ""}
                onChange={(e) =>
                  set(
                    "number_of_pools",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Format finales</Label>
              <Select
                value={form.finals_format ?? ""}
                onChange={(e) =>
                  set("finals_format", e.target.value || null)
                }
                options={[
                  { value: "", label: "— Pas de finales —" },
                  { value: "TOP2_CROSSOVER", label: "Demi-finales croisées (1er vs 2e)" },
                  { value: "TOP1_FINAL", label: "Finale directe (1er de chaque poule)" },
                ]}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.finals_format === "TOP2_CROSSOVER"
                  ? "1er Poule A vs 2e Poule B + 1er Poule B vs 2e Poule A, puis Finale et petite finale"
                  : form.finals_format === "TOP1_FINAL"
                  ? "Les premiers de chaque poule s'affrontent directement en finale"
                  : ""}
              </p>
            </div>

            {/* Rest / consecutive constraints */}
            <div className="space-y-1.5">
              <Label>Repos min (matchs)</Label>
              <Input
                type="number"
                min={0}
                value={form.min_rest_matches ?? ""}
                onChange={(e) =>
                  set(
                    "min_rest_matches",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Défaut tournoi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max consécutifs</Label>
              <Input
                type="number"
                min={1}
                value={form.max_consecutive_matches ?? ""}
                onChange={(e) =>
                  set(
                    "max_consecutive_matches",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Défaut tournoi"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ordre d&apos;affichage</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => set("display_order", Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!form.name.trim() || isPending}>
              {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Field Form Dialog ──────────────────────────────────────────────────────

/** Convert backend list format [{date,start,end}] to frontend dict format {date: [{start,end}]} */
function availListToDict(
  list: { date: string; start: string; end: string }[] | null | undefined,
): Record<string, { start: string; end: string }[]> | null {
  if (!list || !Array.isArray(list) || list.length === 0) return null;
  const dict: Record<string, { start: string; end: string }[]> = {};
  for (const slot of list) {
    if (!dict[slot.date]) dict[slot.date] = [];
    dict[slot.date].push({ start: slot.start, end: slot.end });
  }
  return dict;
}

/** Convert frontend dict format {date: [{start,end}]} to backend list format [{date,start,end}] */
function availDictToList(
  dict: Record<string, { start: string; end: string }[]> | null | undefined,
): { date: string; start: string; end: string }[] {
  if (!dict) return [];
  const list: { date: string; start: string; end: string }[] = [];
  for (const [date, slots] of Object.entries(dict)) {
    for (const slot of slots) {
      list.push({ date, start: slot.start, end: slot.end });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

function FieldFormDialog({
  open,
  onOpenChange,
  tournamentId,
  field,
  days,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  field?: TournamentField;
  days?: Day[];
}) {
  const isEdit = !!field;
  const createMut = useCreateField(tournamentId);
  const updateMut = useUpdateField(tournamentId, field?.id ?? 0);
  const isPending = createMut.isPending || updateMut.isPending;

  // Convert backend list format to frontend dict format for the form
  const fieldAvailDict = field?.availability
    ? (Array.isArray(field.availability)
        ? availListToDict(field.availability as unknown as { date: string; start: string; end: string }[])
        : field.availability)
    : null;

  const [form, setForm] = useState<FieldPayload>({
    name: field?.name ?? "",
    display_order: field?.display_order ?? 0,
    is_active: field?.is_active ?? true,
    availability: fieldAvailDict,
  });

  // Reinitialize form when field prop changes (e.g. editing a different field)
  useEffect(() => {
    const avail = field?.availability
      ? (Array.isArray(field.availability)
          ? availListToDict(field.availability as unknown as { date: string; start: string; end: string }[])
          : field.availability)
      : null;
    setForm({
      name: field?.name ?? "",
      display_order: field?.display_order ?? 0,
      is_active: field?.is_active ?? true,
      availability: avail,
    });
  }, [field?.id, open]);

  // Auto-fill availability from tournament days when creating a new field
  const sortedDays = (days ?? []).slice().sort((a, b) => a.order - b.order);

  function handleAutoFill() {
    if (!sortedDays.length) return;
    const avail: Record<string, { start: string; end: string }[]> = {};
    for (const d of sortedDays) {
      avail[d.date] = [{ start: d.start_time, end: d.end_time }];
    }
    setForm((f) => ({ ...f, availability: avail }));
  }

  function setSlot(
    date: string,
    idx: number,
    key: "start" | "end",
    value: string
  ) {
    setForm((f) => {
      const avail = { ...(f.availability ?? {}) };
      const slots = [...(avail[date] ?? [])];
      slots[idx] = { ...slots[idx], [key]: value };
      avail[date] = slots;
      return { ...f, availability: avail };
    });
  }

  function addSlot(date: string) {
    setForm((f) => {
      const avail = { ...(f.availability ?? {}) };
      const slots = [...(avail[date] ?? [])];
      slots.push({ start: "08:00", end: "18:00" });
      avail[date] = slots;
      return { ...f, availability: avail };
    });
  }

  function removeSlot(date: string, idx: number) {
    setForm((f) => {
      const avail = { ...(f.availability ?? {}) };
      const slots = [...(avail[date] ?? [])];
      slots.splice(idx, 1);
      if (slots.length === 0) {
        delete avail[date];
      } else {
        avail[date] = slots;
      }
      return { ...f, availability: Object.keys(avail).length ? avail : null };
    });
  }

  function addDay() {
    setForm((f) => {
      const avail = { ...(f.availability ?? {}) };
      // Find a date not already used
      const usedDates = new Set(Object.keys(avail));
      for (const d of sortedDays) {
        if (!usedDates.has(d.date)) {
          avail[d.date] = [{ start: d.start_time, end: d.end_time }];
          return { ...f, availability: avail };
        }
      }
      // Fallback: add today
      const today = new Date().toISOString().slice(0, 10);
      if (!usedDates.has(today)) {
        avail[today] = [{ start: "08:00", end: "18:00" }];
      }
      return { ...f, availability: Object.keys(avail).length ? avail : null };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // Convert frontend dict format to backend list format
    const payload = {
      ...form,
      name: form.name.trim(),
      availability: availDictToList(form.availability),
    };
    if (isEdit) {
      updateMut.mutate(payload as unknown as Partial<FieldPayload>, { onSuccess: () => onOpenChange(false) });
    } else {
      createMut.mutate(payload as unknown as FieldPayload, { onSuccess: () => onOpenChange(false) });
    }
  }

  const dateEntries = Object.entries(form.availability ?? {}).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le terrain" : "Nouveau terrain"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Terrain 1"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ordre</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    display_order: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="field-active"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="rounded border-input"
              />
              <Label htmlFor="field-active">Terrain actif</Label>
            </div>
          </div>

          {/* Availability Section */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Disponibilités</Label>
              <div className="flex gap-1">
                {sortedDays.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFill}
                    className="text-xs h-7"
                  >
                    Auto-remplir depuis jours
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDay}
                  className="text-xs h-7"
                >
                  <Plus className="size-3 mr-1" />
                  Jour
                </Button>
              </div>
            </div>

            {dateEntries.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune disponibilité configurée. Le terrain sera considéré
                disponible tous les jours du tournoi.
              </p>
            )}

            {dateEntries.map(([date, slots]) => (
              <div key={date} className="rounded border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      if (!newDate || newDate === date) return;
                      setForm((f) => {
                        const avail = { ...(f.availability ?? {}) };
                        avail[newDate] = avail[date];
                        delete avail[date];
                        return { ...f, availability: avail };
                      });
                    }}
                    className="h-7 text-xs w-36"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm((f) => {
                        const avail = { ...(f.availability ?? {}) };
                        delete avail[date];
                        return {
                          ...f,
                          availability: Object.keys(avail).length
                            ? avail
                            : null,
                        };
                      });
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => setSlot(date, idx, "start", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => setSlot(date, idx, "end", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSlot(date, idx)}
                      className="h-6 w-6 p-0 text-muted-foreground"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addSlot(date)}
                  className="text-xs h-6"
                >
                  <Plus className="size-3 mr-1" />
                  Créneau
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!form.name.trim() || isPending}>
              {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quick Team Form Dialog ─────────────────────────────────────────────────

function QuickTeamDialog({
  open,
  onOpenChange,
  tournamentId,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  categories: Category[];
}) {
  const createMut = useCreateTeam(tournamentId);
  const [form, setForm] = useState<TeamPayload>({
    category: categories[0]?.id ?? 0,
    name: "",
    short_name: "",
    coach_name: "",
    coach_phone: "",
    coach_email: "",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function fetchLogoAsFile(url: string, clubName: string) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const ext = blob.type.split("/")[1] || "png";
      const file = new File([blob], `${clubName}.${ext}`, { type: blob.type });
      setForm((f) => ({ ...f, logo: file }));
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      // silently ignore if logo download fails
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category) return;
    createMut.mutate(
      {
        ...form,
        name: form.name.trim(),
        short_name: form.short_name.trim() || form.name.trim().substring(0, 5),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({
            category: categories[0]?.id ?? 0,
            name: "",
            short_name: "",
            coach_name: "",
            coach_phone: "",
            coach_email: "",
          });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Nouvelle équipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Catégorie</Label>
              <Select
                value={String(form.category)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: Number(e.target.value) }))
                }
                options={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <ClubAutocomplete
                value={form.name}
                onChange={(v) =>
                  setForm((f) => ({ ...f, name: v }))
                }
                onSelect={(club: FFFClub) => {
                  setForm((f) => ({
                    ...f,
                    name: club.name,
                    short_name: f.short_name || club.short_name || club.name.substring(0, 5),
                  }));
                  if (club.logo) {
                    fetchLogoAsFile(club.logo, club.short_name || club.name);
                  }
                }}
                placeholder="Rechercher un club FFF ou saisir un nom…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Abréviation</Label>
              <Input
                value={form.short_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, short_name: e.target.value }))
                }
                placeholder="FCE"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coach</Label>
              <Input
                value={form.coach_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coach_name: e.target.value }))
                }
              />
            </div>
            {logoPreview && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="size-10 rounded-full object-contain bg-muted"
                />
                <span className="text-xs text-muted-foreground">Logo FFF récupéré</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!form.name.trim() || !form.category || createMut.isPending}
            >
              {createMut.isPending && (
                <Loader2 className="size-4 mr-1 animate-spin" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Score Cross-Table ──────────────────────────────────────────────────────

function ScoreTable({
  matches,
  categories,
}: {
  matches: MatchList[];
  categories: Category[];
}) {
  const [selectedCat, setSelectedCat] = useState(categories[0]?.id ?? 0);

  const poolMatches = useMemo(
    () => matches.filter((m) => m.category === selectedCat && m.phase === "group"),
    [matches, selectedCat],
  );

  // Collect unique teams from pool matches
  const teams = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of poolMatches) {
      if (m.team_home !== null) map.set(m.team_home, m.display_home ?? `#${m.team_home}`);
      if (m.team_away !== null) map.set(m.team_away, m.display_away ?? `#${m.team_away}`);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [poolMatches]);

  // Build score lookup: key = "home-away" → "score_home - score_away"
  const scoreMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const match of poolMatches) {
      if (match.team_home === null || match.team_away === null) continue;
      const key = `${match.team_home}-${match.team_away}`;
      if (match.score_home !== null && match.score_away !== null) {
        m.set(key, `${match.score_home}-${match.score_away}`);
      } else {
        m.set(key, "–");
      }
    }
    return m;
  }, [poolMatches]);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <Select
        value={String(selectedCat)}
        onChange={(e) => setSelectedCat(Number(e.target.value))}
        options={categories.map((c) => ({
          value: String(c.id),
          label: c.name,
        }))}
        className="w-48"
      />
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun match de poule pour cette catégorie.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-1.5 border bg-muted min-w-[100px]">Équipe</th>
                {teams.map(([tid, name]) => (
                  <th
                    key={tid}
                    className="p-1.5 border bg-muted text-center min-w-[50px]"
                    title={name}
                  >
                    {name.length > 5 ? name.substring(0, 5) : name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map(([rowId, rowName]) => (
                <tr key={rowId}>
                  <td className="p-1.5 border font-medium truncate max-w-[120px]">
                    {rowName}
                  </td>
                  {teams.map(([colId]) => {
                    if (rowId === colId) {
                      return (
                        <td key={colId} className="p-1.5 border bg-muted/50 text-center">
                          ×
                        </td>
                      );
                    }
                    const score = scoreMap.get(`${rowId}-${colId}`);
                    return (
                      <td
                        key={colId}
                        className={`p-1.5 border text-center tabular-nums ${
                          score && score !== "–" ? "font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {score ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Generate Groups Dialog ─────────────────────────────────────────────────

function GenerateGroupsDialog({
  open,
  onOpenChange,
  tournamentId,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  categories: Category[];
}) {
  const [catId, setCatId] = useState(categories[0]?.id ?? 0);
  const [numGroups, setNumGroups] = useState(2);
  const generateMut = useGenerateGroups(tournamentId, catId);

  function handleGenerate() {
    if (!catId || numGroups < 1) return;
    generateMut.mutate(
      { num_groups: numGroups },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Générer les groupes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={String(catId)}
              onChange={(e) => setCatId(Number(e.target.value))}
              options={categories.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre de groupes</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={numGroups}
              onChange={(e) => setNumGroups(Number(e.target.value))}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Les équipes seront réparties de manière équilibrée.
          </p>
          {generateMut.isError && (
            <p className="text-sm text-destructive">
              Erreur lors de la génération.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!catId || numGroups < 1 || generateMut.isPending}
          >
            {generateMut.isPending && (
              <Loader2 className="size-4 mr-1 animate-spin" />
            )}
            Générer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Groups Tab Content ─────────────────────────────────────────────────────

function GroupsTabContent({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Category[];
}) {
  const [selectedCat, setSelectedCat] = useState(categories[0]?.id ?? 0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const { data: groups, isLoading } = useGroups(tournamentId, selectedCat);
  const createGroupMut = useCreateGroup(tournamentId, selectedCat);
  const [newGroupName, setNewGroupName] = useState("");

  function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const payload: GroupPayload = {
      name: newGroupName.trim(),
      display_order: (groups?.length ?? 0) + 1,
    };
    createGroupMut.mutate(payload, {
      onSuccess: () => {
        setAddGroupOpen(false);
        setNewGroupName("");
      },
    });
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Créez d&apos;abord des catégories.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Select
          value={String(selectedCat)}
          onChange={(e) => setSelectedCat(Number(e.target.value))}
          options={categories.map((c) => ({
            value: String(c.id),
            label: c.name,
          }))}
          className="w-48"
        />
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGenerateOpen(true)}
          >
            <Shuffle className="size-3.5 mr-1" />
            Générer
          </Button>
          <Button size="sm" onClick={() => setAddGroupOpen(true)}>
            <Plus className="size-3.5 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{g.name}</span>
                  <Badge variant="secondary">
                    {g.teams.length} équipe{g.teams.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {g.teams.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {g.teams.map((team) => (
                      <Badge key={team.id} variant="outline" className="text-xs">
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aucune équipe dans ce groupe.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun groupe. Utilisez &quot;Générer&quot; pour créer automatiquement
              les groupes.
            </p>
          </CardContent>
        </Card>
      )}

      <GenerateGroupsDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        tournamentId={tournamentId}
        categories={categories}
      />

      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent onClose={() => setAddGroupOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nouveau groupe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGroup} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom du groupe</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Groupe A"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddGroupOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!newGroupName.trim() || createGroupMut.isPending}
              >
                {createGroupMut.isPending && (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TournamentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = idStr;
  const router = useRouter();

  const { data: tournament, isLoading } = useTournament(id);
  const { data: categories } = useCategories(id);
  const { data: fields } = useFields(id);
  const { data: days } = useDays(id);
  const { data: teamsData } = useTeams(id);
  const { data: matchesData } = useMatches(id);

  const publishMut = usePublishTournament(id);
  const startMut = useStartTournament(id);
  const finishMut = useFinishTournament(id);
  const duplicateMut = useDuplicateTournament(id);
  const updateTournamentMut = useUpdateTournament(id);
  const deleteCatMut = useDeleteCategory(id);
  const deleteTeamMut = useDeleteTeam(id);

  // Dialog states
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | undefined>();
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editField, setEditField] = useState<TournamentField | undefined>();
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [matchView, setMatchView] = useState<"list" | "table">("list");
  const [activeTab, setActiveTab] = useState("categories");

  const catList = categories ?? [];
  const fieldList = fields ?? [];
  const teams = teamsData?.results ?? [];
  const matches = matchesData?.results ?? [];

  // Build stepper steps with dependencies
  const stepperSteps: StepperStep[] = useMemo(() => {
    const hasCategories = catList.length > 0;
    const hasTeams = teams.length >= 2;
    const hasFields = fieldList.filter((f) => f.is_active).length > 0;
    const hasMatches = matches.length > 0;

    return [
      {
        value: "categories",
        label: "Catégories",
        shortLabel: "Cat.",
        enabled: true,
        completed: hasCategories,
      },
      {
        value: "teams",
        label: "Équipes",
        shortLabel: "Éq.",
        enabled: hasCategories,
        completed: hasTeams,
        disabledReason: !hasCategories ? "Complétez d'abord : Catégories" : undefined,
      },
      {
        value: "fields",
        label: "Terrains",
        shortLabel: "Ter.",
        enabled: hasCategories,
        completed: hasFields,
        disabledReason: !hasCategories ? "Complétez d'abord : Catégories" : undefined,
      },
      {
        value: "planning",
        label: "Planning",
        shortLabel: "Plan.",
        enabled: hasCategories && hasTeams && hasFields,
        completed: hasMatches,
        disabledReason: !hasCategories
          ? "Complétez d'abord : Catégories"
          : !hasTeams
            ? "Complétez d'abord : Équipes"
            : !hasFields
              ? "Complétez d'abord : Terrains"
              : undefined,
      },
      {
        value: "live",
        label: "Live",
        shortLabel: "Live",
        enabled: hasMatches,
        completed: tournament?.status === "live" || tournament?.status === "finished",
        disabledReason: !hasMatches ? "Complétez d'abord : Planning" : undefined,
      },
    ];
  }, [catList.length, teams.length, fieldList, matches.length, tournament?.status]);

  const handleStepClick = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={Trophy}
          title="Tournoi introuvable"
          description="Ce tournoi n'existe pas ou vous n'y avez pas accès."
          action={
            <Link href="/admin/tournois">
              <Button variant="outline">
                <ArrowLeft className="size-4 mr-1" />
                Retour aux tournois
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const t = tournament;
  const isAnyMutating =
    publishMut.isPending || startMut.isPending || finishMut.isPending;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Back + Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/tournois"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          Tournois
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{t.name}</h1>
              <Badge variant={STATUS_VARIANT[t.status]}>
                {STATUS_LABEL[t.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {t.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {new Date(t.start_date).toLocaleDateString("fr-FR")} –{" "}
                {new Date(t.end_date).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {t.public_code && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Code public :</span>
                <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono font-semibold tracking-wider">
                  {t.public_code}
                </code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(t.public_code);
                    toast.success("Code copié !");
                  }}
                  title="Copier le code"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Primary action + secondary */}
          <div className="flex gap-2 shrink-0">
            {t.status === "draft" && (
              <Button
                onClick={() => publishMut.mutate()}
                disabled={isAnyMutating}
              >
                {publishMut.isPending ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <Send className="size-4 mr-1" />
                )}
                Publier
              </Button>
            )}
            {t.status === "published" && (
              <Button
                onClick={() => startMut.mutate()}
                disabled={isAnyMutating}
              >
                {startMut.isPending ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <Play className="size-4 mr-1" />
                )}
                Démarrer
              </Button>
            )}
            {t.status === "live" && (
              <Button
                variant="secondary"
                onClick={() => finishMut.mutate()}
                disabled={isAnyMutating}
              >
                {finishMut.isPending ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4 mr-1" />
                )}
                Terminer
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                duplicateMut.mutate(undefined, {
                  onSuccess: (data) => router.push(`/admin/tournois/${data.id}`),
                })
              }
              disabled={duplicateMut.isPending}
            >
              <Copy className="size-4 mr-1" />
              Dupliquer
            </Button>
          </div>
        </div>
      </div>

      {/* Checklist */}
      {(t.status === "draft" || t.status === "published") && (
        <TournamentChecklist
          tournament={t}
          categories={catList}
          teams={teams}
          fields={fieldList}
          matches={matches}
          onNavigate={handleStepClick}
        />
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <span className="text-sm text-muted-foreground">Catégories</span>
            </div>
            <p className="text-2xl font-bold mt-1">{t.nb_categories}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-violet-400" />
              <span className="text-sm text-muted-foreground">Équipes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{t.nb_teams}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-blue-400" />
              <span className="text-sm text-muted-foreground">Matchs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{t.nb_matches}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-amber-400" />
              <span className="text-sm text-muted-foreground">Terrains</span>
            </div>
            <p className="text-2xl font-bold mt-1">{t.nb_fields}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick tools */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/tournois/${id}/print`}>
          <Button variant="outline" size="sm">
            <Printer className="size-4 mr-1" />
            Kit imprimable
          </Button>
        </Link>
        <Link href={`/admin/tournois/${id}/simulator`}>
          <Button variant="outline" size="sm">
            <FlaskConical className="size-4 mr-1" />
            Simulateur
          </Button>
        </Link>
        <ProFeatureButton variant="outline" size="sm">
          <BarChart3 className="size-4 mr-1" />
          Insights
        </ProFeatureButton>
        {t.slug && (
          <ProFeatureButton variant="outline" size="sm">
            <Mic2 className="size-4 mr-1" />
            Mode speaker
          </ProFeatureButton>
        )}
      </div>

      {/* Stepper navigation */}
      <TournamentStepper
        steps={stepperSteps}
        currentStep={activeTab}
        onStepClick={handleStepClick}
      />

      {/* Tab content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="sr-only">
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="teams">Équipes</TabsTrigger>
          <TabsTrigger value="fields">Terrains</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
        </TabsList>

        {/* ── Categories ─────────────────────────────────────────── */}
        <TabsContent value="categories" className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {catList.length} catégorie{catList.length !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={() => {
              setEditCategory(undefined);
              setCatDialogOpen(true);
            }}>
              <Plus className="size-3.5 mr-1" />
              Catégorie
            </Button>
          </div>
          {catList.length > 0 ? (
            catList.map((cat) => (
              <Card key={cat.id} className="shadow-sm">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: cat.color || "#16a34a" }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">
                        {cat.effective_match_duration} min •{" "}
                        {cat.points_win}/{cat.points_draw}/{cat.points_loss} pts
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditCategory(cat);
                          setCatDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Supprimer la catégorie "${cat.name}" ?`)) {
                            deleteCatMut.mutate(cat.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={Layers}
              title="Aucune catégorie"
              description="Ajoutez des catégories d'âge pour organiser le tournoi (ex: U13, U15…)."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditCategory(undefined);
                    setCatDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1" />
                  Ajouter une catégorie
                </Button>
              }
            />
          )}
          <CategoryFormDialog
            open={catDialogOpen}
            onOpenChange={setCatDialogOpen}
            tournamentId={id}
            category={editCategory}
            days={days}
          />
        </TabsContent>

        {/* ── Teams ──────────────────────────────────────────────── */}
        <TabsContent value="teams" className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {teams.length} équipe{teams.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/equipes`)}
              >
                Gestion complète
              </Button>
              <Button
                size="sm"
                onClick={() => setTeamDialogOpen(true)}
                disabled={catList.length === 0}
              >
                <Plus className="size-3.5 mr-1" />
                Équipe
              </Button>
            </div>
          </div>
          {teams.length > 0 ? (
            teams.map((team) => {
              const cat = catList.find((c) => c.id === team.category);
              return (
                <Card key={team.id} className="shadow-sm">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {cat && (
                          <div
                            className="size-2.5 rounded-full"
                            style={{
                              backgroundColor: cat.color || "#16a34a",
                            }}
                          />
                        )}
                        <span className="font-medium">{team.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {team.short_name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {team.coach_name && (
                          <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">
                            {team.coach_name}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Supprimer l'équipe "${team.name}" ?`
                              )
                            ) {
                              deleteTeamMut.mutate(team.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={Users}
              title={catList.length === 0 ? "Catégories requises" : "Aucune équipe inscrite"}
              description={
                catList.length === 0
                  ? "Créez d'abord des catégories avant d'ajouter des équipes."
                  : "Ajoutez des équipes manuellement ou importez-les depuis un fichier CSV."
              }
              action={
                catList.length > 0 ? (
                  <Button size="sm" onClick={() => setTeamDialogOpen(true)}>
                    <Plus className="size-3.5 mr-1" />
                    Ajouter une équipe
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("categories")}>
                    Aller aux catégories
                  </Button>
                )
              }
            />
          )}
          {catList.length > 0 && (
            <QuickTeamDialog
              open={teamDialogOpen}
              onOpenChange={setTeamDialogOpen}
              tournamentId={id}
              categories={catList}
            />
          )}
        </TabsContent>

        {/* ── Fields ─────────────────────────────────────────────── */}
        <TabsContent value="fields" className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {fieldList.length} terrain{fieldList.length !== 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              onClick={() => {
                setEditField(undefined);
                setFieldDialogOpen(true);
              }}
            >
              <Plus className="size-3.5 mr-1" />
              Terrain
            </Button>
          </div>
          {fieldList.length > 0 ? (
            fieldList.map((f) => (
              <Card key={f.id} className="shadow-sm">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={f.is_active ? "default" : "secondary"}>
                        {f.is_active ? "Actif" : "Inactif"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditField(f);
                          setFieldDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={MapPin}
              title="Aucun terrain configuré"
              description="Ajoutez les terrains disponibles pour votre tournoi afin de pouvoir générer le planning."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditField(undefined);
                    setFieldDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1" />
                  Ajouter un terrain
                </Button>
              }
            />
          )}
          <FieldFormDialog
            open={fieldDialogOpen}
            onOpenChange={setFieldDialogOpen}
            tournamentId={id}
            field={editField}
            days={days}
          />
        </TabsContent>

        {/* ── Planning (Matches + Groups) ────────────────────────── */}
        <TabsContent value="planning" className="mt-4 space-y-4">
          {/* Groups subsection */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shuffle className="size-4" />
                Groupes & Poules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GroupsTabContent
                tournamentId={id}
                categories={catList}
              />
            </CardContent>
          </Card>

          {/* Matches subsection */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  Matchs
                </CardTitle>
                <div className="flex gap-2">
                  <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
                    <Button
                      variant={matchView === "list" ? "default" : "ghost"}
                      size="icon-sm"
                      onClick={() => setMatchView("list")}
                      title="Vue liste"
                    >
                      <LayoutList className="size-3.5" />
                    </Button>
                    <Button
                      variant={matchView === "table" ? "default" : "ghost"}
                      size="icon-sm"
                      onClick={() => setMatchView("table")}
                      title="Tableau croisé"
                    >
                      <Table2 className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/planning`)}
                  >
                    Planning complet
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  {matches.length} match{matches.length !== 1 ? "s" : ""}
                </span>
                {matchView === "table" ? (
                  <ScoreTable matches={matches} categories={catList} />
                ) : matches.length > 0 ? (
                  <div className="space-y-2">
                    {matches.slice(0, 30).map((m) => {
                      const hasScore = m.score_home !== null && m.score_away !== null;
                      return (
                        <Link
                          key={m.id}
                          href={`/admin/match/${m.id}/score?t=${id}`}
                          className="block"
                        >
                          <Card className="transition-colors hover:border-primary/40 shadow-none border">
                            <CardContent className="py-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge
                                    variant={MATCH_STATUS_VARIANT[m.status]}
                                    className="text-[10px] shrink-0"
                                  >
                                    {MATCH_STATUS_LABEL[m.status]}
                                  </Badge>
                                  <span className="text-sm truncate">
                                    {m.display_home}{" "}
                                    {hasScore ? (
                                      <span className="font-bold">
                                        {m.score_home} - {m.score_away}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">vs</span>
                                    )}{" "}
                                    {m.display_away}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                                  <span>{PHASE_LABEL[m.phase]}</span>
                                  {m.field_name && <span>• {m.field_name}</span>}
                                  <span>
                                    {new Date(m.start_time).toLocaleTimeString(
                                      "fr-FR",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                    {matches.length > 30 && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        Affichage limité à 30 matchs.{" "}
                        <Link
                          href="/admin/planning"
                          className="underline hover:text-foreground"
                        >
                          Voir le planning complet
                        </Link>
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Aucun match"
                    description="Générez le planning depuis le bouton ci-dessous ou la page planning dédiée."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/planning`)}
                      >
                        <CalendarDays className="size-3.5 mr-1" />
                        Aller au planning
                      </Button>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Live & Settings ────────────────────────────────────── */}
        <TabsContent value="live" className="mt-4 space-y-4">
          {/* Workflow Banner */}
          {t.status === "draft" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
              <Info className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Tournoi en brouillon
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                  Complétez la configuration puis publiez le tournoi pour le rendre accessible.
                </p>
              </div>
            </div>
          )}
          {t.status === "published" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex items-start gap-3">
              <Info className="size-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-200">
                  Tournoi publié — en attente de démarrage
                </p>
                <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">
                  Les participants peuvent accéder au tournoi. Démarrez-le quand vous êtes prêt.
                </p>
                <Button
                  className="mt-2"
                  size="sm"
                  onClick={() => startMut.mutate()}
                  disabled={isAnyMutating}
                >
                  <Play className="size-3.5 mr-1" />
                  Démarrer maintenant
                </Button>
              </div>
            </div>
          )}
          {t.status === "live" && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 flex items-start gap-3">
              <Play className="size-5 text-green-600 mt-0.5 shrink-0 animate-pulse" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-200">
                  Tournoi en cours 🎯
                </p>
                <p className="text-green-700 dark:text-green-400 text-sm mt-1">
                  Saisissez les scores des matchs depuis le planning ou le mode speaker.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/planning`)}
                  >
                    <CalendarDays className="size-3.5 mr-1" />
                    Planning
                  </Button>
                  {t.slug && (
                    <Link href={`/tournoi/${t.slug}/speaker`} target="_blank">
                      <Button variant="outline" size="sm">
                        <Mic2 className="size-3.5 mr-1" />
                        Mode speaker
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
          {t.status === "finished" && (
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/50 p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Tournoi terminé</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Le tournoi est clôturé. Consultez les résultats finaux et les statistiques.
                </p>
              </div>
            </div>
          )}

          {/* Settings */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Paramètres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Mode de planification</Label>
                <Select
                  value={t.scheduling_mode}
                  onChange={(e) =>
                    updateTournamentMut.mutate({
                      scheduling_mode: e.target.value as "CATEGORY_BLOCK" | "INTERLEAVE",
                    })
                  }
                  options={[
                    {
                      value: "CATEGORY_BLOCK",
                      label: "Par catégorie (une catégorie après l'autre)",
                    },
                    {
                      value: "INTERLEAVE",
                      label: "Entrelacé (matchs de toutes catégories mélangés)",
                    },
                  ]}
                  className="max-w-md mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t.scheduling_mode === "CATEGORY_BLOCK"
                    ? "Les matchs sont regroupés par catégorie."
                    : "Les matchs de toutes les catégories sont répartis pour optimiser l'utilisation des terrains."}
                </p>
              </div>
              <div className="border-t pt-4">
                <Label className="text-sm font-medium">Durées par défaut</Label>
                <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Match</p>
                    <p className="font-bold text-lg mt-0.5">{t.default_match_duration} <span className="text-xs font-normal">min</span></p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Transition</p>
                    <p className="font-bold text-lg mt-0.5">{t.default_transition_time} <span className="text-xs font-normal">min</span></p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Repos min</p>
                    <p className="font-bold text-lg mt-0.5">{t.default_rest_time} <span className="text-xs font-normal">min</span></p>
                  </div>
                </div>
              </div>
              {t.description && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{t.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
