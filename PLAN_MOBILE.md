# KICKOFF — Plan de Publication Mobile (iOS + Android)

> **Objectif** : Transformer l'app Next.js existante en une application mobile publiable sur l'App Store et le Google Play Store, avec un design user-friendly irréprochable pour les 3 types d'utilisateurs.

---

## Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────┐
│                 CAPACITOR SHELL                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  iOS App  │  │ Android   │  │   Web PWA   │  │
│  │ (Swift)   │  │ (Kotlin)  │  │  (existant) │  │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  │
│        └───────────────┼───────────────┘         │
│              ┌─────────▼─────────┐               │
│              │   Next.js 16 SSG  │               │
│              │  (export statique)│               │
│              └─────────┬─────────┘               │
│                        │                         │
│         ┌──────────────┼──────────────┐          │
│         │              │              │          │
│    ┌────▼────┐   ┌─────▼─────┐  ┌────▼─────┐   │
│    │ Admin   │   │  Coach    │  │  Public   │   │
│    │ Space   │   │  Space    │  │  Space    │   │
│    └─────────┘   └───────────┘  └──────────┘   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Django Backend API   │
            │  + WebSocket + Celery │
            └───────────────────────┘
```

**Stratégie choisie : Capacitor** — on wrappe l'app Next.js existante dans des shells natifs iOS/Android, sans réécrire en React Native. Cela donne accès aux stores tout en gardant 95% du code actuel.

---

## PHASES DU PLAN

| Phase | Nom | Durée est. | Priorité |
|-------|-----|-----------|----------|
| **0** | Préparation & Architecture | — | 🔴 Critique |
| **1** | Design System & Thème | — | 🔴 Critique |
| **2** | Refonte UX — Espace Public | — | 🔴 Critique |
| **3** | Refonte UX — Espace Coach | — | 🔴 Critique |
| **4** | Refonte UX — Espace Admin | — | 🔴 Critique |
| **5** | Fonctionnalités manquantes | — | 🟡 Important |
| **6** | Capacitor — Build natif | — | 🔴 Critique |
| **7** | Notifications Push | — | 🟡 Important |
| **8** | Performance & Offline | — | 🟡 Important |
| **9** | Assets Store & Déploiement | — | 🔴 Critique |

---

## PHASE 0 — Préparation & Architecture

### 0.1 Export statique Next.js
Le build Capacitor nécessite un export statique (`output: 'export'` dans next.config).

```
Fichiers à modifier :
├── frontend/next.config.ts          → ajouter output: 'export'
├── frontend/capacitor.config.ts     → CRÉER
├── frontend/package.json            → ajouter scripts capacitor
```

**Actions :**
- [ ] Configurer `next.config.ts` avec `output: 'export'` pour le build mobile
- [ ] Installer Capacitor : `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- [ ] Installer plugins natifs : `@capacitor/push-notifications`, `@capacitor/haptics`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/app`
- [ ] Créer `capacitor.config.ts` (appId: `com.kickoff.app`, webDir: `out`)
- [ ] `npx cap init` + `npx cap add ios` + `npx cap add android`
- [ ] Ajouter `.gitignore` pour `ios/` et `android/` (garder les configs, ignorer les builds)

### 0.2 Structure des environnements
```
frontend/
├── .env.development      → API_URL=http://localhost:8000
├── .env.production       → API_URL=https://api.kickoff.app
├── .env.capacitor        → API_URL dynamique (résolu au runtime)
```

### 0.3 API URL dynamique pour mobile
L'app mobile ne peut pas appeler `localhost`. Créer un helper qui détecte l'environnement :
```typescript
// lib/config.ts
export function getApiUrl() {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    return 'https://api.kickoff.app'; // Production API
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}
```

---

## PHASE 1 — Design System & Thème

### 1.1 Light Mode + Auto

Actuellement l'app est dark-only. Pour les stores, il faut supporter le mode clair (requis pour l'accessibilité).

```
Fichiers à modifier :
├── frontend/src/app/globals.css          → les tokens .light existent déjà ✅
├── frontend/src/app/layout.tsx           → détecter prefers-color-scheme
├── frontend/src/stores/theme-store.ts    → CRÉER (dark/light/system)
├── frontend/src/components/ui/theme-toggle.tsx → CRÉER
```

**Actions :**
- [ ] Créer `theme-store.ts` (Zustand, persisté localStorage) — 3 modes : `dark`, `light`, `system`
- [ ] Modifier `layout.tsx` : appliquer la classe `dark`/`light` sur `<html>`
- [ ] Créer `ThemeToggle` composant (icône soleil/lune)
- [ ] Ajouter dans `/admin/parametres` et `/coach/parametres`
- [ ] Tester tous les écrans en light mode, ajuster les contrastes si nécessaire

### 1.2 Typographie & Espacement mobile

- [ ] Augmenter les tailles de tap targets à **44px minimum** (recommandation Apple/Google)
- [ ] Vérifier les `font-size` : minimum 14px pour le texte courant sur mobile
- [ ] Ajouter `safe-area-inset-*` pour les encoches iPhone (notch)
- [ ] Padding bottom sur les pages avec bottom nav : `pb-20` (nav = 64px + safe area)

### 1.3 Composants UI manquants

```
Composants à créer :
├── ui/toast.tsx           → Notifications in-app (succès, erreur)
├── ui/alert.tsx           → Bandeaux d'alerte contextuels
├── ui/avatar.tsx          → Photo équipe / club
├── ui/progress.tsx        → Barre de progression (upload, génération)
├── ui/dropdown-menu.tsx   → Menu déroulant (actions contextuelles)
├── ui/switch.tsx          → Toggle on/off (paramètres)
├── ui/tooltip.tsx         → Infobulles (desktop seulement)
├── ui/empty-state.tsx     → État vide réutilisable (illustration + CTA)
├── ui/pull-to-refresh.tsx → Tirer pour rafraîchir (mobile natif)
├── ui/bottom-sheet.tsx    → Sheet qui monte du bas (remplace dialog sur mobile)
```

### 1.4 Illustrations & Micro-interactions

- [ ] Remplacer les emojis (⚽) par des illustrations SVG propres ou Lottie animations
- [ ] Ajouter des animations Framer Motion sur les transitions de page
- [ ] Feedback haptique via `@capacitor/haptics` sur les actions importantes (but marqué, score sauvé)
- [ ] Animations de chargement contextuelles (skeleton → contenu avec fade-in)
- [ ] Animation de score en temps réel (chiffres qui roulent)

---

## PHASE 2 — Refonte UX : Espace Public 📱

**Cible :** Parents, spectateurs, fans — l'écran le plus vu. Doit être beau et ultra-simple.

### 2.1 Écran d'accueil public (refonte complète)

```
┌──────────────────────────┐
│  🏆 Nom du Tournoi       │
│  📍 Lieu • 5-6 avril     │
│  [Cover image plein écran]│
│                           │
│  ╔═══════════════════════╗│
│  ║  3 matchs en direct   ║│
│  ║  🔴 U10 Pool A        ║│
│  ║  Équipe A  2 — 1  B   ║│
│  ║  ⏱ 23'               ║│
│  ╚═══════════════════════╝│
│                           │
│  ┌─────┬───────┬────────┐ │
│  │ 🔴  │ 📅    │ 🏆     │ │
│  │Live │Matchs │Classmt │ │
│  └─────┴───────┴────────┘ │
│                           │
│  ── Prochains matchs ──   │
│  [Card] [Card] [Card]     │
│                           │
│  ── Derniers résultats ── │
│  [Card] [Card] [Card]     │
└──────────────────────────┘
```

**Actions :**
- [ ] Hero section avec image de couverture du tournoi (blur gradient en bas)
- [ ] Compteur "matchs en direct" animé avec pastille rouge pulsante
- [ ] Carrousel de matchs en direct (swipe horizontal)
- [ ] Onglets sticky : Live | Matchs | Classements | Équipes | Infos
- [ ] Filtres par catégorie (badges horizontaux scrollables)
- [ ] Match cards redesignées avec :
  - Logos/initiales des équipes (ronds colorés)
  - Score gros et centré
  - Barre de progression pour les matchs en cours (temps écoulé)
  - Indicateur "En direct" animé
- [ ] Pull-to-refresh pour actualiser les données
- [ ] Connexion WebSocket avec indicateur discret (point vert)

### 2.2 Détail d'un match (nouvelle page)

```
Nouvelle route : /tournoi/[slug]/match/[id]
```

- [ ] Score XXL animé en haut
- [ ] Timeline des buts (marqueur + minute + joueur)
- [ ] Infos : terrain, arbitre, heure, catégorie
- [ ] Bouton "Partager" le résultat (Web Share API / Capacitor Share)

### 2.3 Classements améliorés

- [ ] Tableau responsive avec highlight de la position (podium coloré 🥇🥈🥉)
- [ ] Mini-graphe de forme (5 derniers matchs : V/N/D en pastilles colorées)
- [ ] Sélecteur de catégorie + groupe stylé
- [ ] Animation de transition quand on change de groupe

### 2.4 Page Équipe publique

```
Nouvelle route : /tournoi/[slug]/equipe/[id]
```

- [ ] Header avec logo/initiale, nom de l'équipe, catégorie
- [ ] Stats : J/G/N/P, buts marqués/encaissés
- [ ] Liste des matchs (passés + à venir)
- [ ] QR code pour partager la page équipe

### 2.5 Onglet Infos tournament

- [ ] Description du tournoi (Markdown → HTML)
- [ ] Règlement
- [ ] Plan d'accès (lien Google Maps)
- [ ] Contact organisateur
- [ ] Liste des terrains avec numéro

---

## PHASE 3 — Refonte UX : Espace Coach 📋

**Cible :** Coachs d'équipes — besoin d'infos rapides sur LEUR équipe.

### 3.1 Onboarding Coach (nouveau flow)

```
┌──────────────────────────┐
│                           │
│  Bienvenue, Coach ! 🏟️    │
│                           │
│  Entrez votre code        │
│  d'accès équipe :         │
│                           │
│  ┌────────────────────┐   │
│  │  A B 1 2 3 X       │   │
│  └────────────────────┘   │
│                           │
│    — ou —                 │
│                           │
│  [📷 Scanner le QR code]  │
│                           │
└──────────────────────────┘
```

**Actions :**
- [ ] Écran de saisie du code d'accès repensé (gros input, clavier numérique)
- [ ] Scanner QR code via `@capacitor/barcode-scanner` (ou caméra basique)
- [ ] Animation de confirmation quand l'équipe est trouvée
- [ ] Persistance de l'équipe (déjà en place via Zustand + localStorage)

### 3.2 Dashboard Coach (refonte)

```
┌──────────────────────────┐
│  👋 Bonjour, Coach !      │
│  FC Dragons • U11         │
│  Tournoi de Printemps     │
│                           │
│  ╔═══════════════════════╗│
│  ║  PROCHAIN MATCH       ║│
│  ║  vs FC Lions          ║│
│  ║  ⏰ Aujourd'hui 14h30 ║│
│  ║  📍 Terrain 3         ║│
│  ║  ⏱ Dans 2h15          ║│
│  ╚═══════════════════════╝│
│                           │
│  ┌─── Stats rapides ────┐ │
│  │ 3J  2V  0N  1D       │ │
│  │ 8 buts ⚽ | 3 encaissés│
│  └───────────────────────┘│
│                           │
│  ── Résultats récents ── │
│  ✅ 3-1 vs Aigles        │
│  ✅ 2-0 vs Phoenix       │
│  ❌ 1-2 vs Tigres        │
│                           │
│  ── Classement du groupe ─│
│  1. FC Dragons  ★ 6pts   │
│  2. FC Lions      4pts    │
│  3. FC Aigles     3pts    │
│                           │
│  [Accueil][Matchs][🏆][⚙]│
└──────────────────────────┘
```

**Actions :**
- [ ] En-tête avec nom d'équipe, catégorie, logo (ou lettre dans cercle coloré)
- [ ] Card "Prochain match" proéminente avec countdown
- [ ] Grille de stats (matchs joués, victoires, nuls, défaites, buts)
- [ ] Mini-classement du groupe "in-page" (sans naviguer)
- [ ] Feed des résultats récents avec icônes V/N/D
- [ ] Bouton "Voir le planning complet" → /coach/matches

### 3.3 Page Matchs Coach

- [ ] Liste chronologique avec séparateur par jour
- [ ] Distinction visuelle passé (grisé) / présent (vert highlight) / futur
- [ ] Match en direct : card spéciale avec bord vert pulsant + score temps réel
- [ ] Tap → détail du match avec score, buts, terrain, heure

### 3.4 Page Classements Coach

- [ ] Mon groupe avec MA position highlightée (fond vert)
- [ ] Tableau avec colonnes : Pos, Équipe, J, V, N, D, BP, BC, Diff, Pts
- [ ] Barre de forme (5 derniers matchs)
- [ ] Si plusieurs groupes dans la catégorie, montrer les autres en accordéon

### 3.5 Page Paramètres Coach

- [ ] Infos de l'équipe (lecture seule)
- [ ] Code d'accès (copier/partager)
- [ ] Thème clair/sombre
- [ ] Notifications (si activées)
- [ ] Bouton "Changer d'équipe"
- [ ] Bouton "Se déconnecter"

---

## PHASE 4 — Refonte UX : Espace Admin 🛡️

**Cible :** Organisateurs de tournois — besoin d'efficacité et de contrôle.

### 4.1 Dashboard Admin (refonte)

```
┌──────────────────────────┐
│  🏟️ Dashboard              │
│                           │
│  ┌──────┬──────┬────────┐ │
│  │  3   │ 48   │  120   │ │
│  │Tourn.│Matchs│Équipes │ │
│  └──────┴──────┴────────┘ │
│                           │
│  ╔═══════════════════════╗│
│  ║ Tournoi en cours :    ║│
│  ║ Coupe de Printemps    ║│
│  ║ 🔴 5 matchs en direct ║│
│  ║ [Voir le planning]    ║│
│  ╚═══════════════════════╝│
│                           │
│  ── Actions rapides ────  │
│  [+ Nouveau tournoi]      │
│  [📊 Générer planning]    │
│  [📋 Saisir les scores]   │
│                           │
│  ── Tournois récents ──   │
│  [Card] [Card]             │
└──────────────────────────┘
```

**Actions :**
- [ ] Stats cards animées (compteurs qui montent)
- [ ] Card "Tournoi actif" avec lien direct au planning
- [ ] Quick actions (boutons d'action rapide)
- [ ] Liste des tournois récents avec status badges colorés
- [ ] Toast de bienvenue au premier login

### 4.2 Gestion Tournoi (refonte)

```
Route : /admin/tournois/[id]
```

Refondre en tabs internes :
- [ ] **Général** : Nom, lieu, dates, description, image de couverture
- [ ] **Catégories** : CRUD avec cards colorées, drag & drop pour réordonner
- [ ] **Équipes** : Vue par catégorie, import CSV/Excel, génération de QR codes
- [ ] **Terrains** : Cards avec statut actif/inactif, horaires de disponibilité visuels
- [ ] **Groupes** : Tirage au sort automatique, drag & drop des équipes entre groupes
- [ ] **Planning** : Faisabilité + génération + vue calendrier
- [ ] **Scores** : Saisie rapide en grille (score home | score away)
- [ ] **Paramètres** : Publication, visibilité, suppression

### 4.3 Saisie de score (refonte critique)

C'est l'écran le plus utilisé PENDANT le tournoi. Il doit être ultra-rapide.

```
┌──────────────────────────┐
│  Match #42 • U11 Pool A  │
│  Terrain 3 • 14h30       │
│                           │
│      FC Dragons           │
│                           │
│    ┌───┐       ┌───┐     │
│    │ 3 │  ---  │ 1 │     │
│    └─┬─┘       └─┬─┘     │
│    [+][-]      [+][-]     │
│                           │
│      FC Lions             │
│                           │
│  ── Buts ──               │
│  ⚽ 12' Lucas (Home)      │
│  ⚽ 23' Théo (Home)       │
│  ⚽ 31' Axel (Away)       │
│  ⚽ 45' Lucas (Home)      │
│  [+ Ajouter un but]       │
│                           │
│  [💾 Valider le score]    │
└──────────────────────────┘
```

**Actions :**
- [ ] Boutons +/- gros et tactiles (64px) pour incrémenter/décrémenter le score
- [ ] Feedback haptique sur chaque tap
- [ ] Liste des buts avec possibilité d'ajouter joueur + minute
- [ ] Bouton "Démarrer le match" (change status → live)
- [ ] Bouton "Terminer le match" (change status → finished)
- [ ] Confirmation avant validation
- [ ] Animation confetti à la fin d'un match

### 4.4 Planning (enrichir)

- [ ] Vue calendrier (en plus de la grille actuelle)
- [ ] Drag & drop de matchs entre créneaux (desktop)
- [ ] Faisabilité déjà intégrée ✅
- [ ] Export PDF du planning
- [ ] Partager le planning (lien public)

### 4.5 Gestion Équipes (enrichir)

- [ ] Import bulk (CSV : nom, catégorie, coach, email)
- [ ] Génération et téléchargement de QR codes par équipe
- [ ] Envoi par email du code d'accès au coach
- [ ] Vue par catégorie avec compteurs

---

## PHASE 5 — Fonctionnalités Manquantes

### 5.1 Système de Notifications

```
Backend :
├── apps/notifications/models.py     → CRÉER
├── apps/notifications/views.py      → CRÉER
├── apps/notifications/tasks.py      → CRÉER (Celery)
├── apps/notifications/signals.py    → CRÉER

