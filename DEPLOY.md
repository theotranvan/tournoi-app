# Déploiement Footix en production

## Architecture de déploiement

```
push main → GitHub Actions:
  backend-lint → backend-tests → frontend-checks → frontend-e2e
    → build-images (SHA-pinned ghcr.io) → deploy (SSH pull + health gate)
```

**Principe** : images immuables taguées par SHA Git. Pas de `latest` en prod.

## Prérequis

- VPS Linux (ex : Hetzner CX22 ~4 €/mois)
- Domaine `footix.app` avec DNS pointant vers le VPS
- Compte Stripe (mode test puis live)
- Compte Sentry (free tier OK — 5k events/mois)
- Compte Resend (free 3k emails/mois) ou Brevo (free 300/jour)
- Bucket S3 compatible (Scaleway Object Storage, 75 Go gratuits) — pour media et backups offsite

## Étape 1 : Préparer le VPS

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git
git clone https://github.com/theotranvan/tournoi-app.git /opt/kickoff
cd /opt/kickoff
```

## Étape 2 : Setup Stripe

Sur ta machine locale :

```bash
export STRIPE_SECRET_KEY=sk_test_xxx  # commencer en TEST
python backend/scripts/setup_stripe.py
```

Note les 3 IDs `price_*` retournés.

Va sur https://dashboard.stripe.com/test/webhooks et crée un endpoint :
- URL : `https://api.footix.app/api/v1/subscriptions/webhook/`
- Events : `checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.*`, `invoice.payment_failed`

Copie le signing secret `whsec_...`.

## Étape 3 : Configurer .env.production

```bash
cp .env.production.example .env.production
nano .env.production
```

Renseigne :
- `SECRET_KEY` : `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `POSTGRES_PASSWORD` : mot de passe fort (32 caractères)
- `STRIPE_*` : depuis l'étape 2
- `SENTRY_DSN` : depuis sentry.io
- `EMAIL_*` : depuis Resend/Brevo
- `S3_BUCKET` : nom du bucket offsite
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` : credentials S3

## Étape 4 : DNS

- `footix.app` → A record → IP du VPS
- `api.footix.app` → A record → IP du VPS

## Étape 5 : Premier déploiement

```bash
chmod +x deploy.sh scripts/*.sh
./deploy.sh --build --migrate --ssl
```

## Étape 6 : Vérification

```bash
# Version déployée
cat .deployed_sha

# Healthcheck complet
curl -s https://api.footix.app/api/v1/health/full/ | python -m json.tool

# Frontend
curl -I https://footix.app/

# Logs
make logs
```

## Étape 7 : Premier compte admin

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Déploiement d'une version spécifique

```bash
# Via SHA Git
./deploy.sh --image-tag abc123def456

# Ou via Makefile
make deploy-tag TAG=abc123def456
```

## Connaître la version déployée

```bash
make version
# → Deployed: abc123def456
# → Git HEAD: abc123def
```

## Rollback

```bash
# Voir les versions récentes
git log --oneline -10

# Rollback vers un SHA
./scripts/rollback.sh abc123def456

# Rollback + restaurer la DB pré-deploy
./scripts/rollback.sh abc123def456 --restore-db
```

## Valider un rollback

```bash
# 1. Vérifier la version
cat .deployed_sha

# 2. Health check
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool

# 3. Logs
make logs
```

---

## Pipeline CI/CD — Checks requis

Le déploiement est bloqué si l'un de ces checks échoue :

| Job | Contenu |
|-----|---------|
| `backend-lint` | ruff check + ruff format + mypy |
| `backend-tests` | pytest + coverage ≥ 70% (postgres + redis) |
| `frontend-checks` | eslint + tsc + next build |
| `frontend-e2e` | Playwright E2E (chromium) |

**La prod ne peut jamais recevoir de code non testé.**

### Branch protection (à activer manuellement)

GitHub → Settings → Branches → `main` :
- [x] Require status checks: `backend-lint`, `backend-tests`, `frontend-checks`, `frontend-e2e`
- [x] Require branches to be up to date
- [x] Require pull request reviews (recommandé)

---

## Backups

```bash
# Backup complet (DB + media)
make backup

# Vérifier les backups
make backup-verify

# Test de restauration (non-destructif)
make backup-test-restore
```

Les backups sont automatiques (3h UTC via cron Docker) avec upload S3 si `S3_BUCKET` est configuré.

## Bascule Stripe LIVE

1. Activer le compte Stripe LIVE
2. Régénérer les products/prices avec `STRIPE_SECRET_KEY=sk_live_xxx python backend/scripts/setup_stripe.py`
3. Mettre à jour `.env.production`
4. Créer un nouveau webhook endpoint dans Stripe Dashboard (URL live)
5. Redémarrer : `make deploy`
3. Créer un nouveau webhook sur https://dashboard.stripe.com/webhooks (LIVE mode)
4. Mettre à jour `.env.production` avec les nouvelles clés `sk_live_*` et nouveaux `price_*`
5. Redéployer : `./deploy.sh`
