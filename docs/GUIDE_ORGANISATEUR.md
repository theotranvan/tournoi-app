# Guide de l'organisateur — Créer et gérer un tournoi

Ce guide décrit **pas à pas, précisément**, tout ce que vous devez faire dans
l'application, depuis la création de votre compte jusqu'à la clôture du tournoi.

> **En bref** — le parcours suit toujours le même fil, matérialisé dans l'app par
> une barre d'étapes (« stepper ») et une checklist :
>
> **Compte → Tournoi → Catégories → Équipes → Terrains → Poules → Planning → Publication → Jour J → Clôture**
>
> Chaque étape débloque la suivante : vous ne pouvez pas ajouter d'équipes sans
> catégorie, ni générer le planning sans catégories **+** équipes **+** terrains.

---

## Vocabulaire (à lire une fois)

| Terme | Signification |
|-------|---------------|
| **Tournoi** | L'événement complet (nom, lieu, dates). |
| **Catégorie** | Un niveau/âge géré séparément (ex. U11, U13). Chaque catégorie a ses points, sa durée de match et ses phases finales. |
| **Équipe** | Un club engagé dans **une** catégorie. |
| **Terrain** | Un espace de jeu, avec ses créneaux de disponibilité. |
| **Poule (groupe)** | Sous-ensemble d'équipes d'une catégorie qui se rencontrent entre elles. |
| **Phase** | Poule, puis phases finales (1/8, 1/4, demie, 3e place, finale). |
| **Statut du tournoi** | Brouillon → Publié → En cours → Terminé. |
| **Code public** | Code à 6 caractères (ex. `ABC123`) que le public saisit pour suivre les scores. |
| **Code d'accès équipe** | Code propre à chaque équipe, à donner au coach pour son espace. |

---

## Étape 1 — Créer votre compte organisateur

1. À la première ouverture, l'app affiche l'**écran de bienvenue** (3 slides). Faites
   défiler ou touchez **« Passer »**.
