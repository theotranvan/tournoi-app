"use client";

import { useState } from "react";
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
import { LayoutGrid, Plus, Pencil, Loader2 } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { useFields } from "@/hooks/use-fields";
import { useCreateField, useUpdateField } from "@/hooks/use-mutations";
import type { TournamentField, FieldPayload } from "@/types/api";

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
              <Label>Ordre d&apos;affichage</Label>
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

export default function AdminTerrains() {
  const { data: tournamentsData, isLoading: tournamentsLoading } = useTournaments();
  const tournaments = tournamentsData?.results ?? [];
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editField, setEditField] = useState<TournamentField | undefined>();

  const { data: fields, isLoading: fieldsLoading } = useFields(
    selectedTournament
  );

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

  const fieldList = fields ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="size-6" />
            Terrains
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les terrains de vos tournois
          </p>
        </div>
        {!!selectedTournament && (
          <Button
            onClick={() => {
              setEditField(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4 mr-1" />
            Nouveau terrain
          </Button>
        )}
      </div>

      {tournamentsLoading ? (
        <Skeleton className="h-9 w-64" />
      ) : (
        <Select
          value={String(selectedTournament)}
          onChange={(e) => setSelectedTournament(e.target.value)}
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
          {fieldsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : fieldList.length > 0 ? (
            <div className="space-y-2">
              {fieldList.map((f) => (
                <Card key={f.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{f.name}</span>
                        <span className="text-xs text-muted-foreground">
                          #{f.display_order}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={f.is_active ? "default" : "secondary"}
                        >
                          {f.is_active ? "Actif" : "Inactif"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditField(f);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <LayoutGrid className="size-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun terrain défini.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => {
                    setEditField(undefined);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-1" />
                  Ajouter un terrain
                </Button>
              </CardContent>
            </Card>
          )}

          <FieldFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            tournamentId={selectedTournament}
            field={editField}
          />
        </>
      )}
    </div>
  );
}
