"use client";

import { use, useState } from "react";
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
} from "lucide-react";
import { useTournament } from "@/hooks/use-tournaments";
import { useCategories } from "@/hooks/use-categories";
import { useFields } from "@/hooks/use-fields";
import { useTeams } from "@/hooks/use-teams";
import { useGroups } from "@/hooks/use-groups";
import { useMatches } from "@/hooks/use-matches";
import {
  usePublishTournament,
  useStartTournament,
  useFinishTournament,
  useDuplicateTournament,
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
import type {
  TournamentStatus,
  Category,
  CategoryPayload,
  TournamentField,
  FieldPayload,
  TeamPayload,
  GroupPayload,
  MatchStatus,
  MatchPhase,
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  category?: Category;
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
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
      <DialogContent onClose={() => onOpenChange(false)}>
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
              <Label>Durée match (min)</Label>
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
              />
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

function FieldFormDialog({
  open,
  onOpenChange,
  tournamentId,
  field,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  field?: TournamentField;
}) {
  const isEdit = !!field;
  const createMut = useCreateField(tournamentId);
  const updateMut = useUpdateField(tournamentId, field?.id ?? 0);
  const isPending = createMut.isPending || updateMut.isPending;

  const [form, setForm] = useState<FieldPayload>({
    name: field?.name ?? "",
    display_order: field?.display_order ?? 0,
    is_active: field?.is_active ?? true,
  });

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
      <DialogContent onClose={() => onOpenChange(false)}>
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
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="FC Exemple"
                required
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
  const { data: teamsData } = useTeams(id);
  const { data: matchesData } = useMatches(id);

  const publishMut = usePublishTournament(id);
  const startMut = useStartTournament(id);
  const finishMut = useFinishTournament(id);
  const duplicateMut = useDuplicateTournament(id);
  const deleteCatMut = useDeleteCategory(id);
  const deleteTeamMut = useDeleteTeam(id);

  // Dialog states
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | undefined>();
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editField, setEditField] = useState<TournamentField | undefined>();
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">Tournoi introuvable.</p>
      </div>
    );
  }

  const t = tournament;
  const isAnyMutating =
    publishMut.isPending || startMut.isPending || finishMut.isPending;
  const catList = categories ?? [];
  const fieldList = fields ?? [];
  const teams = teamsData?.results ?? [];
  const matches = matchesData?.results ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back */}
      <Link
        href="/admin/tournois"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Tournois
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
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
        </div>

        {/* Actions */}
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

      {/* Tabs */}
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="teams">Équipes</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
          <TabsTrigger value="matches">Matchs</TabsTrigger>
          <TabsTrigger value="fields">Terrains</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        {/* ── Categories ─────────────────────────────────────────── */}
        <TabsContent value="categories" className="mt-4 space-y-2">
          <div className="flex justify-end mb-2">
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
              <Card key={cat.id}>
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
                      <span className="text-xs text-muted-foreground mr-2">
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
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune catégorie. Ajoutez des catégories d&apos;âge pour
                  organiser le tournoi.
                </p>
              </CardContent>
            </Card>
          )}
          <CategoryFormDialog
            open={catDialogOpen}
            onOpenChange={setCatDialogOpen}
            tournamentId={id}
            category={editCategory}
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
                onClick={() =>
                  router.push(`/admin/equipes`)
                }
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
                <Card key={team.id}>
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
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {catList.length === 0
                    ? "Créez d\u2019abord des catégories."
                    : "Aucune équipe inscrite."}
                </p>
              </CardContent>
            </Card>
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

        {/* ── Groups ─────────────────────────────────────────────── */}
        <TabsContent value="groups" className="mt-4">
          <GroupsTabContent
            tournamentId={id}
            categories={catList}
          />
        </TabsContent>

        {/* ── Matches ────────────────────────────────────────────── */}
        <TabsContent value="matches" className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {matches.length} match{matches.length !== 1 ? "s" : ""}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/planning`)}
            >
              <CalendarDays className="size-3.5 mr-1" />
              Planning complet
            </Button>
          </div>
          {matches.length > 0 ? (
            matches.slice(0, 30).map((m) => {
              const hasScore = m.score_home !== null && m.score_away !== null;
              return (
                <Link
                  key={m.id}
                  href={`/admin/match/${m.id}/score?t=${id}`}
                  className="block"
                >
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="py-3">
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
            })
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun match. Générez le planning depuis l&apos;onglet Planning.
                </p>
              </CardContent>
            </Card>
          )}
          {matches.length > 30 && (
            <p className="text-xs text-center text-muted-foreground">
              Affichage limité à 30 matchs.{" "}
              <Link
                href="/admin/planning"
                className="underline hover:text-foreground"
              >
                Voir le planning complet
              </Link>
            </p>
          )}
        </TabsContent>

        {/* ── Fields ─────────────────────────────────────────────── */}
        <TabsContent value="fields" className="mt-4 space-y-2">
          <div className="flex justify-end mb-2">
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
              <Card key={f.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{f.name}</span>
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
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun terrain défini.
                </p>
              </CardContent>
            </Card>
          )}
          <FieldFormDialog
            open={fieldDialogOpen}
            onOpenChange={setFieldDialogOpen}
            tournamentId={id}
            field={editField}
          />
        </TabsContent>

        {/* ── Settings ───────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Durées par défaut</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Match</p>
                  <p className="font-semibold">{t.default_match_duration} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transition</p>
                  <p className="font-semibold">{t.default_transition_time} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Repos min</p>
                  <p className="font-semibold">{t.default_rest_time} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {t.description && (
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
