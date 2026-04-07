# Incident Response Runbook — Footix

## Processus général

1. **Détecter** — Alert Sentry, monitoring, utilisateur
2. **Diagnostiquer** — Identifier le composant en panne
3. **Contenir** — Limiter l'impact (rollback, restart)
4. **Résoudre** — Fix définitif
5. **Valider** — Health checks + smoke tests
6. **Documenter** — Post-mortem

---

## Arbre de diagnostic rapide

```
L'app ne répond plus
├── curl https://footix.app → timeout ?
│   ├── OUI → DNS ou VPS down → Section "Serveur inaccessible"
│   └── NON → Continuer
├── curl → 502/503 ?
│   ├── OUI → Nginx OK, backend down → Section "Backend down"
│   └── NON → Continuer
├── curl → 500 ?
│   ├── OUI → Bug code ou service dépendant → Section "Erreurs 500"
│   └── NON → Continuer
├── Lenteur généralisée ?
│   └── OUI → Section "Performance dégradée"
└── Fonctionnalité spécifique cassée ?
    └── OUI → Section "Incident par composant"
```

---

## Incidents par composant

### Serveur inaccessible

**Symptômes** : timeout sur toutes les URLs, SSH impossible

**Actions** :
1. Vérifier le statut du VPS chez le provider
2. Si VPS mort → Disaster Recovery (`docs/DISASTER_RECOVERY_RUNBOOK.md`)
3. Si réseau → contacter le provider

### Backend down (502/503)

**Diagnostic** :
```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$COMPOSE ps backend
$COMPOSE logs --tail=100 backend
```

**Actions** :
```bash
# Tentative 1 : restart
$COMPOSE restart backend

# Tentative 2 : down + up
$COMPOSE stop backend && $COMPOSE up -d backend

# Tentative 3 : vérifier les dépendances
$COMPOSE exec postgres pg_isready -U kickoff
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD ping

# Tentative 4 : rollback si deploy récent
./scripts/rollback.sh $(cat .deployed_sha.prev)
```

### Erreurs 500 massives

**Diagnostic** :
```bash
# Volume d'erreurs
$COMPOSE logs --since=15m backend | grep -c "ERROR"

# Type d'erreurs
$COMPOSE logs --since=15m backend | grep "ERROR" | head -20

# Health check composants
curl -s http://localhost:8000/api/v1/health/db/
curl -s http://localhost:8000/api/v1/health/redis/
curl -s http://localhost:8000/api/v1/health/celery/
```

**Actions selon la cause** :
| Cause | Action |
|-------|--------|
| DB down | `$COMPOSE restart postgres` |
| Redis down | `$COMPOSE restart redis backend celery-worker celery-beat` |
| Bug code | Rollback (`./scripts/rollback.sh <sha>`) |
| Migration cassée | Rollback + restore DB (`./scripts/rollback.sh <sha> --restore-db`) |

### Performance dégradée

**Diagnostic** :
```bash
# Ressources containers
docker stats --no-stream

# Connexions DB
$COMPOSE exec postgres psql -U kickoff -c "SELECT count(*) FROM pg_stat_activity;"

# Mémoire Redis
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD info memory

# Disque
df -h /
```

**Actions** :
```bash
# Libérer Redis
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD flushdb
$COMPOSE restart backend

# Libérer disque
docker image prune -af
find backups/ -name "*.gz" -mtime +7 -delete
```

### WebSocket / temps réel en panne

**Diagnostic** :
```bash
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD ping
$COMPOSE logs --tail=50 backend | grep -i websocket
```

**Actions** :
```bash
$COMPOSE restart backend
# Les clients se reconnectent automatiquement
```

### Stripe webhook en erreur

**Symptômes** : paiements acceptés mais licences non activées

**Diagnostic** :
```bash
$COMPOSE logs --since=1h backend | grep -i "stripe\|webhook"
```

**Actions** :
1. Vérifier `STRIPE_WEBHOOK_SECRET` dans `.env.production`
2. Vérifier l'URL webhook dans le dashboard Stripe
3. Re-envoyer l'événement depuis le dashboard Stripe
4. Si licence non créée, activer manuellement :
```bash
$COMPOSE exec backend python manage.py shell -c "
from apps.subscriptions.models import TournamentLicense
TournamentLicense.objects.filter(tournament_id='XXX').update(is_active=True)
"
```

### Email transactionnel en panne

**Diagnostic** :
```bash
$COMPOSE logs --since=1h backend | grep -i email
```

**Actions** :
```bash
# Test d'envoi
$COMPOSE exec backend python -c "
from django.core.mail import send_mail
send_mail('Test Footix', 'Test body', None, ['admin@footix.app'])
print('Sent!')
"
```
Si erreur SMTP → vérifier credentials dans `.env.production` et le dashboard du provider (Resend)

### Saturation disque

**Diagnostic** :
```bash
df -h /
du -sh backups/ /var/lib/docker/
docker system df
```

**Actions** :
```bash
# 1. Nettoyer vieux backups
find backups/ -name "*.gz" -mtime +7 -delete

# 2. Nettoyer Docker
docker image prune -af
docker volume prune -f

# 3. Tronquer les logs Docker
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

## Validation post-incident

```bash
# Health check complet
curl -s http://localhost:8000/api/v1/health/full/ | python3 -m json.tool

# Smoke test
bash scripts/smoke-test.sh http://localhost

# Vérifier les erreurs
$COMPOSE logs --since=5m backend | grep -c "ERROR"

# Version déployée
cat .deployed_sha
curl -s http://localhost:8000/api/v1/health/ | python3 -m json.tool
```

---

## Template post-mortem

```
Date: YYYY-MM-DD HH:MM
Durée de l'incident: Xmin
Impact: [utilisateurs affectés, fonctionnalités cassées]
Cause racine: [description technique]
Détection: [comment l'incident a été détecté]
Résolution: [actions prises]
Timeline:
  HH:MM - Détection
  HH:MM - Diagnostic
  HH:MM - Action corrective
  HH:MM - Résolution confirmée
Actions préventives:
- [ ] Action 1
- [ ] Action 2
Leçons:
- ...
```