Frontend :
├── hooks/use-notifications.ts       → CRÉER
├── components/ui/notification-bell.tsx → CRÉER
```

**Types de notifications :**
| Événement | Destinataire | Canal |
|-----------|-------------|-------|
| Match démarre | Coach + Public | Push + In-app |
| Score final | Coach + Public | Push + In-app |
| But marqué | Public abonnés | In-app |
| Planning généré | Admin | In-app |
| Changement de terrain | Coach | Push + In-app |
| Tournoi publié | All | Push |

### 5.2 Recherche de tournois publics

- [ ] Page `/tournois` listant tous les tournois publics
- [ ] Recherche par nom, lieu, date
- [ ] Filtres par statut (en cours, à venir, terminé)
- [ ] Carte interactive (si localisation disponible)

### 5.3 Partage et réseaux sociaux

- [ ] Bouton "Partager" sur chaque match, équipe, classement
- [ ] Génération d'image de score à partager (canvas → image)
- [ ] Deep links : `kickoff.app/tournoi/coupe-printemps/match/42`
- [ ] Open Graph meta tags pour preview dans les réseaux sociaux

### 5.4 Multi-langue (i18n)

- [ ] Français par défaut (déjà le cas)
- [ ] Anglais comme 2e langue
- [ ] Utiliser `next-intl` ou `react-i18next`
- [ ] Traduction des éléments statiques de l'UI

### 5.5 Accessibilité (a11y)

- [ ] Contraste WCAG AA minimum (4.5:1 texte, 3:1 grands textes)
- [ ] Labels ARIA sur tous les éléments interactifs
- [ ] Navigation clavier complète
- [ ] Réduction de mouvement (`prefers-reduced-motion`)
- [ ] Tailles de police adaptatives (respect du zoom système)

---

## PHASE 6 — Capacitor : Build Natif

### 6.1 Configuration iOS

```
ios/App/App/Info.plist :
├── CFBundleDisplayName: Kickoff
├── CFBundleIdentifier: com.kickoff.app
├── NSCameraUsageDescription: Scanner les QR codes
├── UIStatusBarStyle: UIStatusBarStyleLightContent
```

**Actions :**
- [ ] Configurer le splash screen natif (LaunchScreen.storyboard)
- [ ] Générer les icônes iOS (toutes les tailles requises via @capacitor/assets)
- [ ] Configurer StatusBar (dark content sur light, light content sur dark)
- [ ] Configurer la safe area pour l'île dynamique (iPhone 14+)
- [ ] Tester sur simulateur iOS
- [ ] Configurer le signing avec un Apple Developer Account

### 6.2 Configuration Android

```
android/app/src/main/AndroidManifest.xml :
├── package: com.kickoff.app
├── INTERNET permission
├── CAMERA permission (QR)
├── VIBRATE permission (haptics)
├── POST_NOTIFICATIONS permission (Android 13+)
```

**Actions :**
- [ ] Configurer le splash screen (drawable)
- [ ] Générer les icônes Android (adaptive icons, toutes densités)
- [ ] Configurer les couleurs de la status bar et navigation bar
- [ ] Tester sur émulateur Android
- [ ] Configurer le signing avec un keystore

### 6.3 Plugins Capacitor

```json
{
  "@capacitor/app": "gestion du cycle de vie",
  "@capacitor/haptics": "vibrations tactiles",
  "@capacitor/keyboard": "gestion clavier natif",
  "@capacitor/status-bar": "style de la barre d'état",
  "@capacitor/splash-screen": "écran de chargement",
  "@capacitor/push-notifications": "notifications push",
  "@capacitor/share": "partage natif",
  "@capacitor/browser": "liens externes",
  "@capacitor/barcode-scanner": "scan QR code (coach)"
}
```

### 6.4 Scripts npm

```json
{
  "build:mobile": "next build && npx cap sync",
  "ios": "npx cap open ios",
  "android": "npx cap open android",
  "icons": "npx capacitor-assets generate"
}
```

---

## PHASE 7 — Notifications Push

### 7.1 Backend : Firebase Cloud Messaging (FCM)

```
Nouvelles dépendances :
├── firebase-admin (Python)
├── django-push-notifications (ou custom)

