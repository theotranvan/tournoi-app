# Production Go-Live Checklist — Footix

> Ce document est la source de vérité pour le go-live.
> Tout point non coché est un risque explicite.
> Les points marqués `MANUAL STEP` nécessitent une action humaine hors du repo.

---

## CI/CD

- [x] Pipeline CI complet : lint + tests + build + E2E → image Docker → deploy
- [x] Tests backend bloquants (ruff + mypy + pytest ≥ 70% coverage)
- [x] Tests frontend bloquants (eslint + tsc + next build)
- [x] E2E frontend bloquants (Playwright)
- [x] Dependency scanning (pip-audit + npm audit)
- [x] Images taguées par SHA commit (immuables)
- [x] Deploy ne se déclenche que si tous les checks passent
- [ ] **MANUAL STEP** : Vérifier que les GitHub Secrets sont configurés :
  - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- [ ] **MANUAL STEP** : Configurer la branch protection sur `main` :
  - Require status checks (backend-lint, backend-tests, frontend-checks, frontend-e2e)
  - Require PR reviews

---

## Déploiement

- [x] Deploy via CI traçable (SHA → image → container)
- [x] Version déployée identifiable (`cat .deployed_sha` + `/api/v1/health/`)
- [x] Backup pré-deploy automatique (CI + deploy.sh)
- [x] Health check post-deploy automatique (6 tentatives × 10s)
- [x] Rollback automatique si health check échoue
- [x] Smoke test post-deploy automatique
- [x] `deploy.sh --build` protégé par confirmation interactive
- [x] `.deployed_sha.prev` sauvegardé pour rollback

---

## Rollback

- [x] Script de rollback opérationnel (`scripts/rollback.sh`)
- [x] Rollback par SHA (pull image GHCR + restart)
- [x] Rollback + restore DB (`--restore-db`)
- [x] Health check post-rollback
- [x] Runbook documenté (`docs/ROLLBACK_RUNBOOK.md`)

---

## Images immuables

- [x] Images taguées `ghcr.io/.../backend:<sha>` et `frontend:<sha>`
- [x] Tag `latest` aussi pushé (mais non utilisé en prod)
- [x] `IMAGE_TAG` propagé au container backend (visible via health endpoint)
- [ ] **MANUAL STEP** : Vérifier que GHCR est accessible depuis le VPS :
  ```bash
  docker pull ghcr.io/theotranvan/tournoi-app/backend:latest
  ```

---

## Secrets

- [ ] **MANUAL STEP** : Générer `SECRET_KEY` (50+ chars aléatoires)
- [ ] **MANUAL STEP** : Générer `POSTGRES_PASSWORD` (fort)
- [ ] **MANUAL STEP** : Générer `REDIS_PASSWORD` (fort)
- [ ] **MANUAL STEP** : Configurer `.env.production` depuis `.env.production.example`
- [ ] **MANUAL STEP** : Sauvegarder `.env.production` dans un gestionnaire de secrets
- [ ] **MANUAL STEP** : Vérifier que `.env.production` est dans `.gitignore` ✓

---

## HTTPS / SSL

- [x] Nginx config SSL stricte (TLS 1.2+, ciphers modernes)
- [x] HTTP → HTTPS redirect
- [x] HSTS 2 ans + preload
- [ ] **MANUAL STEP** : Obtenir le certificat SSL :
  ```bash
  ./deploy.sh --ssl
  ```
- [ ] **MANUAL STEP** : Vérifier le certificat :
  ```bash
  curl -vI https://footix.app 2>&1 | grep "expire date"
  ```

---

## Backups

- [x] Backup automatique daily (3h UTC) : DB + media + S3 + rotation
- [x] Backup pré-deploy automatique
- [x] Checksums SHA256 sur chaque backup
- [x] Vérification intégrité (`gunzip -t`)
- [x] Script de restore avec confirmation interactive
- [x] Restore avec `--clean --if-exists` (DROP + CREATE)
- [x] Restore avec `ON_ERROR_STOP=1`
- [ ] **MANUAL STEP** : Configurer S3 offsite :
  - Créer le bucket S3 (`footix-backups`)
  - Configurer `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` dans `.env.production`
- [ ] **MANUAL STEP** : Tester un backup complet :
  ```bash
  ./scripts/backup.sh
  ./scripts/backup.sh --verify
  ```