2. Sur l'écran **« Je démarre »**, choisissez la carte **« Je suis organisateur »**.
3. Touchez **« Créer un compte »** (page `/admin/register`) et renseignez :
   - **Pseudo** (nom d'utilisateur) ;
   - **E-mail** ;
   - **Mot de passe** (8 caractères minimum) ;
   - **Confirmation** du mot de passe.
4. Validez. Vous arrivez sur votre **tableau de bord** (`/admin`).

> Déjà un compte ? Utilisez **« Se connecter »** (`/admin/login`).

---

## Étape 2 — Créer le tournoi

1. Menu **Tournois** → bouton **« Nouveau tournoi »** (`/admin/tournois/new`).
2. Remplissez le formulaire :

   **Informations générales**
   - **Nom du tournoi** *(obligatoire)* — ex. « Tournoi de Printemps U13 ».
   - **Lieu** *(obligatoire)* — ex. « Stade municipal, Paris ».
   - **Date de début** et **Date de fin** *(obligatoires)* — la fin doit être ≥ au début.
   - **Description** *(facultatif)*.
   - **☑ Page publique accessible sans connexion** — cochée par défaut ; laissez-la
     cochée pour que le public puisse suivre le tournoi avec le code.

   **Durées par défaut** (réutilisées par toutes les catégories, modifiables ensuite)
   - **Match** (min) — défaut **15**.
   - **Transition** (min) entre deux matchs sur un terrain — défaut **5**.
   - **Repos min** (min) entre deux matchs d'une même équipe — défaut **30**.

   **Séparation des phases** (protège le repos des jeunes joueurs)
   - **Aucune séparation** ; ou
   - **Repos allongé avant les phases finales** — un **multiplicateur** (ex. ×3)
     s'applique au repos minimum avant une finale ; ou
   - **Phases finales le lendemain**.
3. Touchez **« Créer le tournoi »**. Il est créé en statut **Brouillon** et vous
   arrivez sur sa **page de gestion**.

---

## La page de gestion du tournoi (votre centre de contrôle)

En haut : le **nom**, le **statut**, le **lieu/dates**, le **code public** (bouton
copier), et le bouton d'action principal (**Publier**, puis **Démarrer**, puis
**Terminer** selon l'avancement). En dessous : une **checklist**, des **compteurs**
(Catégories / Équipes / Matchs / Terrains), des **outils** (Mode Live, Kit
imprimable, Simulateur…), puis la **barre d'étapes** cliquable :

**Catégories → Équipes → Terrains → Planning → Live**

Suivez ces onglets dans l'ordre.

---

## Étape 3 — Configurer les catégories

Onglet **Catégories** → bouton **« Catégorie »**. Pour chaque catégorie :

- **Nom** *(obligatoire)* — ex. « U13 ».
- **Couleur** — pour repérer la catégorie dans les plannings.
- **Jour assigné** — « Tous les jours » ou un jour précis (tournoi multi-jours).
- **Pts victoire / Pts nul** — barème (défaut 3 / 1 ; défaite 0).
- **Durée match (min)** — laissez vide pour utiliser la valeur par défaut du tournoi.
- **Joueurs/équipe** — indicatif.
- **Nombre de poules** — laissez vide pour une répartition automatique.
- **Format finales** :
  - **Pas de finales** ;
  - **Demi-finales croisées (1er vs 2e)** — 1er poule A vs 2e poule B, etc., puis
    finale + petite finale ;
  - **Finale directe** — les 1ers de chaque poule s'affrontent directement.
- **Repos min (matchs)** / **Max consécutifs** — contraintes fines (sinon valeurs du tournoi).

Touchez **« Créer »**. Répétez pour chaque catégorie. Vous pouvez **modifier** (✏️) ou
**supprimer** (🗑️) une catégorie à tout moment.

---

## Étape 4 — Ajouter les équipes

Onglet **Équipes**. Trois méthodes :

**A. Ajout rapide** — bouton **« Équipe »** :
- **Catégorie** ;
- **Nom** *(obligatoire)* — commencez à taper : l'app propose les **clubs FFF** et
  **récupère automatiquement le logo** ;
- **Abréviation** (auto-remplie) ;
- **Coach** (nom).

**B. Gestion complète** — bouton **« Gestion complète »** (`/admin/equipes`) pour éditer
tous les champs (téléphone/e-mail du coach, logo…).

**C. Import CSV en masse** — depuis la gestion complète, importez un fichier `.csv`
avec exactement ces colonnes :

```
category_name, name, short_name, coach_name, coach_phone, coach_email
```

> Il faut **au moins 2 équipes** pour générer un planning. Chaque équipe reçoit un
> **code d'accès** (visible et copiable dans la liste des équipes) : communiquez-le
> au coach concerné pour qu'il ouvre son espace sur `/coach/acces`.

---

## Étape 5 — Configurer les terrains

Onglet **Terrains** → bouton **« Terrain »** :

- **Nom** *(obligatoire)* — ex. « Terrain 1 ».
- **Ordre** d'affichage.
- **☑ Terrain actif** — seuls les terrains actifs sont utilisés par le planning.
- **Disponibilités** *(facultatif)* — par jour, un ou plusieurs créneaux `début → fin`.
  - **« Auto-remplir depuis jours »** reprend les horaires des journées du tournoi.
  - Sans disponibilité, le terrain est réputé **disponible toute la journée**.

> Il faut **au moins 1 terrain actif** pour générer le planning.

---

## Étape 6 — Générer les poules (groupes)

Onglet **Planning**, section **« Groupes & Poules »** :

1. Sélectionnez la **catégorie**.
2. **« Générer »** → indiquez le **nombre de groupes** : les équipes sont réparties de
   façon **équilibrée**. (Ou **« Ajouter »** pour créer un groupe à la main.)
3. Répétez pour chaque catégorie.

---

## Étape 7 — Générer le planning des matchs

Toujours dans l'onglet **Planning** (ou via **« Planning complet »** →
`/admin/planning`) :

1. **Choix du mode de planification** (onglet **Live → Paramètres**) :
   - **Par catégorie** — une catégorie après l'autre ;
   - **Entrelacé** — matchs de toutes catégories mélangés pour optimiser les terrains.
2. Sur la page Planning, consultez le **panneau de faisabilité** : il indique si le
   temps et les terrains suffisent, et signale les points de blocage.
3. Touchez **« Générer le planning »** (⚡). L'app place tous les matchs (poules) sur
   les terrains et les créneaux.
4. Vérifiez le résultat :
   - **Conflits** éventuels signalés en orange (équipe qui jouerait deux fois en même
     temps, etc.) ;
   - **Glisser-déposer** un match pour le **déplacer** ou l'**échanger** de terrain/heure ;
   - Clic droit / menu : **verrouiller**, **reporter** ou **supprimer** un match ;
   - Navigation **jour par jour** (J1, J2…) ;
   - Icône **écran** à côté d'un terrain : ouvre un **affichage grand écran** dédié à
     ce terrain (utile le jour J).