Nouveau modèle :
├── DeviceToken(user, token, platform, created_at)

Nouveaux endpoints :
├── POST /api/v1/devices/register/    → enregistrer un token FCM
├── DELETE /api/v1/devices/{token}/   → supprimer un token
├── GET /api/v1/notifications/        → historique des notifications
├── PATCH /api/v1/notifications/{id}/ → marquer comme lue
```

### 7.2 Frontend : Réception

- [ ] Enregistrer le token FCM à la connexion via `@capacitor/push-notifications`
- [ ] Gérer les notifications foreground (afficher un toast)
- [ ] Gérer les notifications background (badge + son)
- [ ] Deep link depuis la notification vers la page concernée
- [ ] Badge sur l'icône de l'app avec le nombre de notifications non lues

---

## PHASE 8 — Performance & Offline

### 8.1 Optimisation des performances

- [ ] Images en format WebP/AVIF avec `next/image` (lazy loading)
- [ ] Code splitting par route (déjà automatique avec Next.js)
- [ ] Bundle analyzer : vérifier que le JS < 300KB gzipped
- [ ] Prefetch des pages les plus probables
- [ ] Debounce sur les recherches et filtres
- [ ] Virtualisation des longues listes (400+ matchs) avec `react-window`

### 8.2 Offline amélioré

- [ ] Cache des données consultées récemment dans IndexedDB
- [ ] Mode offline gracieux : afficher les données en cache avec banner "Hors ligne"
- [ ] File d'attente pour les scores saisis hors ligne (sync au retour)
- [ ] Service Worker intelligent : stratégie stale-while-revalidate pour les données API

### 8.3 Métriques

- [ ] Lighthouse score cible : >90 Performance, >95 Accessibilité
- [ ] Web Vitals : LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Monitoring : Sentry (crash reporting) + Analytics (usage patterns)

---

## PHASE 9 — Assets Store & Déploiement

### 9.1 Assets pour les stores

```
Dossier à créer : /store-assets/
├── icon-1024.png                → Icône app (1024x1024, sans transparence)
├── feature-graphic.png          → Bannière Google Play (1024x500)
├── screenshots/
│   ├── iphone-6.7/             → 6 screenshots iPhone 6.7" (1290x2796)
│   │   ├── 01-home.png
│   │   ├── 02-live.png
│   │   ├── 03-score.png
│   │   ├── 04-standings.png
│   │   ├── 05-planning.png
│   │   └── 06-coach.png
│   ├── iphone-6.5/             → 6 screenshots iPhone 6.5" (1284x2778)
│   ├── ipad-12.9/              → 6 screenshots iPad 12.9" (2048x2732)
│   └── android/                → 6 screenshots (1080x1920 min)
├── preview-video.mp4            → Vidéo preview 30s (optionnel)
```

### 9.2 Fiche App Store (Apple)

```
Nom : Kickoff — Tournois de foot
Sous-titre : Organisez, suivez, vibrez
Catégorie : Sports
Mots-clés : tournoi, football, foot, score, classement, planning, match, live
Description (courte) :
  Kickoff est l'app tout-en-un pour organiser et suivre vos tournois
  de football. Créez votre tournoi, gérez les équipes, générez le
  planning automatiquement, et partagez les scores en temps réel.