- [ ] **MANUAL STEP** : Tester une restauration :
  ```bash
  ./scripts/backup.sh --test-restore
  ```

---

## Monitoring / Observabilité

- [x] Health checks sur tous les services (DB, Redis, Celery, full)
- [x] Structlog pour le logging
- [x] Sentry intégré (Django + Celery + Redis)
- [x] Sentry scrubs sensitive data
- [x] Smoke test script disponible
- [ ] **MANUAL STEP** : Configurer `SENTRY_DSN` dans `.env.production`
- [ ] **MANUAL STEP** : Vérifier Sentry reçoit les erreurs :
  ```bash
  # Depuis le VPS
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
    python -c "import sentry_sdk; sentry_sdk.capture_message('Test from prod')"
  ```

---

## Email transactionnel

- [x] Configuration SMTP dans prod.py
- [ ] **MANUAL STEP** : Configurer le provider email (Resend) :
  - `EMAIL_HOST_PASSWORD` dans `.env.production`
- [ ] **MANUAL STEP** : Tester l'envoi :
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
    python -c "from django.core.mail import send_mail; send_mail('Test', 'OK', None, ['admin@footix.app'])"
  ```

---

## Stripe

- [x] Webhook sécurisé par signature
- [x] Webhook idempotent (table StripeEvent)
- [x] 3 plans supportés (FREE, ONE_SHOT, CLUB)
- [ ] **MANUAL STEP** : Configurer les Stripe price IDs dans `.env.production`
- [ ] **MANUAL STEP** : Configurer l'URL webhook dans Stripe Dashboard :
  - URL : `https://api.footix.app/api/v1/subscriptions/webhook/`
  - Events : `customer.subscription.*`, `invoice.payment_failed`, `payment_intent.succeeded`, `checkout.session.completed`
- [ ] **MANUAL STEP** : Tester un paiement en mode test

---

## Domaine / DNS

- [ ] **MANUAL STEP** : Configurer les records DNS :
  - `footix.app` → A record → IP du VPS
  - `api.footix.app` → A record → IP du VPS (ou CNAME)
- [ ] **MANUAL STEP** : Vérifier la résolution :
  ```bash
  dig footix.app +short
  dig api.footix.app +short
  ```

---

## Health checks

- [x] `/api/v1/health/` — simple (status + version)
- [x] `/api/v1/health/db/` — PostgreSQL
- [x] `/api/v1/health/redis/` — Redis cache
- [x] `/api/v1/health/celery/` — Celery workers
- [x] `/api/v1/health/full/` — Agrégé (DB + Redis + Celery)
- [ ] **MANUAL STEP** : Vérifier en prod :
  ```bash
  curl -s https://footix.app/api/v1/health/full/ | python3 -m json.tool
  ```

---

## Smoke tests

- [x] Script `scripts/smoke-test.sh`
- [ ] **MANUAL STEP** : Exécuter après deploy :
  ```bash
  bash scripts/smoke-test.sh https://footix.app
  ```

---

## Runbooks

- [x] `docs/DEPLOYMENT_RUNBOOK.md`
- [x] `docs/ROLLBACK_RUNBOOK.md`
- [x] `docs/BACKUP_AND_RESTORE_RUNBOOK.md`
- [x] `docs/DISASTER_RECOVERY_RUNBOOK.md`
- [x] `docs/PRODUCTION_SECURITY_CHECKLIST.md`
- [x] `docs/TOURNAMENT_DAY_RUNBOOK.md`
- [x] `docs/INCIDENT_RESPONSE_RUNBOOK.md`
- [x] `docs/runbook.md` (opérationnel général)

---

## Sécurité

- [x] Django prod settings stricts (voir `PRODUCTION_SECURITY_CHECKLIST.md`)
- [x] Nginx durci
- [x] API docs désactivés en prod
- [x] Redis avec mot de passe
- [x] Containers non-root
- [x] Throttling API
- [x] JWT rotation + blacklist
- [x] Stripe webhook vérifié + idempotent
- [x] Upload limits alignés nginx ↔ Django

---

## Procédure tournoi

- [x] Checklist J-1 dans `TOURNAMENT_DAY_RUNBOOK.md`
- [x] Checklist jour J
- [x] Checklist J+1
- [x] Procédures d'incident pendant tournoi
