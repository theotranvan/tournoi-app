"use client";

import { use, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  FileText,
  MapPin,
  Users,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useTournament, useCategories, useTeams, useMatches, useFields } from "@/hooks";
import type {
  TournamentDetail,
  Category,
  TeamAdmin,
  MatchList,
  TournamentField,
} from "@/types/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function PrintPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: tournament } = useTournament(id);
  const { data: categories } = useCategories(id);
  const { data: teamsData } = useTeams(id);
  const { data: matchesData } = useMatches(id);
  const { data: fields } = useFields(id);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState({
    cover: true,
    schedule: true,
    fieldSheets: true,
    teamCards: true,
    matchSheets: false,
  });

  const teams = teamsData?.results ?? [];
  const matches = matchesData?.results ?? [];

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generatePDF = useCallback(async () => {
    if (!tournament || !matches.length) return;
    setGenerating(true);

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const QRCode = await import("qrcode");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", putOnlyUsedFonts: true });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      let isFirstPage = true;

      // Helper: strip emojis that jsPDF can't render
      const stripEmoji = (str: string) =>
        str.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, "").trim();

      const addPage = () => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;
      };

      // ── PAGE DE GARDE ──────────────────────────────
      if (sections.cover) {
        addPage();
        // Title
        doc.setFontSize(32);
        doc.setFont("helvetica", "bold");
        doc.text(tournament.name, pageW / 2, 50, { align: "center" });

        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text(tournament.location, pageW / 2, 65, { align: "center" });

        doc.setFontSize(12);
        const dateStr = `${formatDate(tournament.start_date)}${
          tournament.start_date !== tournament.end_date
            ? ` - ${formatDate(tournament.end_date)}`
            : ""
        }`;
        doc.text(dateStr, pageW / 2, 78, { align: "center" });

        // Stats boxes
        const stats = [
          { label: "Catégories", value: String(categories?.length ?? 0) },
          { label: "Équipes", value: String(teams.length) },
          { label: "Matchs", value: String(matches.length) },
          { label: "Terrains", value: String(fields?.length ?? 0) },
        ];
        const boxW = 35;
        const boxH = 25;
        const startX = (pageW - stats.length * (boxW + 8)) / 2;

        stats.forEach((s, i) => {
          const x = startX + i * (boxW + 8);
          const y = 100;
          doc.setDrawColor(200);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(x, y, boxW, boxH, 3, 3, "FD");
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text(s.value, x + boxW / 2, y + 11, { align: "center" });
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(s.label, x + boxW / 2, y + 19, { align: "center" });
        });

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("G\u00e9n\u00e9r\u00e9 par Footix", pageW / 2, pageH - 15, { align: "center" });
        doc.setTextColor(0);
      }

      // ── PLANNING COMPLET ───────────────────────────
      if (sections.schedule && matches.length > 0) {
        // Group matches by day
        const byDay = new Map<string, MatchList[]>();
        for (const m of matches) {
          const day = m.start_time ? new Date(m.start_time).toDateString() : "?";
          const list = byDay.get(day) ?? [];
          list.push(m);
          byDay.set(day, list);
        }

        for (const [day, dayMatches] of byDay) {
          addPage();
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(
            `Planning — ${new Date(day).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}`,
            margin,
            20,
          );

          const sorted = dayMatches.sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
          );

          autoTable(doc, {
            startY: 28,
            margin: { left: margin, right: margin },
            head: [["Heure", "Terrain", "Cat.", "Domicile", "Extérieur", "Score"]],
            body: sorted.map((m) => [
              formatTime(m.start_time),
              m.field_name ?? "—",
              m.category_name,
              m.display_home,
              m.display_away,
              m.score_home !== null ? `${m.score_home} - ${m.score_away}` : "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 64, 175], textColor: 255 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
          });
        }
      }

      // ── FICHES PAR TERRAIN ─────────────────────────
      if (sections.fieldSheets && fields) {
        for (const field of fields) {
          const fieldMatches = matches
            .filter((m) => m.field_name === field.name)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

          if (fieldMatches.length === 0) continue;

          addPage();
          doc.setFontSize(20);
          doc.setFont("helvetica", "bold");
          doc.text(`[Terrain] ${field.name}`, margin, 22);

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`${fieldMatches.length} matchs programmés`, margin, 30);

          autoTable(doc, {
            startY: 36,
            margin: { left: margin, right: margin },
            head: [["#", "Heure", "Catégorie", "Domicile", "Extérieur", "Score"]],
            body: fieldMatches.map((m, i) => [
              String(i + 1),
              formatTime(m.start_time),
              m.category_name,
              m.display_home,
              m.display_away,
              m.score_home !== null ? `${m.score_home} - ${m.score_away}` : "__ - __",
            ]),
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [22, 163, 74], textColor: 255 },
            alternateRowStyles: { fillColor: [240, 253, 244] },
          });
        }
      }

      // ── FICHES ÉQUIPES (A6 = 2 per page) ──────────
      if (sections.teamCards && teams.length > 0) {
        const cardW = pageW - 2 * margin;
        const cardH = (pageH - 3 * margin) / 2;

        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];
          const pos = i % 2; // 0 = top, 1 = bottom
          if (pos === 0) addPage();

          const yBase = margin + pos * (cardH + margin / 2);

          // Card border
          doc.setDrawColor(200);
          doc.roundedRect(margin, yBase, cardW, cardH, 4, 4, "S");

          // Team name
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(team.name, margin + 8, yBase + 14);

          // Category
          const cat = categories?.find((c) => c.id === team.category);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          if (cat) {
            doc.text(`Catégorie: ${cat.name}`, margin + 8, yBase + 22);
          }

          // Coach
          if (team.coach_name) {
            doc.text(`Coach: ${team.coach_name}`, margin + 8, yBase + 29);
          }

          // QR code (access code)
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            const qrUrl = `${appUrl}/coach/acces?code=${team.access_code}`;
            const qrDataUrl = await QRCode.toDataURL(qrUrl, {
              width: 200,
              margin: 1,
            });
            const qrSize = 35;
            doc.addImage(
              qrDataUrl,
              "PNG",
              margin + cardW - qrSize - 8,
              yBase + 6,
              qrSize,
              qrSize,
            );
            doc.setFontSize(6);
            doc.text("Scanner pour l'espace coach", margin + cardW - qrSize - 8, yBase + 44);
          } catch {
            // QR generation failed — skip
          }

          // Team matches
          const teamMatches = matches
            .filter(
              (m) => m.team_home === team.id || m.team_away === team.id,
            )
            .sort(
              (a, b) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
            )
            .slice(0, 8);

          if (teamMatches.length > 0) {
            autoTable(doc, {
              startY: yBase + 36,
              margin: { left: margin + 6, right: margin + 50 },
              head: [["Heure", "Vs", "Terrain"]],
              body: teamMatches.map((m) => [
                `${formatShortDate(m.start_time)} ${formatTime(m.start_time)}`,
                m.team_home === team.id ? m.display_away : m.display_home,
                m.field_name ?? "—",
              ]),
              styles: { fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [100, 116, 139], textColor: 255 },
              tableWidth: cardW - 60,
            });
          }
        }
      }

      // ── FICHES DE MATCH (optionnel) ────────────────
      if (sections.matchSheets) {
        // 3 match sheets per page
        const sheetH = (pageH - 4 * margin) / 3;

        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          const pos = i % 3;
          if (pos === 0) addPage();

          const y = margin + pos * (sheetH + margin / 2);

          doc.setDrawColor(180);
          doc.roundedRect(margin, y, pageW - 2 * margin, sheetH, 3, 3, "S");

          // Header
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(
            stripEmoji(`${m.category_name} - ${m.phase === "group" ? "Poules" : m.phase.toUpperCase()}`),
            margin + 4,
            y + 8,
          );
          doc.setFont("helvetica", "normal");
          doc.text(
            `${formatTime(m.start_time)} | ${m.field_name ?? ""}`,
            pageW - margin - 4,
            y + 8,
            { align: "right" },
          );

          // Teams
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          const centerX = pageW / 2;
          doc.text(stripEmoji(m.display_home), centerX - 20, y + 22, { align: "right" });
          doc.text("-", centerX, y + 22, { align: "center" });
          doc.text(stripEmoji(m.display_away), centerX + 20, y + 22);

          // Score boxes
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.rect(centerX - 25, y + 28, 20, 12);
          doc.rect(centerX + 5, y + 28, 20, 12);
          doc.text("Score", centerX - 15, y + 27, { align: "center" });
          doc.text("Score", centerX + 15, y + 27, { align: "center" });

          // Scorers area
          doc.text("Buteurs:", margin + 4, y + 48);
          doc.line(margin + 25, y + 48, pageW - margin - 4, y + 48);
          doc.line(margin + 25, y + 55, pageW - margin - 4, y + 55);

          // Notes
          doc.text("Obs:", margin + 4, y + 62);
          doc.line(margin + 15, y + 62, pageW - margin - 4, y + 62);
        }
      }

      // Save
      doc.save(`kit-tournoi-${tournament.slug}.pdf`);
    } finally {
      setGenerating(false);
    }
  }, [tournament, categories, teams, matches, fields, sections]);

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sectionOptions = [
    { key: "cover" as const, label: "Page de garde", icon: FileText },
    { key: "schedule" as const, label: "Planning complet", icon: FileText },
    { key: "fieldSheets" as const, label: "Fiches par terrain", icon: MapPin },
    { key: "teamCards" as const, label: "Fiches équipes + QR", icon: Users },
    { key: "matchSheets" as const, label: "Fiches de match (arbitre)", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kit tournoi imprimable</h1>
        <p className="text-muted-foreground mt-1">
          Générez un PDF complet pour le jour J : planning, fiches terrain, cartes équipes avec QR code.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Sections à inclure</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectionOptions.map((opt) => {
            const active = sections[opt.key];
            return (
              <button
                key={opt.key}
                onClick={() => toggleSection(opt.key)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {active ? (
                  <CheckCircle className="size-5 shrink-0" />
                ) : (
                  <opt.icon className="size-5 shrink-0" />
                )}
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{tournament.name}</h2>
            <p className="text-sm text-muted-foreground">
              {teams.length} équipes · {matches.length} matchs · {fields?.length ?? 0} terrains
            </p>
          </div>
          <Button
            size="lg"
            onClick={generatePDF}
            disabled={generating || matches.length === 0}
          >
            {generating ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Printer className="size-4 mr-2" />
            )}
            Télécharger le kit tournoi
          </Button>
        </div>
      </Card>

      {matches.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <Printer className="size-12 mx-auto mb-3 opacity-50" />
          <p>Aucun match programmé. Générez d&apos;abord un planning.</p>
        </Card>
      )}
    </div>
  );
}
