"use client";

import * as React from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, CalendarDays } from "lucide-react";
import type { MatchList, ScheduleDay } from "@/types/api";

function getAllMatches(schedule: ScheduleDay[]): (MatchList & { fieldName: string })[] {
  const matches: (MatchList & { fieldName: string })[] = [];
  for (const day of schedule) {
    for (const fs of day.fields) {
      for (const m of fs.matches) {
        matches.push({ ...m, fieldName: fs.field.name });
      }
    }
  }
  return matches.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface PlanningExportProps {
  schedule: ScheduleDay[];
  tournamentName: string;
}

export function PlanningExport({ schedule, tournamentName }: PlanningExportProps) {
  const [open, setOpen] = React.useState(false);

  const exportCSV = useCallback(() => {
    const matches = getAllMatches(schedule);
    const header = "Date;Heure;Terrain;Catégorie;Phase;Domicile;Extérieur;Score;Statut";
    const rows = matches.map((m) => {
      const score =
        m.score_home !== null && m.score_away !== null
          ? `${m.score_home}-${m.score_away}`
          : "";
      return [
        formatDate(m.start_time),
        formatTime(m.start_time),
        m.fieldName,
        m.category_name,
        m.phase,
        m.display_home,
        m.display_away,
        score,
        m.status,
      ].join(";");
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-${tournamentName.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [schedule, tournamentName]);

  const exportPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`Planning — ${tournamentName}`, 14, 18);

    const matches = getAllMatches(schedule);
    const body = matches.map((m) => [
      formatDate(m.start_time),
      formatTime(m.start_time),
      m.fieldName,
      m.category_name,
      m.phase,
      m.display_home,
      m.display_away,
      m.score_home !== null ? `${m.score_home}-${m.score_away}` : "",
      m.status,
    ]);

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Heure", "Terrain", "Cat.", "Phase", "Domicile", "Extérieur", "Score", "Statut"]],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`planning-${tournamentName.replace(/\s+/g, "-")}.pdf`);
    setOpen(false);
  }, [schedule, tournamentName]);

  const exportICS = useCallback(() => {
    const matches = getAllMatches(schedule);

    // Group by team
    const teamMap = new Map<string, typeof matches>();
    for (const m of matches) {
      for (const team of [m.display_home, m.display_away]) {
        if (!team) continue;
        const list = teamMap.get(team) ?? [];
        list.push(m);
        teamMap.set(team, list);
      }
    }

    // Generate one ICS per team, bundled in a global one
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Footix//Planning//FR",
      `X-WR-CALNAME:${tournamentName}`,
    ];

    for (const m of matches) {
      const start = new Date(m.start_time);
      const end = new Date(start.getTime() + m.duration_minutes * 60_000);
      const fmt = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

      lines.push(
        "BEGIN:VEVENT",
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${m.display_home} vs ${m.display_away}`,
        `DESCRIPTION:${m.category_name} — ${m.phase}`,
        `LOCATION:${m.fieldName}`,
        `UID:${m.id}@footix`,
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-${tournamentName.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [schedule, tournamentName]);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Download className="size-4 mr-1" />
        Exporter
      </Button>
      <DropdownMenu open={open} onClose={() => setOpen(false)}>
        <DropdownItem onClick={exportPDF}>
          <FileText className="size-3.5" />
          PDF (impression)
        </DropdownItem>
        <DropdownItem onClick={exportCSV}>
          <Table className="size-3.5" />
          CSV (Excel)
        </DropdownItem>
        <DropdownItem onClick={exportICS}>
          <CalendarDays className="size-3.5" />
          ICS (calendrier)
        </DropdownItem>
      </DropdownMenu>
    </div>
  );
}