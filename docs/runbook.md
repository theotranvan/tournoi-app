# Runbook opérationnel — Footix

> Variables: `COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"`

## Runbooks spécialisés

| Sujet | Document |
|-------|----------|
| Déploiement | [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) |
| Rollback | [ROLLBACK_RUNBOOK.md](ROLLBACK_RUNBOOK.md) |
| Backup & Restore | [BACKUP_AND_RESTORE_RUNBOOK.md](BACKUP_AND_RESTORE_RUNBOOK.md) |
| Disaster Recovery | [DISASTER_RECOVERY_RUNBOOK.md](DISASTER_RECOVERY_RUNBOOK.md) |
| Sécurité prod | [PRODUCTION_SECURITY_CHECKLIST.md](PRODUCTION_SECURITY_CHECKLIST.md) |
| Jour de tournoi | [TOURNAMENT_DAY_RUNBOOK.md](TOURNAMENT_DAY_RUNBOOK.md) |
| Réponse incidents | [INCIDENT_RESPONSE_RUNBOOK.md](INCIDENT_RESPONSE_RUNBOOK.md) |
| Go-live checklist | [PRODUCTION_GO_LIVE_CHECKLIST.md](PRODUCTION_GO_LIVE_CHECKLIST.md) |

---

## 1. Déploiement

### Procédure standard (via CI)
1. Push sur `main` → GitHub Actions lance :
   - `backend-lint` : ruff check + ruff format + mypy
   - `backend-tests` : pytest avec postgres + redis, coverage ≥ 70%
   - `frontend-checks` : eslint + tsc + next build
   - `frontend-e2e` : Playwright E2E (chromium)
2. Si **tous** les checks passent → build images Docker taguées `SHA` → push GHCR
3. Deploy via SSH : backup pré-deploy → pull images SHA-tagged → `up -d` → smoke test → rollback auto si santé KO

### Procédure manuelle
```bash
cd /opt/kickoff

# Déployer le HEAD actuel
./deploy.sh --build --migrate

# Déployer un SHA spécifique (image pré-buildée)
./deploy.sh --image-tag abc123def456
```

### Vérification post-deploy
```bash
# Version déployée
cat .deployed_sha

# Health check complet
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool

# Services running
$COMPOSE ps

# Erreurs récentes
$COMPOSE logs --since=5m backend | grep -i error
```

---

## 2. Rollback

### Symptômes nécessitant un rollback
- Health check échoue après deploy
- Erreurs 500 massives dans Sentry
- Fonctionnalité critique cassée

### Procédure (rollback par image SHA)
```bash
cd /opt/kickoff

# 1. Voir la version actuelle et les précédentes
cat .deployed_sha
git log --oneline -10

# 2. Rollback vers le SHA précédent
./scripts/rollback.sh abc123def456

# 3. Rollback + restaurer la DB pré-deploy (si migration destructive)
./scripts/rollback.sh abc123def456 --restore-db
```

### Rollback automatique
Le CI et `deploy.sh` effectuent un rollback automatique si le health check échoue après déploiement. Le SHA précédent est lu depuis `.deployed_sha`.

### Vérification post-rollback
```bash
# Version effective
cat .deployed_sha
# Health
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool
# Logs
$COMPOSE logs --since=5m backend | grep -i error
```

### À ne PAS faire
- Ne pas `git reset --hard` sur le serveur
- Ne pas supprimer les backups pré-deploy
- Ne pas rollback sans vérifier si une migration irréversible a été appliquée

---

## 3. Backup

### Automatique
- **Cron Docker** : daily 3h UTC (5h Paris été) via service `backup` dans docker-compose.prod.yml
  - DB: pg_dump → gzip → checksum SHA256 → gunzip -t
  - Media: tar.gz du volume media
  - Offsite: upload S3 si `S3_BUCKET` est configuré
  - Rotation: suppression automatique après `BACKUP_RETENTION` jours (défaut: 30)
  - Logs: chaque exécution produit un fichier `.log`
- **Pré-deploy** : automatique à chaque `deploy.sh` et chaque CI deploy
- **Intégrité** : checksum SHA256 + `gunzip -t` sur chaque backup

### Manuel
```bash
./scripts/backup.sh              # Full (DB + media + S3 offsite)
./scripts/backup.sh --db-only    # DB seulement
./scripts/backup.sh --media-only # Media seulement
```

### Vérifier les backups
```bash
# Vérifier intégrité de tous les backups
./scripts/backup.sh --verify

# Test de restauration non-destructif
./scripts/backup.sh --test-restore
```

