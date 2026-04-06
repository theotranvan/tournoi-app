"""Management command: test_engine — runs the scheduling engine on thedemo tournament."""

from __future__ import annotations

import time
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError

from apps.scheduling.engine import SchedulingEngine
from apps.tournaments.models import Tournament


class Command(BaseCommand):
    help = "Lance le moteur de planning sur un tournoi et affiche un rapport."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tournament",
            type=str,
            default=None,
            help="Slug du tournoi (défaut: tournoi-demo-2026)",
        )
        parser.add_argument(
            "--strategy",
            type=str,
            default="balanced",
            choices=["balanced", "compact", "category_priority"],
        )
        parser.add_argument(
            "--size",
            type=str,
            default=None,
            choices=["small", "medium", "large"],
            help="Crée un tournoi temporaire de la taille indiquée (ne modifie pas la DB).",
        )
        parser.add_argument(
            "--benchmark",
            action="store_true",
            help="Affiche les temps d'exécution détaillés.",
        )

    def handle(self, *args, **options):
        strategy = options["strategy"]

        if options["size"]:
            self._run_benchmark(options["size"], strategy)
            return

        slug = options["tournament"] or "tournoi-demo-2026"
        try:
            tournament = Tournament.objects.get(slug=slug)
        except Tournament.DoesNotExist:
            raise CommandError(
                f"Tournoi '{slug}' introuvable. "
                f"Lancez 'python manage.py seed_demo' d'abord."
            )

        self.stdout.write(self.style.HTTP_INFO(f"\n{'='*60}"))
        self.stdout.write(self.style.HTTP_INFO("  KICKOFF — Moteur de planning"))
        self.stdout.write(self.style.HTTP_INFO(f"  Tournoi: {tournament.name}"))
        self.stdout.write(self.style.HTTP_INFO(f"  Stratégie: {strategy}"))
        self.stdout.write(self.style.HTTP_INFO(f"{'='*60}\n"))

        start = time.time()
        engine = SchedulingEngine(tournament, strategy=strategy)

        def _progress(pct, msg):
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            self.stdout.write(f"\r  [{bar}] {pct:3d}% {msg}", ending="")
            self.stdout.flush()

        engine.set_progress_callback(_progress)
        report = engine.generate()
        elapsed = time.time() - start

        self.stdout.write("")  # newline after progress bar
        self._print_report(report, elapsed, engine)

        if options["benchmark"]:
            self.stdout.write(f"\n  ⏱  Temps total: {elapsed*1000:.0f}ms")

    def _run_benchmark(self, size, strategy):
        """Create a temporary tournament and benchmark the engine."""
        from apps.scheduling.tests.conftest import make_tournament
        from tests.factories import UserFactory

        configs = {
            "small": dict(n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=1),
            "medium": dict(n_categories=3, teams_per_cat=8, n_fields=3, n_days=1, n_groups=2),
            "large": dict(n_categories=5, teams_per_cat=16, n_fields=6, n_days=2, n_groups=4),
        }

        self.stdout.write(self.style.HTTP_INFO(f"\n  Benchmark: {size} tournament"))

        user = UserFactory()
        tournament = make_tournament(user, **configs[size])

        start = time.time()
        engine = SchedulingEngine(tournament, strategy=strategy)
        report = engine.generate()
        elapsed = time.time() - start

        self._print_report(report, elapsed, engine)

    def _print_report(self, report, elapsed, engine):
        """Pretty-print the scheduling report."""
        self.stdout.write(self.style.HTTP_INFO(f"\n{'─'*60}"))
        self.stdout.write(self.style.HTTP_INFO("  📊 RAPPORT DE PLANIFICATION"))
        self.stdout.write(self.style.HTTP_INFO(f"{'─'*60}"))

        # Score
        score = report.score
        if score >= 90:
            style = self.style.SUCCESS
        elif score >= 70:
            style = self.style.WARNING
        else:
            style = self.style.ERROR
        self.stdout.write(style(f"  Score global: {score:.1f}/100"))

        # Stats
        self.stdout.write(f"  Matchs placés: {report.placed_count}/{report.total_count}")
        self.stdout.write(f"  Temps: {elapsed*1000:.0f}ms")
        self.stdout.write(f"  Stratégie: {report.strategy_used.value}")

        # Conflicts
        if report.hard_conflicts:
            self.stdout.write(self.style.ERROR(
                f"\n  ⚠ {len(report.hard_conflicts)} CONFLIT(S) HARD:"
            ))
            for c in report.hard_conflicts[:5]:
                self.stdout.write(self.style.ERROR(f"    • {c.reason}"))
        else:
            self.stdout.write(self.style.SUCCESS("  ✅ Aucun conflit hard"))

        # Warnings
        if report.soft_warnings:
            self.stdout.write(self.style.WARNING(
                f"\n  ⚡ {len(report.soft_warnings)} avertissement(s):"
            ))
            for w in report.soft_warnings[:10]:
                self.stdout.write(self.style.WARNING(f"    • {w.message}"))
        else:
            self.stdout.write(self.style.SUCCESS("  ✅ Aucun avertissement"))

        # Schedule grid (ASCII art)
        if engine._context and engine._context.placements:
            self._print_grid(engine)

        self.stdout.write(f"\n{'─'*60}\n")

    def _print_grid(self, engine):
        """Print an ASCII grid of the schedule: day × field × time slots."""
        from collections import defaultdict

        placements = engine._context.placements
        fields = engine._context.fields

        # Group by (day, field_id) → list of placements
        grid: dict[str, dict[int, list]] = defaultdict(lambda: defaultdict(list))
        for p in placements:
            day = p.start_time.date().isoformat()
            grid[day][p.field_id].append(p)

        self.stdout.write(self.style.HTTP_INFO("\n  📅 PLANNING DÉTAILLÉ"))

        for day in sorted(grid.keys()):
            self.stdout.write(self.style.HTTP_INFO(f"\n  ┌── {day} {'─'*45}"))
            for fid in sorted(grid[day].keys()):
                fname = fields[fid].name if fid in fields else f"Terrain {fid}"
                pls = sorted(grid[day][fid], key=lambda p: p.start_time)
                self.stdout.write(f"  │ {fname}:")
                for p in pls:
                    cat = engine._context.categories.get(p.match.category_id)
                    cat_name = cat.name if cat else "?"
                    start = p.start_time.strftime("%H:%M")
                    end_t = p.start_time + timedelta(minutes=p.match.duration)
                    end = end_t.strftime("%H:%M")
                    home = p.match.placeholder_home or "Eq."
                    away = p.match.placeholder_away or "Eq."
                    if p.match.team_home_id:
                        t = engine._context.teams.get(p.match.team_home_id)
                        home = t.name if t else home
                    if p.match.team_away_id:
                        t = engine._context.teams.get(p.match.team_away_id)
                        away = t.name if t else away
                    phase = p.match.phase.upper()[:3]
                    self.stdout.write(
                        f"  │   {start}-{end}  [{cat_name}] "
                        f"{phase}: {home} vs {away}"
                    )
            self.stdout.write(f"  └{'─'*58}")