Politique de confidentialité : URL requise
Conditions d'utilisation : URL requise
Support : email + URL
```

### 9.3 Fiche Google Play

```
Titre : Kickoff — Gestion de tournois de foot
Description courte (80 car.) : Organisez vos tournois de foot et suivez les scores en direct
Catégorie : Sports
Classification : Tout public (PEGI 3)
```

### 9.4 Déploiement Backend

```yaml
# Infrastructure production requise :
├── Serveur API : Django + Gunicorn + Nginx (VPS ou PaaS)
├── Base de données : PostgreSQL 16 (managed)
├── Cache/Broker : Redis 7 (managed)
├── WebSocket : Daphne (ASGI) derrière Nginx
├── Worker : Celery (1+ worker)
├── Fichiers statiques : S3 / Cloudflare R2
├── SSL : Let's Encrypt ou Cloudflare
├── Domaine : api.kickoff.app + kickoff.app
```

Options de déploiement :
1. **Railway / Render** — PaaS simple, ~$25/mois
2. **VPS (Hetzner/OVH)** — Plus contrôle, ~$15/mois
3. **Docker Compose** sur VPS — `docker-compose.prod.yml` déjà prêt

### 9.5 CI/CD Pipeline

```yaml
# .github/workflows/mobile-build.yml
- Push sur main → Build Next.js → Sync Capacitor
- Tag v*.*.* →
    - Build iOS → Upload TestFlight (Fastlane)
    - Build Android → Upload Google Play Console (Fastlane)
