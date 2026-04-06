"""Management command: seed_demo — crée un tournoi de démo complet."""

from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Field, Tournament


class Command(BaseCommand):
    help = "Crée un tournoi de démo complet avec 24 équipes."

    def handle(self, *args, **options) -> None:
        # ── Organisateur ─────────────────────────────────────────────────
        owner, _ = User.objects.get_or_create(
            username="demo_admin",
            defaults={
                "email": "admin@demo.footix.fr",
                "role": User.Role.ORGANIZER,
            },
        )
        if not owner.has_usable_password():
            owner.set_password("demo1234")
            owner.save()

        # ── Club ─────────────────────────────────────────────────────────
        club, _ = Club.objects.get_or_create(
            slug="fc-demo",
            defaults={
                "name": "FC Demo",
                "owner": owner,
                "contact_email": "contact@fc-demo.fr",
            },
        )

        # ── Tournoi ──────────────────────────────────────────────────────
        start = date(2026, 6, 13)
        end = start + timedelta(days=1)
        tournament, created = Tournament.objects.get_or_create(
            slug="tournoi-demo-2026",
            defaults={
                "club": club,
                "name": "Tournoi de démo 2026",
                "location": "Stade Municipal de Demo",
                "start_date": start,
                "end_date": end,
                "status": Tournament.Status.DRAFT,
                "default_match_duration": 15,
                "default_transition_time": 5,
                "default_rest_time": 20,
            },
        )

        if not created:
            self.stdout.write(self.style.WARNING("Le tournoi de démo existe déjà."))
            return

        # ── Catégories ───────────────────────────────────────────────────
        categories_cfg = [
            {"name": "U10", "display_order": 0, "color": "#22c55e", "players_per_team": 5},
            {"name": "U11", "display_order": 1, "color": "#3b82f6", "players_per_team": 7},
            {"name": "U13", "display_order": 2, "color": "#ef4444", "players_per_team": 9},
        ]
        categories: list[Category] = []
        for cfg in categories_cfg:
            cat = Category.objects.create(tournament=tournament, **cfg)
            categories.append(cat)

        # ── Terrains ─────────────────────────────────────────────────────
        avail_both_days = [
            {"date": str(start), "start": "08:00", "end": "19:00"},
            {"date": str(end), "start": "08:00", "end": "17:00"},
        ]
        for i, name in enumerate(["Terrain A", "Terrain B", "Terrain C"]):
            Field.objects.create(
                tournament=tournament,
                name=name,
                display_order=i,
                is_active=True,
                availability=avail_both_days,
            )

        # ── Équipes (8 par catégorie = 24 total) ────────────────────────
        club_names = [
            "AS Soleil", "FC Étoiles", "US Tonnerre", "RC Vague",
            "OC Flamme", "SC Foudre", "ES Vent", "JS Tempête",
        ]
        total_teams = 0
        for cat in categories:
            for club_name in club_names:
                Team.objects.create(
                    tournament=tournament,
                    category=cat,
                    name=f"{club_name} {cat.name}",
                    coach_name=f"Coach {club_name}",
                    coach_email=f"coach@{club_name.lower().replace(' ', '')}.fr",
                )
                total_teams += 1

            # ── 2 poules par catégorie ───────────────────────────────────
            teams = list(cat.teams.all())
            mid = len(teams) // 2
            for j, (pool_name, pool_teams) in enumerate(
                [("Poule A", teams[:mid]), ("Poule B", teams[mid:])]
            ):
                group = Group.objects.create(
                    category=cat, name=pool_name, display_order=j
                )
                group.teams.set(pool_teams)

        self.stdout.write(
            self.style.SUCCESS(
                f"Tournoi de démo créé avec {total_teams} équipes"
            )
        )
