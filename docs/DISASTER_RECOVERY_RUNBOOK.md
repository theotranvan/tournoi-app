# Disaster Recovery Runbook — Footix

## Quand utiliser ce runbook

- Serveur VPS inaccessible / détruit
- Corruption complète du disque
- Provider cloud en panne prolongée
- Besoin de migrer vers un nouveau serveur

---

## Prérequis pour la reprise

| Élément | Localisation | Criticité |
|---------|-------------|-----------|
| Code source | GitHub `theotranvan/tournoi-app` | CRITIQUE |
| `.env.production` | Sauvegardé hors serveur (gestionnaire de mots de passe) | CRITIQUE |
| Backup DB | S3 offsite (`s3://$S3_BUCKET/backups/`) | CRITIQUE |
| Backup media | S3 offsite | IMPORTANT |
| Images Docker | GHCR (`ghcr.io/theotranvan/tournoi-app/*`) | IMPORTANT |
| Certificat SSL | Regénérable via Let's Encrypt | AUTOMATIQUE |
| DNS | Registrar (modifier l'IP si nouveau serveur) | MANUEL |

---

## Procédure de reprise complète

### Temps estimé : 15-30 minutes (hors provisioning VPS et DNS)

### Étape 1 — Provisionner un nouveau serveur

```bash
# Ubuntu 22.04+ ou Debian 12+ recommandé
# Installer Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Étape 2 — Cloner le repo

```bash
git clone https://github.com/theotranvan/tournoi-app.git /opt/kickoff
cd /opt/kickoff
```

### Étape 3 — Restaurer la configuration

```bash
# Depuis votre gestionnaire de secrets / copie sécurisée
cp /path/to/.env.production .env.production

# Vérifier
cat .env.production | grep -E "^(SECRET_KEY|DATABASE_URL|STRIPE)" | head -5
```

### Étape 4 — Récupérer les backups depuis S3

```bash
mkdir -p backups

# Installer aws-cli si nécessaire
apt-get install -y awscli

# Configurer les credentials
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=fr-par
export S3_ENDPOINT=https://s3.fr-par.scw.cloud
export S3_BUCKET=footix-backups

# Lister les backups disponibles
aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $S3_ENDPOINT

# Télécharger le plus récent
LATEST=$(aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $S3_ENDPOINT | sort | tail -1 | awk '{print $NF}')
aws s3 cp s3://$S3_BUCKET/backups/$LATEST ./backups/ --recursive --endpoint-url $S3_ENDPOINT
```

### Étape 5 — Déployer l'application

```bash
# Option A : utiliser les images GHCR (recommandé)
# Trouver le dernier SHA déployé
git log --oneline -5
export IMAGE_TAG=<sha_du_dernier_deploy_connu>
./deploy.sh --image-tag $IMAGE_TAG

# Option B : build local (si GHCR inaccessible)
./deploy.sh --build --migrate --ssl
```

### Étape 6 — Restaurer la base de données

```bash
# Vérifier l'intégrité du backup
./scripts/backup.sh --verify

# Restaurer
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz
```

### Étape 7 — Restaurer les media

```bash
./scripts/backup.sh --restore-media backups/media_YYYYMMDD_HHMMSS.tar.gz
```

### Étape 8 — SSL (si nouveau domaine/IP)

```bash
./deploy.sh --ssl
```

### Étape 9 — DNS

1. Aller sur le registrar (ex: OVH, Cloudflare)
2. Pointer le record A de `footix.app` vers la nouvelle IP
3. Pointer le record A de `api.footix.app` vers la nouvelle IP
4. TTL : 300 secondes pendant la migration, puis 3600 après stabilisation

### Étape 10 — Vérification complète

```bash
# Health check
curl -s https://footix.app/api/v1/health/full/ | python3 -m json.tool

# Smoke test
bash scripts/smoke-test.sh https://footix.app

# Vérifier les données
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python manage.py shell -c "
from apps.tournaments.models import Tournament
print(f'Tournaments: {Tournament.objects.count()}')
from apps.accounts.models import User
print(f'Users: {User.objects.count()}')
"
```

---

## Perte partielle (un seul service)

### PostgreSQL
```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$COMPOSE restart postgres
# Attendre 30s
$COMPOSE exec postgres pg_isready -U kickoff
# Si données perdues → restore depuis backup
```

### Redis
```bash
$COMPOSE restart redis
$COMPOSE restart backend celery-worker celery-beat
# Redis est un cache : la perte de données Redis n'est pas critique
```

### Volumes Docker corrompus
```bash
# ATTENTION : supprime les données du volume
docker volume rm tournoi-app_postgres_data
$COMPOSE up -d postgres
# Puis restaurer depuis backup
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz
```

---

## Contacts d'urgence

| Service | Dashboard | Support |
|---------|-----------|---------|
| VPS | (provider dashboard URL) | (support URL) |
| DNS/Domain | (registrar dashboard) | (registrar support) |
| GHCR | github.com/theotranvan/tournoi-app/pkgs | GitHub Support |
| Stripe | dashboard.stripe.com | stripe.com/support |
| S3/Backups | (provider dashboard) | (provider support) |
| Sentry | sentry.io | - |
| Email | (Resend dashboard) | resend.com/support |

---

## Pièges à éviter

- **Ne pas paniquer** : suivre ce runbook étape par étape
- **Ne pas oublier le DNS** : même si l'app tourne, les utilisateurs ne la verront pas
- **Ne pas oublier le webhook Stripe** : changer l'URL webhook dans le dashboard Stripe si le domaine change
- **Ne pas restaurer un backup vieux de plusieurs jours sans prévenir** : perte de données entre le backup et maintenant
- **Toujours vérifier que le backup est fonctionnel AVANT de supprimer l'ancien serveur**