```

### 9.6 Checklist pré-soumission

**App Store (Apple) :**
- [ ] Apple Developer Account ($99/an)
- [ ] App ID enregistré dans le portail développeur
- [ ] Certificats de distribution
- [ ] Profil de provisioning
- [ ] Politique de confidentialité hébergée
- [ ] App Review Guidelines respectées
- [ ] Pas de web view wrapper "sans valeur" — l'app doit apporter une vraie valeur native
- [ ] TestFlight : 2 semaines de beta minimum recommandé
- [ ] Formulaire de review : expliquer les logins de test

**Google Play :**
- [ ] Google Developer Account ($25 one-time)
- [ ] Keystore signé (garder en lieu sûr !)
- [ ] Politique de confidentialité
- [ ] Data Safety form rempli
- [ ] Content rating questionnaire
- [ ] Internal testing track → Closed beta → Production

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

```
SPRINT 1 — Fondations
├── Phase 0 : Capacitor setup
├── Phase 1.1 : Light mode + theme toggle
├── Phase 1.2 : Tap targets + safe areas
└── Phase 1.3 : Composants UI de base (toast, empty-state, etc.)

SPRINT 2 — Espace Public (le plus visible)
├── Phase 2.1 : Accueil public refait
├── Phase 2.2 : Détail match
├── Phase 2.3 : Classements améliorés
└── Phase 2.4 : Page équipe publique

