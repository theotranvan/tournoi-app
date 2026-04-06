# Backup & Restore — Documentation

## Backup automatique

Le script `scripts/backup.sh` gère les sauvegardes de la base de données PostgreSQL et des fichiers media.

### Lancer un backup manuellement

```bash
# Backup complet (DB + media)
./scripts/backup.sh

# Base de données uniquement
./scripts/backup.sh --db-only

# Fichiers media uniquement
./scripts/backup.sh --media-only
```

### Variables d'environnement

| Variable           | Défaut       | Description                          |
|--------------------|--------------|--------------------------------------|
| `POSTGRES_DB`      | `kickoff`    | Nom de la base                       |
| `POSTGRES_USER`    | `kickoff`    | Utilisateur PostgreSQL               |
| `BACKUP_DIR`       | `./backups`  | Répertoire local des sauvegardes     |
| `BACKUP_RETENTION` | `30`         | Jours de rétention des anciens dumps |
| `S3_BUCKET`        | *(vide)*     | Bucket S3 pour upload offsite        |
| `AWS_PROFILE`      | *(vide)*     | Profil AWS CLI                       |

### Backup automatique via Docker cron

En production, un service `backup` tourne dans `docker-compose.prod.yml` et exécute un backup quotidien à 3h du matin.

Les backups sont stockés dans le volume `backups_data`.

## Restauration

### Restaurer une base de données

```bash
# Depuis un fichier gzip
./scripts/backup.sh --restore backups/db_kickoff_20250101_030000.sql.gz
```

Le script demandera une confirmation avant de procéder.

### Restauration manuelle

```bash
# 1. Décompresser le dump
gunzip backups/db_kickoff_20250101_030000.sql.gz

# 2. Restaurer dans le container PostgreSQL
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres psql -U kickoff -d kickoff --single-transaction \
    < backups/db_kickoff_20250101_030000.sql
```

### Restaurer les fichiers media

```bash
# Extraire l'archive dans le volume media du backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T backend tar xzf - -C /app < backups/media_20250101_030000.tar.gz
```

## Vérification d'un backup

```bash
# Lister le contenu d'un dump DB
gunzip -c backups/db_kickoff_*.sql.gz | head -50

# Lister le contenu d'une archive media
tar tzf backups/media_*.tar.gz | head -20
```
