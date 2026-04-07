# Rollback Runbook — Footix

## Quand utiliser ce runbook

- Health check échoue après un deploy
- Erreurs 500 massives détectées après deploy
- Fonctionnalité critique cassée après deploy
- Rollback automatique CI a échoué

---

## 1. Rollback rapide (image seule)

### Prérequis
- Connaître le SHA de la version précédente qui fonctionnait

### Trouver le SHA précédent
```bash
cd /opt/kickoff

# Version actuellement déployée
cat .deployed_sha

# Version précédente (sauvée automatiquement par deploy.sh)
cat .deployed_sha.prev

# Ou dans l'historique git
git log --oneline -10
```

### Exécuter le rollback
```bash
./scripts/rollback.sh <SHA_PRECEDENT>
```

Le script va :
1. Demander confirmation
2. Puller les images SHA-tagged depuis GHCR
3. Redémarrer les services avec les anciennes images
4. Vérifier le health check
5. Sauver le nouveau SHA dans `.deployed_sha`

### Vérification post-rollback
```bash
cat .deployed_sha
curl -s http://localhost:8000/api/v1/health/full/ | python3 -m json.tool
bash scripts/smoke-test.sh http://localhost
```

---

## 2. Rollback avec restauration DB

### Quand
- Une migration destructive a été appliquée (colonne supprimée, données modifiées)
- Les données sont corrompues après le deploy

### Procédure
```bash
# Rollback image + restore du backup pré-deploy
./scripts/rollback.sh <SHA_PRECEDENT> --restore-db
```

Le script va :
1. Trouver le backup pré-deploy le plus récent dans `backups/`
2. Restaurer la DB depuis ce backup
3. Puller et déployer les images de l'ancien SHA

### Vérification
```bash
# Vérifier que les données sont cohérentes
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python manage.py check
curl -s http://localhost:8000/api/v1/health/db/
```

---

## 3. Rollback automatique (CI)

Le workflow `deploy.yml` effectue automatiquement un rollback si :
- Le health check échoue après 6 tentatives (60 secondes)
- Il lit le SHA précédent depuis `.deployed_sha`

Si le rollback auto échoue aussi, un rollback manuel est nécessaire.

---

## 4. Diagnostic

### Le rollback lui-même échoue

```bash
# Vérifier que l'image existe dans GHCR
docker pull ghcr.io/theotranvan/tournoi-app/backend:<SHA>

# Si l'image n'existe pas, build localement
git checkout <SHA>
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Le rollback réussit mais l'app reste cassée

1. Vérifier les migrations : une migration irréversible peut empêcher l'ancienne version de fonctionner
2. Vérifier Redis : flush si nécessaire `docker compose exec redis redis-cli -a $REDIS_PASSWORD flushdb`
3. Vérifier les variables d'environnement : un changement dans `.env.production` peut affecter l'ancienne version

---

## Pièges à éviter

- **Ne pas rollback sans vérifier les migrations** : si la nouvelle version a supprimé une colonne, l'ancienne version attend cette colonne
- **Ne pas supprimer `.deployed_sha`** : c'est le seul moyen de savoir quelle version tourne
- **Ne pas restaurer un backup DB sans rollback de l'image** : incompatibilité migration/schéma
- **Ne jamais `git reset --hard` sur le serveur** : ça ne change pas les images Docker déployées
