# Déploiement Footix en production

## Prérequis

- VPS Linux (ex : Hetzner CX22 ~4 €/mois, ou Contabo VPS S ~6 €/mois)
- Domaine `footix.app` avec DNS pointant vers le VPS
- Compte Stripe (mode test puis live)
- Compte Sentry (free tier OK — 5k events/mois)
- Compte Resend (free tier 3k emails/mois) ou Brevo (free 300/jour)
- Compte Scaleway Object Storage (S3 médias, optionnel — 75 Go gratuits)

## Étape 1 : Préparer le VPS

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git
git clone https://github.com/theotranvan/tournoi-app.git /opt/footix
cd /opt/footix
```

## Étape 2 : Setup Stripe

Sur ta machine locale :

```bash
export STRIPE_SECRET_KEY=sk_test_xxx  # commencer en TEST
python backend/scripts/setup_stripe.py
```

Note les 3 IDs `price_*` retournés.

Va sur https://dashboard.stripe.com/test/webhooks et crée un endpoint :
- URL : `https://api.footix.app/api/v1/subscriptions/webhook/`
- Events : `checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.*`, `invoice.payment_failed`

Copie le signing secret `whsec_...`.

## Étape 3 : Configurer .env.production

Sur le VPS :

```bash
cp .env.production.example .env.production
nano .env.production
```

Renseigne :
- `SECRET_KEY` : génère avec `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `POSTGRES_PASSWORD` : un mot de passe fort (32 caractères)
- `STRIPE_*` : copiés depuis l'étape 2
- `SENTRY_DSN` : depuis sentry.io
- `EMAIL_*` : depuis Resend/Brevo
- `VAPID_*` : générer avec `python -c "from py_vapid import Vapid; v = Vapid(); v.generate_keys(); print('public:', v.public_key); print('private:', v.private_key)"`

## Étape 4 : DNS

Sur ton registrar :
- `footix.app` → A record → IP du VPS
- `api.footix.app` → A record → IP du VPS
- Attendre la propagation (~10 min)

## Étape 5 : Déploiement

```bash
chmod +x deploy.sh
./deploy.sh --build --migrate --ssl
```

Le `--ssl` lance Certbot pour obtenir un certificat Let's Encrypt automatique.

## Étape 6 : Vérification

```bash
# Healthcheck
curl https://api.footix.app/api/v1/public/health/

# Frontend
curl -I https://footix.app/

# Logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

## Étape 7 : Premier compte admin

```bash
docker compose exec backend python manage.py createsuperuser
```

## Étape 8 : Test de bout en bout

1. Aller sur https://footix.app
2. Cliquer "Créer un compte" depuis /start
3. Créer un compte avec un vrai email
4. Créer un tournoi (free plan, 16 équipes max)
5. Tester le checkout One-Shot avec une carte Stripe test : `4242 4242 4242 4242`, n'importe quel CVC, n'importe quelle date future
6. Vérifier que le tournoi devient ONE_SHOT et débloque les features
7. Vérifier dans Sentry qu'aucune erreur n'a été remontée

## Backups

Les backups DB sont automatiques via le service `backup` du docker compose (3h du matin chaque jour).

Pour upload externe (S3) :

```bash
# Ajouter dans le service backup une étape rclone vers S3
```

## Restoration

```bash
docker compose exec postgres pg_restore -U footix -d footix < /backups/footix-2026-04-08.dump
```

## Bascule en production réelle (Stripe LIVE)

1. Activer le compte Stripe LIVE (vérifier l'identité, fournir IBAN)
2. Régénérer les products/prices avec `STRIPE_SECRET_KEY=sk_live_xxx python backend/scripts/setup_stripe.py`
3. Créer un nouveau webhook sur https://dashboard.stripe.com/webhooks (LIVE mode)
4. Mettre à jour `.env.production` avec les nouvelles clés `sk_live_*` et nouveaux `price_*`
5. Redéployer : `./deploy.sh`