SPRINT 3 — Espace Coach
├── Phase 3.1 : Onboarding coach + QR scan
├── Phase 3.2 : Dashboard coach refait
├── Phase 3.3 : Matchs coach
├── Phase 3.4 : Classements coach
└── Phase 3.5 : Paramètres coach

SPRINT 4 — Espace Admin
├── Phase 4.1 : Dashboard admin refait
├── Phase 4.2 : Gestion tournoi en tabs
├── Phase 4.3 : Saisie de score refaite
├── Phase 4.4 : Planning enrichi
└── Phase 4.5 : Gestion équipes (import, QR)

SPRINT 5 — Fonctionnalités complémentaires
├── Phase 5.1 : Notifications in-app
├── Phase 5.3 : Partage
├── Phase 5.5 : Accessibilité
└── Phase 8.1 : Performance

SPRINT 6 — Build & Déploiement
├── Phase 6 : Builds natifs iOS + Android
├── Phase 7 : Push notifications
├── Phase 9.1-9.3 : Assets store
├── Phase 9.4 : Déploiement backend
├── Phase 9.5 : CI/CD
└── Phase 9.6 : Soumission stores
```

---

## FICHIERS À CRÉER / MODIFIER — RÉSUMÉ

### Nouveaux fichiers (~40)
```
frontend/
├── capacitor.config.ts
├── src/stores/theme-store.ts
├── src/components/ui/toast.tsx
├── src/components/ui/alert.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/progress.tsx
├── src/components/ui/dropdown-menu.tsx
├── src/components/ui/switch.tsx
├── src/components/ui/empty-state.tsx
├── src/components/ui/pull-to-refresh.tsx
├── src/components/ui/bottom-sheet.tsx
├── src/components/ui/theme-toggle.tsx
├── src/components/ui/notification-bell.tsx
├── src/components/kickoff/score-editor.tsx
├── src/components/kickoff/team-avatar.tsx
├── src/components/kickoff/match-timeline.tsx
├── src/components/kickoff/share-button.tsx
├── src/components/kickoff/live-indicator.tsx
├── src/app/tournoi/[slug]/match/[id]/page.tsx
├── src/app/tournoi/[slug]/equipe/[id]/page.tsx
├── src/app/tournois/page.tsx
├── src/hooks/use-notifications.ts
├── src/hooks/use-theme.ts
├── src/lib/config.ts
├── src/lib/capacitor.ts

