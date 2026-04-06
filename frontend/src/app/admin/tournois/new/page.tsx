"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useCreateTournament } from "@/hooks/use-mutations";

export default function NewTournament() {
  const router = useRouter();
  const createMutation = useCreateTournament();

  const [form, setForm] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    description: "",
    is_public: true,
    default_match_duration: 15,
    default_transition_time: 5,
    default_rest_time: 30,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Le nom est requis";
    if (!form.location.trim()) e.location = "Le lieu est requis";
    if (!form.start_date) e.start_date = "La date de début est requise";
    if (!form.end_date) e.end_date = "La date de fin est requise";
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      e.end_date = "La date de fin doit être après la date de début";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    createMutation.mutate(
      form,
      {
        onSuccess: (data) => router.push(`/admin/tournois/${data.id}`),
        onError: (err) => setErrors({ name: err.message }),
      }
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <Link
        href="/admin/tournois"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Retour aux tournois
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Nouveau tournoi</h1>
        <p className="text-sm text-muted-foreground">
          Remplissez les informations de base pour créer votre tournoi
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du tournoi *</Label>
              <Input
                id="name"
                placeholder="Tournoi de Printemps U13"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lieu *</Label>
              <Input
                id="location"
                placeholder="Stade municipal, Paris"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
              {errors.location && (
                <p className="text-xs text-destructive">{errors.location}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">{errors.start_date}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date de fin *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">{errors.end_date}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Description du tournoi (optionnel)"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={form.is_public}
                onChange={(e) => set("is_public", e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <Label htmlFor="is_public" className="text-sm font-normal">
                Page publique accessible sans connexion
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Match defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Durées par défaut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Match (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={120}
                  value={form.default_match_duration}
                  onChange={(e) =>
                    set("default_match_duration", parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transition">Transition (min)</Label>
                <Input
                  id="transition"
                  type="number"
                  min={0}
                  max={60}
                  value={form.default_transition_time}
                  onChange={(e) =>
                    set("default_transition_time", parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rest">Repos min (min)</Label>
                <Input
                  id="rest"
                  type="number"
                  min={0}
                  max={120}
                  value={form.default_rest_time}
                  onChange={(e) =>
                    set("default_rest_time", parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/admin/tournois">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Save className="size-4 mr-1" />
            )}
            Créer le tournoi
          </Button>
        </div>
      </form>
    </div>
  );
}