### Vérifier un backup individuel
```bash
sha256sum -c backups/db_kickoff_YYYYMMDD.sql.gz.sha256
gunzip -t backups/db_kickoff_YYYYMMDD.sql.gz
```

---

## 4. Restauration

### Restaurer la base de données
```bash
# 1. Vérifier l'intégrité
./scripts/backup.sh --verify

# 2. Restaurer (confirmation interactive)
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD.sql.gz

# 3. Vérifier
$COMPOSE exec backend python manage.py check
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool
```

### Restaurer les fichiers media
```bash
./scripts/backup.sh --restore-media backups/media_YYYYMMDD.tar.gz
```

### Restauration depuis S3 (backup offsite)
```bash
# 1. Lister les backups disponibles
aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $AWS_S3_ENDPOINT_URL

# 2. Télécharger
aws s3 cp s3://$S3_BUCKET/backups/YYYYMMDD_HHMMSS/ ./backups/ --recursive --endpoint-url $AWS_S3_ENDPOINT_URL

# 3. Vérifier et restaurer
./scripts/backup.sh --verify
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD.sql.gz
./scripts/backup.sh --restore-media backups/media_YYYYMMDD.tar.gz
```

### RPO / RTO
- **RPO** (perte max) : 24h (backups daily à 3h UTC)
- **RTO** (temps reprise) : ~15 min (restore DB + media + restart containers)
- Avec backup offsite S3 : RPO identique, mais survit à la perte totale du serveur

---

## 5. Disaster Recovery — Serveur perdu / VPS mort

### Prérequis
- Nouveau VPS avec Docker installé
- Accès au dépôt Git
- Fichier `.env.production` sauvegardé hors serveur
- Backup DB + media récent (S3 offsite ou copie locale)

### Procédure
```bash
# 1. Cloner le repo
git clone https://github.com/theotranvan/tournoi-app.git /opt/kickoff
cd /opt/kickoff

# 2. Restaurer la config
cp /path/to/.env.production .env.production

# 3. Récupérer les backups depuis S3
mkdir -p backups
aws s3 cp s3://$S3_BUCKET/backups/ ./backups/ --recursive --endpoint-url $AWS_S3_ENDPOINT_URL

# 4. Lancer les services (build local si GHCR inaccessible)
./deploy.sh --build --migrate --ssl

# 5. Restaurer la DB
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD.sql.gz

# 6. Restaurer les media
./scripts/backup.sh --restore-media backups/media_YYYYMMDD.tar.gz

# 7. Vérifier
make health
make version
```

### Temps estimé : 15-30 minutes (hors provisionning DNS)

---

## 6. Rotation des secrets

### Inventaire des secrets
| Secret | Localisation | Rotation |
|--------|-------------|----------|
| `SECRET_KEY` | `.env.production` | Annuel — invalidera toutes les sessions JWT |
| `POSTGRES_PASSWORD` | `.env.production` | Annuel — nécessite update postgres + backend |
| `STRIPE_SECRET_KEY` | `.env.production` + Stripe Dashboard | Si compromis |
| `STRIPE_WEBHOOK_SECRET` | `.env.production` + Stripe Dashboard | Si compromis |
| `VAPID_PRIVATE_KEY` | `.env.production` | Si compromis |
| `EMAIL_HOST_PASSWORD` | `.env.production` + provider email | Si compromis |
| `DEPLOY_SSH_KEY` | GitHub Secrets | Annuel |

### Procédure rotation SECRET_KEY
```bash
# 1. Générer une nouvelle clé
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# 2. Mettre à jour .env.production avec la nouvelle clé
# 3. Redémarrer le backend
$COMPOSE restart backend celery-worker celery-beat
# Note: tous les tokens JWT existants seront invalidés
```

---

## 7. Incidents par composant

### Backend ne répond plus
**Symptômes** : 502/503 nginx, health check échoue
**Diagnostic** :
```bash
$COMPOSE ps backend
$COMPOSE logs --tail=100 backend
```
**Actions** :
```bash
$COMPOSE restart backend
# Si persistant :
$COMPOSE down backend && $COMPOSE up -d backend
```
**À ne pas faire** : ne pas kill -9 le container, utiliser `restart`

### Stripe webhook en erreur
**Symptômes** : paiements acceptés mais licences non activées, Stripe dashboard montre des webhooks failed
**Diagnostic** :
```bash
$COMPOSE logs --since=1h backend | grep -i stripe
$COMPOSE logs --since=1h backend | grep -i webhook
```
**Actions** :
```bash
# 1. Vérifier STRIPE_WEBHOOK_SECRET dans .env.production
# 2. Vérifier que l'URL webhook est correcte dans Stripe Dashboard
# 3. Relancer le webhook manuellement depuis Stripe Dashboard
# 4. Si licence non créée, activer manuellement :
$COMPOSE exec backend python manage.py shell
# >>> from apps.subscriptions.models import TournamentLicense
# >>> TournamentLicense.objects.filter(tournament_id="XXX").update(is_active=True)
```