backend/
├── apps/notifications/models.py
├── apps/notifications/views.py
├── apps/notifications/serializers.py
├── apps/notifications/tasks.py
├── apps/notifications/signals.py
├── apps/notifications/urls.py

racine/
├── store-assets/ (screenshots, icônes)
├── .github/workflows/mobile-build.yml
```

### Fichiers à modifier (~20)
```
frontend/
├── next.config.ts                    → output: 'export' (mobile)
├── package.json                      → +capacitor deps, +scripts
├── src/app/layout.tsx                → +theme support
├── src/app/globals.css               → +safe-area, +light mode checks
├── src/app/page.tsx                  → refonte landing
├── src/app/admin/page.tsx            → refonte dashboard
├── src/app/admin/planning/page.tsx   → enrichir
├── src/app/admin/tournois/[id]/page.tsx → refonte en tabs
├── src/app/admin/match/[id]/score/page.tsx → refonte saisie score
├── src/app/admin/equipes/page.tsx    → enrichir
├── src/app/coach/page.tsx            → refonte dashboard
├── src/app/coach/acces/page.tsx      → onboarding QR
├── src/app/coach/matches/page.tsx    → enrichir
├── src/app/coach/classements/page.tsx → enrichir
├── src/app/coach/parametres/page.tsx → enrichir
├── src/app/tournoi/[slug]/page.tsx   → refonte complète
├── src/components/layout/mobile-nav.tsx → enrichir
├── src/lib/api.ts                    → +dynamic URL

backend/
├── config/settings.py                → +notifications app, +FCM
├── config/urls.py                    → +notifications routes
```

---

## MÉTRIQUES DE SUCCÈS

| Critère | Cible |
|---------|-------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| Taille du bundle JS | < 300KB gzipped |
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Note App Store | Objectif 4.5+ ⭐ |
| Crash rate | < 0.5% |
| Rétention J7 | > 40% |

---

> **Ce plan est conçu pour être exécuté phase par phase. Chaque phase est indépendante et testable.
> On commence quand tu veux — dis-moi "Go" et on attaque le Sprint 1.**
