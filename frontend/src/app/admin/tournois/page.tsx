"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MapPin,
  CalendarDays,
  Users,
  Trophy,
} from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import type { TournamentList, TournamentStatus } from "@/types/api";

const STATUS_CONFIG: Record<
  TournamentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Brouillon", variant: "secondary" },
  published: { label: "Publié", variant: "outline" },
  live: { label: "En cours", variant: "default" },
  finished: { label: "Terminé", variant: "secondary" },
  archived: { label: "Archivé", variant: "secondary" },
};

function TournamentRow({ t }: { t: TournamentList }) {
  const cfg = STATUS_CONFIG[t.status];
  return (
    <Link href={`/admin/tournois/${t.id}`}>
      <Card className="hover:bg-accent/40 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{t.name}</h3>
                <Badge variant={cfg.variant} className="shrink-0 text-[0.6rem]">
                  {cfg.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {t.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {new Date(t.start_date).toLocaleDateString("fr-FR")} –{" "}
                  {new Date(t.end_date).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
              <span className="hidden sm:inline-flex items-center gap-1">
                <Trophy className="size-3" />
                {t.nb_categories} cat.
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {t.nb_teams}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AdminTournois() {
  const [tab, setTab] = useState("all");
  const { data, isLoading } = useTournaments();

  const all = data?.results ?? [];
  const filtered =
    tab === "all"
      ? all
      : all.filter((t) => {
          if (tab === "active") return t.status === "live" || t.status === "published";
          return t.status === tab;
        });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournois</h1>
          <p className="text-sm text-muted-foreground">
            Créez et gérez vos tournois
          </p>
        </div>
        <Link href="/admin/tournois/new">
          <Button>
            <Plus className="size-4 mr-1" />
            Nouveau tournoi
          </Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            Tous{all.length > 0 && ` (${all.length})`}
          </TabsTrigger>
          <TabsTrigger value="active">Actifs</TabsTrigger>
          <TabsTrigger value="draft">Brouillons</TabsTrigger>
          <TabsTrigger value="finished">Terminés</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="size-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {tab === "all"
                  ? "Aucun tournoi créé. Commencez par en créer un !"
                  : "Aucun tournoi dans cette catégorie."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((t) => <TournamentRow key={t.id} t={t} />)
        )}
      </div>
    </div>
  );
}