5. Outils utiles : **Mode briefing** (plein écran), **Export** (PDF/impression),
   **Diagnostics**.

> Vous pouvez régénérer le planning autant de fois que nécessaire tant que le tournoi
> n'a pas commencé. Les matchs **verrouillés** sont préservés.

---

## Étape 8 — Publier et partager

1. Revenez sur la page du tournoi. Quand la checklist est complète, touchez
   **« Publier »**. Le statut passe **Brouillon → Publié**.
2. Le tournoi devient accessible au public via son **code public** (bouton **copier**
   à côté du code, ex. `ABC123`).
3. Communiquez :
   - **le code public** au public et aux spectateurs → ils le saisissent sur la page
     **« Suivre un tournoi »** (`/tournoi`) pour voir scores, classements et matchs en direct ;
   - **le code d'accès** de chaque équipe à son coach → espace coach sur `/coach/acces`.
4. Astuce : le **Kit imprimable** (bouton **« Kit imprimable »**,
   `/admin/tournois/<id>/print`) regroupe le planning et les codes d'accès des équipes,
   prêts à distribuer.

---

## Étape 9 — Le jour du tournoi : démarrer et saisir les scores

1. Sur la page du tournoi, touchez **« Démarrer »**. Le statut passe **Publié → En cours**.
2. Ouvrez le **Mode Live** (bouton **« Mode Live »**) ou le **Planning** pour accéder
   aux matchs.
3. **Saisir un score** — touchez un match, puis sur la page de saisie :
   - **« Démarrer le match »** (si le match est encore « Programmé ») → il passe « En cours » ;
   - Réglez le score avec les boutons **+ / −** pour chaque équipe ;
   - En **phase finale**, si le score est à égalité, un bloc **« Tirs au but »** apparaît
     (ils ne peuvent pas être à égalité) ;
   - Touchez **« Valider le score »** ;
   - Écran **« Buteurs » (optionnel)** : ajoutez nom du joueur + minute, ou **« Passer »**.
4. **Phases finales automatiques** — dès que **tous les matchs de poule d'une catégorie**
   sont terminés, l'app propose **« Générer les finales »** : elle crée les rencontres
   (demies, finale, petite finale) selon le format choisi à l'étape 3.

> Les classements et scores se mettent à jour **en direct** sur la page publique et,
> le cas échéant, sur les affichages grand écran par terrain.

---

## Étape 10 — Clôturer le tournoi

Quand tous les matchs sont joués, touchez **« Terminer »**. Le statut passe
**En cours → Terminé**. Les résultats finaux et les statistiques restent consultables.

---

## Outils complémentaires

| Outil | Où | À quoi ça sert |
|-------|-----|----------------|
| **Kit imprimable** | Page tournoi | Planning + codes d'accès des équipes à imprimer/distribuer. |
| **Simulateur** | Page tournoi | Tester des scénarios de résultats et voir l'impact sur les classements. |
| **Affichage terrain** | Planning (icône écran) | Grand écran par terrain avec le programme des matchs. |
| **Mode briefing** | Planning | Vue plein écran pour présenter le planning. |
| **Export** | Planning | Exporter/imprimer le planning. |
| **Dupliquer** | Page tournoi | Recréer un tournoi identique (édition suivante). |
| **Insights** | Page tournoi | Statistiques avancées *(fonction Pro)*. |
| **Mode speaker** | Page tournoi | Aide au commentaire en direct *(fonction Pro)*. |

Les fonctions **Pro** (Insights, Mode speaker) nécessitent un abonnement, géré depuis
**Abonnement** (`/admin/abonnement`).

---

## Aide-mémoire — l'ordre à respecter

1. ✅ Compte organisateur
2. ✅ Tournoi (nom, lieu, dates, durées)
3. ✅ **Catégories** (barème, format des finales)
4. ✅ **Équipes** (≥ 2 ; manuel / FFF / CSV)
5. ✅ **Terrains** (≥ 1 actif ; disponibilités)
6. ✅ **Poules** (générées par catégorie)
7. ✅ **Planning** (générer, vérifier les conflits)
8. ✅ **Publier** + partager les codes
9. ✅ **Démarrer** + saisir les scores + générer les finales
10. ✅ **Terminer**

Si un onglet est grisé, c'est qu'une étape précédente reste à compléter : la
checklist et l'infobulle vous indiquent laquelle.
