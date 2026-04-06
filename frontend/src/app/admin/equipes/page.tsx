"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { useTeams } from "@/hooks/use-teams";
import { useCategories } from "@/hooks/use-categories";
import {
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useBulkImportTeams,
} from "@/hooks/use-team-mutations";
import type { TeamAdmin, TeamPayload, Category } from "@/types/api";

// ─── Team Form Dialog ───────────────────────────────────────────────────────

function TeamFormDialog({
  open,
  onOpenChange,
  tournamentId,
  categories,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  categories: Category[];
  team?: TeamAdmin;
}) {
  const isEdit = !!team;
  const createMut = useCreateTeam(tournamentId);
  const updateMut = useUpdateTeam(tournamentId, team?.id ?? 0);
  const isPending = createMut.isPending || updateMut.isPending;

  const [form, setForm] = useState<TeamPayload>({
    category: team?.category ?? (categories[0]?.id ?? 0),
    name: team?.name ?? "",
    short_name: team?.short_name ?? "",
    coach_name: team?.coach_name ?? "",
    coach_phone: team?.coach_phone ?? "",
    coach_email: team?.coach_email ?? "",
  });

  const set = (field: keyof TeamPayload, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.name.trim() && form.category > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload: TeamPayload = {
      ...form,
      name: form.name.trim(),
      short_name: form.short_name.trim() || form.name.trim().substring(0, 5),
    };
    if (isEdit) {
      updateMut.mutate(payload, { onSuccess: () => onOpenChange(false) });
    } else {
      createMut.mutate(payload, {
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
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l\u2019équipe" : "Nouvelle équipe"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="team-cat">Catégorie</Label>
              <Select
                id="team-cat"
                value={String(form.category)}
                onChange={(e) => set("category", Number(e.target.value))}
                options={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                placeholder="Choisir…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Nom *</Label>
              <Input
                id="team-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="FC Exemple"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-short">Abréviation</Label>
              <Input
                id="team-short"
                value={form.short_name}
                onChange={(e) => set("short_name", e.target.value)}
                placeholder="FCE"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-coach">Coach</Label>
              <Input
                id="team-coach"
                value={form.coach_name}
                onChange={(e) => set("coach_name", e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-phone">Téléphone</Label>
              <Input
                id="team-phone"
                type="tel"
                value={form.coach_phone}
                onChange={(e) => set("coach_phone", e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="team-email">Email coach</Label>
              <Input
                id="team-email"
                type="email"
                value={form.coach_email}
                onChange={(e) => set("coach_email", e.target.value)}
                placeholder="coach@example.com"
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
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Dialog ──────────────────────────────────────────────────────────

function ImportDialog({
  open,
  onOpenChange,
  tournamentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
}) {
  const importMut = useBulkImportTeams(tournamentId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  function handleImport() {
    if (!file) return;
    importMut.mutate(file, {
      onSuccess: () => {
        onOpenChange(false);
        setFile(null);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Importer des équipes (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le fichier CSV doit contenir les colonnes :{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              category_name, name, short_name, coach_name, coach_phone, coach_email
            </code>
          </p>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {importMut.isError && (
            <p className="text-sm text-destructive">
              Erreur lors de l&apos;import. Vérifiez le format du fichier.
            </p>
          )}
          {importMut.isSuccess && importMut.data && (
            <p className="text-sm text-green-500">
              {importMut.data.created} équipe(s) importée(s).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || importMut.isPending}
          >
            {importMut.isPending && (
              <Loader2 className="size-4 mr-1 animate-spin" />
            )}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ──────────────────────────────────────────────────

function DeleteDialog({
  open,
  onOpenChange,
  tournamentId,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  team: TeamAdmin | null;
}) {
  const deleteMut = useDeleteTeam(tournamentId);

  function handleDelete() {
    if (!team) return;
    deleteMut.mutate(team.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;équipe</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Êtes-vous sûr de vouloir supprimer{" "}
          <span className="font-semibold text-foreground">{team?.name}</span> ?
          Cette action est irréversible.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending && (
              <Loader2 className="size-4 mr-1 animate-spin" />
            )}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Row ───────────────────────────────────────────────────────────────

function TeamRow({
  team,
  categories,
  onEdit,
  onDelete,
}: {
  team: TeamAdmin;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = categories.find((c) => c.id === team.category);

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {cat && (
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color || "#16a34a" }}
                />
              )}
              <span className="font-medium truncate">{team.name}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {team.short_name}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {team.coach_name && (
              <span className="text-xs text-muted-foreground hidden sm:inline mr-2">
                {team.coach_name}
              </span>
            )}
            {team.qr_code_url && (
              <a
                href={team.qr_code_url}
                target="_blank"
                rel="noopener noreferrer"
                title="QR Code"
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent transition-colors"
              >
                <QrCode className="size-3.5" />
              </a>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminEquipes() {
  const { data: tournamentsData, isLoading: tournamentsLoading } = useTournaments();
  const tournaments = tournamentsData?.results ?? [];
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamAdmin | undefined>();
  const [deleteTeam, setDeleteTeam] = useState<TeamAdmin | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Data
  const { data: teamsData, isLoading: teamsLoading } = useTeams(
    selectedTournament
  );
  const { data: categories } = useCategories(selectedTournament);

  // Auto-select first tournament
  const activeTournaments = tournaments.filter(
    (t) => t.status !== "archived" && t.status !== "finished"
  );
  if (
    !selectedTournament &&
    activeTournaments &&
    activeTournaments.length > 0
  ) {
    setSelectedTournament(activeTournaments[0].id);
  }

  const teams = teamsData?.results ?? [];
  const catList = categories ?? [];

  // Filtering
  const filtered = teams.filter((team) => {
    const matchSearch =
      !search ||
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      team.coach_name.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoryFilter === "all" || team.category === Number(categoryFilter);
    return matchSearch && matchCat;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6" />
            Équipes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les équipes inscrites à vos tournois
          </p>
        </div>
        {!!selectedTournament && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-1" />
              Importer
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1" />
              Nouvelle équipe
            </Button>
          </div>
        )}
      </div>

      {/* Tournament picker */}
      {tournamentsLoading ? (
        <Skeleton className="h-9 w-64" />
      ) : (
        <Select
          value={String(selectedTournament)}
          onChange={(e) => {
            setSelectedTournament(e.target.value);
            setCategoryFilter("all");
            setSearch("");
          }}
          options={
            tournaments.map((t) => ({
              value: String(t.id),
              label: `${t.name} (${t.status})`,
            }))
          }
          placeholder="Sélectionner un tournoi"
          className="max-w-sm"
        />
      )}

      {!!selectedTournament && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: "all", label: "Toutes les catégories" },
                ...catList.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                })),
              ]}
              className="w-48"
            />
            <div className="text-sm text-muted-foreground flex items-center">
              {filtered.length} équipe{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Team list */}
          {teamsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  categories={catList}
                  onEdit={() => setEditTeam(team)}
                  onDelete={() => setDeleteTeam(team)}
                />
              ))}
            </div>
          ) : teams.length > 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="size-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune équipe ne correspond aux filtres.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="size-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune équipe inscrite.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4 mr-1" />
                  Ajouter une équipe
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Dialogs */}
          <TeamFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            tournamentId={selectedTournament}
            categories={catList}
          />

          {editTeam && (
            <TeamFormDialog
              open={!!editTeam}
              onOpenChange={(open) => {
                if (!open) setEditTeam(undefined);
              }}
              tournamentId={selectedTournament}
              categories={catList}
              team={editTeam}
            />
          )}

          <DeleteDialog
            open={!!deleteTeam}
            onOpenChange={(open) => {
              if (!open) setDeleteTeam(null);
            }}
            tournamentId={selectedTournament}
            team={deleteTeam}
          />

          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            tournamentId={selectedTournament}
          />
        </>
      )}
    </div>
  );
}
