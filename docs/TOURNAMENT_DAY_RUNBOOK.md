# Tournament Day Runbook — Footix

## Quand utiliser ce runbook

- La veille d'un tournoi (J-1)
- Le jour du tournoi (J)
- Après le tournoi (J+1)

---

## J-1 : Checklist veille de tournoi

### Infrastructure
```bash
cd /opt/kickoff
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# 1. Tous les services UP
$COMPOSE ps
# Résultat attendu : tous les services "Up" et "healthy"

# 2. Health check complet
curl -s https://footix.app/api/v1/health/full/ | python3 -m json.tool
# Résultat attendu : {"status": "ok", "checks": {"database": true, "redis": true, "celery": true}}

# 3. Backup récent
ls -la backups/ | head -5
# Résultat attendu : backup de moins de 24h

# 4. Espace disque
df -h /
# Résultat attendu : > 2 GB libres

# 5. SSL valide
curl -vI https://footix.app 2>&1 | grep "expire date"
# Résultat attendu : date d'expiration > J+30

# 6. Pas d'erreurs récentes
$COMPOSE logs --since=24h backend | grep -c "ERROR"
# Résultat attendu : 0 ou très peu
```

### Application
- [ ] Tournoi créé et publié dans l'app
- [ ] Catégories configurées
- [ ] Équipes inscrites
- [ ] Terrains configurés
- [ ] Planning généré
- [ ] QR codes générés et imprimés (si applicable)
- [ ] URL publique du tournoi testée dans un navigateur

### Backup pré-tournoi
```bash
# Backup complet avant le tournoi
./scripts/backup.sh
./scripts/backup.sh --verify
```

---

## Jour J : Opérations

### Au réveil
```bash
# Health check rapide
curl -s https://footix.app/api/v1/health/full/ | python3 -m json.tool
bash scripts/smoke-test.sh https://footix.app
```

### Pendant le tournoi

#### Garder ouvert
- Terminal SSH vers le VPS
- Dashboard Sentry (si configuré)
- Ce runbook accessible (téléphone ou bookmark)

#### Surveillance toutes les heures
```bash
# Services OK ?
$COMPOSE ps

# Erreurs récentes ?
$COMPOSE logs --since=1h backend | grep -c "ERROR"

# Redis mémoire ?
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD info memory | grep used_memory_human
```

---

## Incidents courants jour de tournoi

### 1. Scores ne se mettent pas à jour en temps réel

**Diagnostic** :
```bash
# Vérifier Redis (couche WebSocket)
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD ping

# Vérifier les logs WebSocket
$COMPOSE logs --since=10m backend | grep -i websocket
```

**Solution** :
```bash
# Redémarrer le backend (les clients WS se reconnectent auto)
$COMPOSE restart backend
```

**Impact** : les clients reçoivent les mises à jour après reconnexion (~5s)

### 2. Erreur 500 quand on saisit un score

**Diagnostic** :
```bash
$COMPOSE logs --since=5m backend | grep -i "error\|500"
curl -s http://localhost:8000/api/v1/health/db/
curl -s http://localhost:8000/api/v1/health/redis/
```

**Solution** :
- Si DB down : `$COMPOSE restart postgres` + attendre 30s
- Si Redis down : `$COMPOSE restart redis backend`
- Si code : noter l'erreur, Sentry si configuré, rollback si critique

### 3. L'application est lente

**Diagnostic** :
```bash
# Vérifier les ressources
docker stats --no-stream

# Vérifier les connexions DB
$COMPOSE exec postgres psql -U kickoff -c "SELECT count(*) FROM pg_stat_activity;"

# Vérifier la mémoire Redis
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD info memory
```

**Solution** :
```bash
# Si Redis saturé
$COMPOSE exec redis redis-cli -a $REDIS_PASSWORD flushdb
$COMPOSE restart backend

# Si DB surchargée
$COMPOSE restart backend  # libère les connexions
```

### 4. Page blanche / 502 sur le frontend

**Diagnostic** :
```bash
$COMPOSE ps frontend
$COMPOSE logs --tail=50 frontend
$COMPOSE logs --tail=50 nginx
```

**Solution** :
```bash
$COMPOSE restart frontend
# Attendre 20s
curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
```

### 5. Perte complète du backend

**Solution d'urgence** :
```bash
# 1. Redémarrer tout
$COMPOSE down
$COMPOSE up -d

# 2. Attendre 60s pour les migrations + health checks
# 3. Vérifier
curl -s http://localhost:8000/api/v1/health/full/
```

---

## Après le tournoi (J+1)

```bash
# 1. Backup complet post-tournoi
./scripts/backup.sh

# 2. Vérifier le backup
./scripts/backup.sh --verify

# 3. Vérifier les logs pour erreurs silencieuses
$COMPOSE logs --since=24h backend | grep -c "ERROR"
$COMPOSE logs --since=24h backend | grep "ERROR" | head -20

# 4. Vérifier Stripe (paiements traités)
# → Dashboard Stripe

# 5. Archiver le tournoi si terminé
# → Dans l'application

# 6. Nettoyer les vieux containers
docker image prune -f
```

---

## Numéros d'urgence (à remplir)

| Contact | Téléphone | Rôle |
|---------|-----------|------|
| Admin technique | ... | Accès VPS + code |
| Organisateur tournoi | ... | Décisions métier |
