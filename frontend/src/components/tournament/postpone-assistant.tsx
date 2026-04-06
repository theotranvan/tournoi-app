"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CalendarClock,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MatchList } from "@/types/api";

interface SuggestedSlot {
  field_id: number;
  field_name: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface PostponeResponse {
  match_id: string;
  original_time: string;
  original_field: string;
  suggested_slots: SuggestedSlot[];
  applied?: boolean;
}

export function PostponeAssistant({
  tournamentId,
  match,
  onClose,
}: {
  tournamentId: string;
  match: MatchList;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Step 1: Get suggestions
  const suggestMutation = useMutation({
    mutationFn: () =>
      api.post<PostponeResponse>(
        `/tournaments/${tournamentId}/matches/${match.id}/postpone/`,
        { reason },
      ),
  });

  // Step 2: Apply selected slot
  const applyMutation = useMutation({
    mutationFn: (slotIndex: number) =>
      api.post<PostponeResponse>(
        `/tournaments/${tournamentId}/matches/${match.id}/postpone/`,
        { reason, apply_slot_index: slotIndex },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      onClose();
    },
  });

  const suggestions = suggestMutation.data?.suggested_slots ?? [];
  const step = suggestMutation.data ? 2 : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Reporter un match</h2>
      </div>

      {/* Match info */}
      <Card className="p-3 bg-muted/50">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {match.display_home} vs {match.display_away}
          </span>
          <Badge variant="outline">{match.category_name}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {new Date(match.start_time).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {match.field_name && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {match.field_name}
            </span>
          )}
        </div>
      </Card>

      {/* Step 1: Reason */}
      {step === 1 && (
        <>
          <div>
            <label className="text-sm font-medium" htmlFor="reason">
              Raison du report
            </label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: terrain impraticable, pluie forte…"
              className="mt-1"
            />
          </div>

          <Button
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending || !reason.trim()}
            className="w-full"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <CalendarClock className="size-4 mr-2" />
            )}
            Trouver des créneaux disponibles
          </Button>

          {suggestMutation.isError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="size-4" />
              Impossible de trouver des créneaux. Vérifiez le planning.
            </p>
          )}
        </>
      )}

      {/* Step 2: Select slot */}
      {step === 2 && (
        <>
          {suggestions.length === 0 ? (
            <Card className="p-4 text-center text-muted-foreground">
              <AlertTriangle className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                Aucun créneau compatible trouvé. Essayez de libérer un terrain ou d&apos;ajuster les horaires.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {suggestions.length} créneau{suggestions.length > 1 ? "x" : ""} compatible{suggestions.length > 1 ? "s" : ""} trouvé{suggestions.length > 1 ? "s" : ""}
              </p>

              {suggestions.map((slot, i) => (
                <Card
                  key={i}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedSlot === i
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedSlot(i)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(slot.start_time).toLocaleString("fr-FR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" — "}
                        {new Date(slot.end_time).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" />
                        {slot.field_name}
                      </p>
                    </div>
                    {selectedSlot === i && (
                      <CheckCircle2 className="size-5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{slot.reason}</p>
                </Card>
              ))}

              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    suggestMutation.reset();
                    setSelectedSlot(null);
                  }}
                  className="flex-1"
                >
                  Retour
                </Button>
                <Button
                  onClick={() => {
                    if (selectedSlot !== null) applyMutation.mutate(selectedSlot);
                  }}
                  disabled={selectedSlot === null || applyMutation.isPending}
                  className="flex-1"
                >
                  {applyMutation.isPending ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4 mr-2" />
                  )}
                  Appliquer ce créneau
                </Button>
              </div>

              {applyMutation.isError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-4" />
                  Erreur lors de l&apos;application. Réessayez.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