### Email transactionnel en panne
**Symptômes** : emails non reçus, erreurs SMTP dans les logs
**Diagnostic** :
```bash
$COMPOSE logs --since=1h backend | grep -i email
$COMPOSE exec backend python -c "
from django.core.mail import send_mail
send_mail('Test', 'Test body', None, ['admin@footix.app'])
"
```
**Actions** : Vérifier les credentials SMTP dans `.env.production`, vérifier le provider (Resend dashboard)

### WebSocket / temps réel en panne
**Symptômes** : scores live ne se mettent pas à jour, pas de notifications push côté client
**Diagnostic** :
```bash
# Vérifier Redis (couche channels)
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD ping
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD info memory
# Vérifier les connexions WS
$COMPOSE logs --tail=50 backend | grep -i websocket
```
**Actions** :
```bash
$COMPOSE restart backend
# Si Redis saturé :
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD flushdb
$COMPOSE restart backend
```
**Note** : Les clients WebSocket se reconnectent automatiquement

### DB indisponible
**Symptômes** : erreurs 500 massives, health check `/api/v1/health/db/` échoue
**Diagnostic** :
```bash
$COMPOSE ps postgres
$COMPOSE exec postgres pg_isready -U kickoff
$COMPOSE logs --tail=50 postgres
```
**Actions** :
```bash
$COMPOSE restart postgres
# Attendre 30s pour le healthcheck
curl -s http://localhost:8000/api/v1/health/db/
```

### Redis indisponible
**Symptômes** : WebSocket mort, cache en erreur, Celery bloqué
**Diagnostic** :
```bash
$COMPOSE ps redis
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD ping
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD info memory
```
**Actions** :
```bash
$COMPOSE restart redis
$COMPOSE restart backend celery-worker celery-beat
```

### Saturation disque
**Symptômes** : erreurs write dans les logs, backup échoue
**Diagnostic** :
```bash
df -h /
du -sh backups/ /var/lib/docker/
docker system df
```
**Actions** :
```bash
# 1. Nettoyer les vieux backups
find backups/ -name "*.gz" -mtime +7 -delete
# 2. Nettoyer Docker
docker image prune -af
docker volume prune -f
# 3. Nettoyer les logs
$COMPOSE logs --tail=0  # ne fait rien, mais montre la taille
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### Erreurs 500 massives
**Symptômes** : pic d'erreurs Sentry, plaintes utilisateurs
**Diagnostic** :
```bash
$COMPOSE logs --since=15m backend | grep -c "ERROR"
$COMPOSE logs --since=15m backend | grep "ERROR" | head -20
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool
```
**Actions** : identifier le pattern (DB? Redis? code?) et appliquer le runbook correspondant

---

## 8. Checklists tournoi

### Avant tournoi (J-1)
- [ ] `curl -s https://api.footix.app/api/v1/health/full/` → tout `ok`
- [ ] Tous les services UP : `$COMPOSE ps`
- [ ] Backup récent : `ls -la backups/ | head -3`
- [ ] Espace disque > 2GB : `df -h /`
- [ ] Pas d'erreurs récentes : `$COMPOSE logs --since=24h backend | grep -c ERROR`
- [ ] DNS résolu correctement
- [ ] SSL valide : `curl -vI https://footix.app 2>&1 | grep "expire date"`
- [ ] Tournoi publié et visible dans l'app
- [ ] QR codes générés et imprimés

### Jour J
- [ ] Health check OK au réveil
- [ ] Garder un terminal SSH ouvert vers le VPS
- [ ] Surveiller Sentry en continu
- [ ] Avoir le runbook accessible (bookmark / téléphone)

### Après tournoi
- [ ] Backup manuel : `./scripts/backup.sh`
- [ ] Vérifier la facturation Stripe (paiements traités)
- [ ] Archiver le tournoi si terminé
- [ ] Vérifier les logs pour erreurs silencieuses

---

## 9. Post-mortem incident

### Template
```
Date: YYYY-MM-DD HH:MM
Durée: Xmin
Impact: [utilisateurs affectés, fonctionnalités cassées]
Cause racine: [description technique]
Détection: [comment l'incident a été détecté]
Résolution: [actions prises]
Timeline: [chronologie des événements]
Actions préventives:
- [ ] Action 1
- [ ] Action 2
Leçons:
- ...
```
