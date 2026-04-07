# Backup & Restore Runbook — Footix

## Vue d'ensemble

| Paramètre | Valeur |
|-----------|--------|
| **RPO** (perte max) | 24h (backup daily 3h UTC) |
| **RTO** (temps reprise) | ~15 min (restore DB + media + restart) |
| **Rétention locale** | 30 jours (configurable `BACKUP_RETENTION`) |
| **Offsite** | S3-compatible si `S3_BUCKET` configuré |
| **Pré-deploy** | Automatique à chaque deploy (CI + deploy.sh) |

---

## 1. Backups automatiques

### Cron Docker (daily)
Le service `backup` dans `docker-compose.prod.yml` exécute un backup complet à **3h UTC** :
- DB : `pg_dump` → gzip → checksum SHA256 → integrity check
- Media : tar.gz du volume media
- Offsite : upload S3 si configuré
- Rotation : suppression après `BACKUP_RETENTION` jours

### Pré-deploy
Chaque déploiement (CI et `deploy.sh`) crée un backup dans `backups/pre_deploy_*.sql.gz`.

---

## 2. Backup manuel

```bash
cd /opt/kickoff

# Full (DB + media + S3 offsite + rotation)
./scripts/backup.sh

# DB seulement
./scripts/backup.sh --db-only

# Media seulement
./scripts/backup.sh --media-only
```

---

## 3. Vérification des backups

```bash
# Vérifier l'intégrité de tous les backups locaux
./scripts/backup.sh --verify

# Test de restauration non-destructif
./scripts/backup.sh --test-restore

# Vérifier un backup individuel
sha256sum -c backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz.sha256
gunzip -t backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz
```

---

## 4. Restauration DB

### Restaurer le dernier backup
```bash
# 1. Lister les backups disponibles
ls -la backups/db_*.sql.gz

# 2. Vérifier l'intégrité
./scripts/backup.sh --verify

# 3. Restaurer (confirmation interactive)
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz

# 4. Valider
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$COMPOSE exec backend python manage.py check
curl -s http://localhost:8000/api/v1/health/full/ | python3 -m json.tool
```

### Restaurer depuis S3 (offsite)
```bash
# 1. Lister les backups S3
aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $AWS_S3_ENDPOINT_URL

# 2. Télécharger
aws s3 cp s3://$S3_BUCKET/backups/YYYYMMDD_HHMMSS/ ./backups/ \
  --recursive --endpoint-url $AWS_S3_ENDPOINT_URL

# 3. Vérifier et restaurer
./scripts/backup.sh --verify
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz
```

---

## 5. Restauration Media

```bash
./scripts/backup.sh --restore-media backups/media_YYYYMMDD_HHMMSS.tar.gz
```

---

## 6. Symptômes nécessitant une restauration

| Symptôme | Action |
|----------|--------|
| Données corrompues après migration | Rollback image + restore DB pré-deploy |
| Suppression accidentelle de données | Restore du dernier backup DB |
| Perte de fichiers media | Restore media backup |
| Serveur perdu | Voir DISASTER_RECOVERY_RUNBOOK.md |

---

## 7. Monitoring des backups

### Vérifier que les backups fonctionnent
```bash
# Dernier backup local
ls -lt backups/ | head -5

# Logs du service backup Docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backup --tail=50

# Dernier backup S3
aws s3 ls s3://$S3_BUCKET/backups/ --endpoint-url $AWS_S3_ENDPOINT_URL | tail -5
```

### Alerte recommandée
Configurer une vérification hebdomadaire :
```bash
# Ajouter au crontab du VPS
0 9 * * 1 cd /opt/kickoff && ./scripts/backup.sh --verify >> /var/log/backup-verify.log 2>&1
```

---

## 8. Pièges à éviter

- **Ne pas restaurer sans vérifier l'intégrité** (`--verify` d'abord)
- **Ne pas restaurer une DB avec des migrations manquantes** (l'ancienne DB + nouvelle app = crash)
- **Ne pas oublier de restaurer les media** si des fichiers uploadés sont référencés en DB
- **Ne pas supprimer les backups pré-deploy** tant que la nouvelle version n'est pas stable
- **Toujours faire un backup avant de restaurer** (pour pouvoir revenir en arrière)
