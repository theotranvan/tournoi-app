# Deployment Runbook — Footix

## Quand utiliser ce runbook

- Déploiement standard via CI
- Déploiement manuel d'urgence
- Première mise en production

---

## 1. Déploiement standard (CI — chemin recommandé)

### Prérequis
- Code mergé sur `main`
- Tous les checks CI verts (lint, tests, build, E2E)
- Secrets GitHub configurés (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`)

### Procédure
1. Push ou merge sur `main`
2. GitHub Actions lance automatiquement :
   - `backend-lint` (ruff check + format + mypy + pip-audit)
   - `backend-tests` (pytest + coverage ≥ 70%)
   - `frontend-checks` (eslint + tsc + build + npm audit)
   - `frontend-e2e` (Playwright)
3. Si tous passent → build images Docker taguées `SHA` → push GHCR
4. Deploy via SSH :
   - Backup pré-deploy automatique
   - Pull images SHA-tagged
   - `docker compose up -d`
   - Health check (6 tentatives × 10s)
   - Smoke test post-deploy
   - Rollback auto si health échoue

### Vérification post-deploy
```bash
# Sur le VPS
cat .deployed_sha
curl -s http://localhost:8000/api/v1/health/full/ | python3 -m json.tool
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
bash scripts/smoke-test.sh http://localhost
```

---

## 2. Déploiement manuel (urgence uniquement)

### ⚠ Attention
Le `--build` local **bypasse les tests CI**. Réservé aux situations d'urgence ou au premier déploiement.

```bash
cd /opt/kickoff
./deploy.sh --build --migrate
```

### Déployer un SHA spécifique (image CI pré-buildée)
```bash
./deploy.sh --image-tag abc123def456
```

---

## 3. Premier déploiement

```bash
# 1. Cloner le repo
git clone https://github.com/theotranvan/tournoi-app.git /opt/kickoff
cd /opt/kickoff

# 2. Configurer l'environnement
cp .env.production.example .env.production
# Éditer .env.production avec les vraies valeurs

# 3. Obtenir le certificat SSL
./deploy.sh --ssl

# 4. Build et deploy initial
./deploy.sh --build --migrate

# 5. Créer le superuser
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python manage.py createsuperuser

# 6. Vérifier
bash scripts/smoke-test.sh http://localhost
bash scripts/smoke-test.sh https://footix.app
```

---

## 4. Diagnostic d'un deploy échoué

### Symptômes
- CI rouge → vérifier les logs GitHub Actions
- Health check échoue → vérifier les logs backend
- Frontend 502 → nginx ne peut pas joindre le frontend

### Commandes de diagnostic
```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Statut des services
$COMPOSE ps

# Logs des 5 dernières minutes
$COMPOSE logs --since=5m backend
$COMPOSE logs --since=5m frontend
$COMPOSE logs --since=5m nginx

# Health checks
curl -v http://localhost:8000/api/v1/health/full/
curl -v http://localhost:3000/
```

### Pièges à éviter
- Ne pas faire `docker compose down` sans raison (arrête tous les services)
- Ne pas supprimer les backups pré-deploy
- Ne pas faire `git reset --hard` sur le serveur de prod
- Ne pas faire `--build` sans raison (bypass CI)
