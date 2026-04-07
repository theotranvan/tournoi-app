# Backup & Restore — Documentation

## Stratégie de sauvegarde

| Composant | Méthode | Fréquence | Rétention | Offsite |
|-----------|---------|-----------|-----------|---------|
| Base de données | pg_dump → gzip + SHA256 | Daily 3h UTC + pré-deploy | 30 jours | S3 si configuré |
| Fichiers media | tar.gz + SHA256 | Daily 3h UTC | 30 jours | S3 si configuré |
| Configuration | `.env.production` | Manuel | Permanent | À sauvegarder hors serveur |

### RPO / RTO
- **RPO** (perte de données max) : 24h
- **RTO** (temps de reprise) : ~15 min

## Backup automatique

Le service `backup` dans `docker-compose.prod.yml` exécute chaque jour à 3h UTC :
1. `pg_dump` compressé + checksum SHA256 + test `gunzip -t`
2. `tar` des fichiers media + checksum SHA256
3. Upload S3 si `S3_BUCKET` est configuré
4. Rotation (suppression des backups > `BACKUP_RETENTION` jours)
5. Log d'exécution dans `/backups/backup_YYYYMMDD.log`

## Backup manuel

```bash
# Backup complet (DB + media + S3 offsite)
./scripts/backup.sh

# Base de données uniquement
./scripts/backup.sh --db-only

# Fichiers media uniquement
./scripts/backup.sh --media-only
```

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `POSTGRES_DB` | `kickoff` | Nom de la base |
| `POSTGRES_USER` | `kickoff` | Utilisateur PostgreSQL |
| `BACKUP_DIR` | `./backups` | Répertoire local des sauvegardes |
| `BACKUP_RETENTION` | `30` | Jours de rétention |
| `S3_BUCKET` | *(vide)* | Bucket S3 pour upload offsite |
| `AWS_ACCESS_KEY_ID` | *(vide)* | Credentials S3 |
| `AWS_SECRET_ACCESS_KEY` | *(vide)* | Credentials S3 |
| `AWS_S3_ENDPOINT_URL` | *(vide)* | Endpoint S3 non-AWS (Scaleway, etc.) |
| `AWS_PROFILE` | *(vide)* | Profil AWS CLI (alternatif) |

## Vérification des backups

```bash
# Vérifier l'intégrité de tous les backups récents
./scripts/backup.sh --verify

# Test de restauration non-destructif (vérifie structure sans restaurer)
./scripts/backup.sh --test-restore

# Vérification manuelle d'un backup
sha256sum -c backups/db_kickoff_YYYYMMDD.sql.gz.sha256
gunzip -t backups/db_kickoff_YYYYMMDD.sql.gz
```

## Restauration

### Restaurer la base de données

```bash
# Interactif avec vérification checksums
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD.sql.gz
```

### Restaurer les fichiers media

```bash
./scripts/backup.sh --restore-media backups/media_YYYYMMDD.tar.gz
```

### Restauration depuis S3 (offsite)

```bash
# Lister les backups disponibles
aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $AWS_S3_ENDPOINT_URL

# Télécharger un backup
aws s3 cp s3://$S3_BUCKET/backups/YYYYMMDD_HHMMSS/ ./backups/ --recursive \
    --endpoint-url $AWS_S3_ENDPOINT_URL

# Restaurer
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD.sql.gz
./scripts/backup.sh --restore-media backups/media_YYYYMMDD.tar.gz
```

### Restauration manuelle

```bash
# DB
gunzip -c backups/db_kickoff_YYYYMMDD.sql.gz | \
    docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres psql -U kickoff -d kickoff --single-transaction

# Media
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T backend tar xzf - -C /app < backups/media_YYYYMMDD.tar.gz
```

## Validation post-restauration

```bash
# Santé globale
curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool

# Vérifier les tables
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres psql -U kickoff -d kickoff -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Vérifier les tournois
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres psql -U kickoff -d kickoff -c \
    "SELECT count(*) FROM tournaments_tournament;"
```
