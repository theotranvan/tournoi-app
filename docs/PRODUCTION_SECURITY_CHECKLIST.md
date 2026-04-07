# Production Security Checklist — Footix

## Django / Backend

- [x] `DEBUG = False` en prod (hardcodé dans `prod.py`)
- [x] `SECRET_KEY` chargé depuis variable d'environnement
- [x] `ALLOWED_HOSTS` configuré (pas `*`)
- [x] `SESSION_COOKIE_SECURE = True`
- [x] `SESSION_COOKIE_HTTPONLY = True`
- [x] `CSRF_COOKIE_SECURE = True`
- [x] `CSRF_COOKIE_HTTPONLY = True`
- [x] `SECURE_HSTS_SECONDS = 63072000` (2 ans)
- [x] `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`
- [x] `SECURE_HSTS_PRELOAD = True`
- [x] `SECURE_CONTENT_TYPE_NOSNIFF = True`
- [x] `X_FRAME_OPTIONS = "DENY"`
- [x] `SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"`
- [x] `SECURE_PROXY_SSL_HEADER` correctement configuré
- [x] `CORS_ALLOWED_ORIGINS` restreint (pas `*`)
- [x] `CSRF_TRUSTED_ORIGINS` configuré
- [x] Upload limits configurés (`FILE_UPLOAD_MAX_MEMORY_SIZE`, `DATA_UPLOAD_MAX_MEMORY_SIZE`)
- [x] Password validators actifs (4 validators Django)
- [x] Throttling API activé (anon: 100/min, user: 200/min, auth: 5/min)
- [x] JWT access token courte durée (15 min)
- [x] JWT refresh token rotation + blacklist après rotation
- [x] Sentry scrubs sensitive data (`before_send` + `send_default_pii=False`)
- [x] API docs/schema désactivés en prod (`DEBUG` gate + nginx block)
- [x] Debug endpoints désactivés en prod (`DEBUG` gate)
- [x] Structlog pour les logs

## Stripe

- [x] Webhook vérifié par signature (`stripe.Webhook.construct_event`)
- [x] Webhook idempotent (table `StripeEvent` pour déduplication)
- [x] `STRIPE_WEBHOOK_SECRET` requis (400 si absent)
- [ ] **MANUAL STEP** : Vérifier l'URL webhook dans le dashboard Stripe

## Nginx

- [x] `server_tokens off` (masquer la version nginx)
- [x] SSL TLSv1.2 + TLSv1.3 uniquement
- [x] Ciphers modernes (ECDHE-ECDSA/RSA-AES128/256-GCM-SHA256/384)
- [x] SSL session tickets désactivés
- [x] OCSP stapling activé
- [x] HTTP → HTTPS redirect
- [x] HSTS header (63072000s, includeSubDomains, preload)
- [x] CSP header strict (voir note unsafe-inline ci-dessous)
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy restrictif
- [x] Rate limiting: API 30r/s, login 5r/m, team-access 10r/m, admin 5r/m
- [x] `/api/v1/schema/` et `/api/v1/docs/` bloqués (404)
- [x] Fichiers dotfiles bloqués (`location ~ /\.`)
- [x] `client_max_body_size 10M`
- [x] Admin noindex/nofollow
- [x] WebSocket timeout 86400s

### Note CSP : `unsafe-inline`
`script-src 'unsafe-inline'` et `style-src 'unsafe-inline'` sont nécessaires car :
- Next.js injecte des scripts inline pour l'hydratation (`__NEXT_DATA__`)
- Tailwind CSS / CSS-in-JS génère des styles inline au build
- TODO : remplacer par des nonces quand Next.js supportera pleinement les nonces CSP

## Docker / Infrastructure

- [x] Backend tourne en user non-root (`appuser:1001`)
- [x] Frontend tourne en user non-root (`nextjs:1001`)
- [x] Redis protégé par mot de passe (`requirepass`)
- [x] PostgreSQL ports non exposés sur le host en prod
- [x] Redis ports non exposés sur le host en prod
- [x] Backend ports non exposés sur le host en prod (via nginx)
- [x] Resource limits sur tous les containers
- [x] Health checks sur tous les services

## Secrets

- [ ] **MANUAL STEP** : `SECRET_KEY` généré aléatoirement (50+ chars)
- [ ] **MANUAL STEP** : `POSTGRES_PASSWORD` fort et unique
- [ ] **MANUAL STEP** : `REDIS_PASSWORD` fort et unique
- [ ] **MANUAL STEP** : `DEPLOY_SSH_KEY` dans GitHub Secrets
- [ ] **MANUAL STEP** : `.env.production` sauvegardé dans un gestionnaire de secrets
- [ ] **MANUAL STEP** : Vérifier que `.env.production` est dans `.gitignore`

## Rotation des secrets

Voir `docs/runbook.md` section 6 pour les procédures de rotation.

| Secret | Fréquence recommandée |
|--------|----------------------|
| `SECRET_KEY` | Annuel (invalide les JWT) |
| `POSTGRES_PASSWORD` | Annuel |
| `REDIS_PASSWORD` | Annuel |
| `DEPLOY_SSH_KEY` | Annuel |
| `STRIPE_*` | Si compromis |
| `EMAIL_HOST_PASSWORD` | Si compromis |
