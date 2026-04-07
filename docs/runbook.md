# Runbook opérationnel — Footix

## Jour de tournoi — Checklist pré-événement

```bash
# 1. Vérifier l'état de tous les services
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 2. Health check complet (DB + Redis + Celery)
curl -s https://api.footix.app/api/v1/health/full/ | python -m json.tool

# 3. Vérifier l'espace disque et la mémoire
df -h / && free -h

# 4. Vérifier les logs récents pour des erreurs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --since=1h backend | grep -i error

# 5. Vérifier que le dernier backup est récent (< 24h)
ls -la backups/ | head -5

# 6. Vérifier les tâches Celery
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend celery -A kickoff inspect active
```

---

## Incident Response

### Backend ne répond plus

```bash
# 1. Vérifier l'état
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps backend

# 2. Consulter les logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend

# 3. Redémarrer le backend uniquement
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

# 4. Si toujours KO, redémarrer tout
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### WebSocket déconnecté (scores live en panne)

```bash
# Vérifier les connexions Daphne
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 backend | grep -i websocket

# Vérifier Redis (couche channels)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec redis redis-cli ping
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec redis redis-cli info memory

# Redémarrer le backend (reconnexion auto côté client)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

### Celery worker mort (notifications bloquées)

```bash
# Vérifier l'état
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps celery-worker

# Inspecter les workers
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec celery-worker \
  celery -A kickoff inspect ping

# Redémarrer
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart celery-worker celery-beat
```

### Base de données pleine / lente

```bash
# Vérifier la taille
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U kickoff -c "SELECT pg_size_pretty(pg_database_size('kickoff'));"

# Requêtes les plus lentes (si pg_stat_statements activé)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U kickoff -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 5;"

# Kill une requête bloquée
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U kickoff -c "SELECT pg_terminate_backend(<pid>);"
```

---

## Disaster Recovery

### Restaurer un backup

```bash
# 1. Lister les backups disponibles
ls -la backups/

# 2. Vérifier l'intégrité du backup
sha256sum -c backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz.sha256

# 3. Restaurer (ATTENTION: écrase la base actuelle)
./scripts/backup.sh --restore backups/db_kickoff_YYYYMMDD_HHMMSS.sql.gz
```

### Rollback complet après deploy raté

```bash
# 1. Identifier la version précédente
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=5 backend | head

# 2. Restaurer le backup pré-deploy
ls -la backups/pre_deploy_* | tail -1
./scripts/backup.sh --restore backups/pre_deploy_XXXXXXXX_XXXXXX.sql.gz

# 3. Pull l'image précédente (remplacer SHA)
export IMAGE_TAG=<previous_sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Contacts & Escalade

| Prio | Situation | Action |
|------|-----------|--------|
| P0 | Service totalement down | Redémarrer les containers + vérifier logs |
| P0 | Perte de données | Restaurer le dernier backup + contacter l'admin |
| P1 | Scores live ne marchent plus | Redémarrer backend + vérifier Redis |
| P1 | Notifications bloquées | Redémarrer Celery worker/beat |
| P2 | Performance dégradée | Vérifier la mémoire, les logs, et les requêtes lentes |

---

## Monitoring — Points clés à surveiller

- **Sentry** : Nouvelles erreurs, taux d'erreur montant
- **Health endpoint** : `GET /api/v1/health/full/` retourne `status: ok` pour db, redis, celery
- **Espace disque** : Backups + media peuvent remplir le disque
- **Mémoire Redis** : Configuré à 128MB max avec allkeys-lru
- **Certificats SSL** : Renouvellement Let's Encrypt automatique (vérifier expiration)
