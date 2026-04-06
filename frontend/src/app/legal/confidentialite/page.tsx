import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LegalSection } from "@/components/legal/legal-section";

export const metadata = {
  title: "Politique de confidentialité — Footix",
};

export default function ConfidentialitePage() {
  return (
    <div className="relative flex justify-center min-h-full px-4 py-8 pb-safe overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="orb orb-green size-64 -top-16 -right-16 fixed" />
      <div className="orb orb-blue size-48 bottom-20 -left-12 fixed" />

      <div className="relative w-full max-w-prose space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/start"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </div>

        <div className="text-center space-y-2">
          <img
            src="/logo-footix.png"
            alt="Footix"
            className="h-12 w-auto mx-auto"
          />
          <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            <LegalSection title="1. Responsable du traitement">
              <p>
                <strong>Nom :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Adresse :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Email :</strong>{" "}
                <a href="mailto:privacy@footix.app" className="text-primary hover:underline">
                  privacy@footix.app
                </a>{" "}
                [À COMPLÉTER]
              </p>
            </LegalSection>

            <LegalSection title="2. Données collectées">
              <p>Dans le cadre de l&apos;utilisation de Footix, nous collectons les données suivantes :</p>

              <p><strong>Compte organisateur :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Email</li>
                <li>Nom d&apos;utilisateur</li>
                <li>Prénom et nom (optionnels)</li>
                <li>Téléphone (optionnel)</li>
                <li>Mot de passe (hashé, jamais stocké en clair)</li>
              </ul>

              <p><strong>Équipes :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nom de l&apos;équipe</li>
                <li>Contact du coach (nom, email, téléphone)</li>
                <li>Logo de l&apos;équipe (optionnel)</li>
                <li>Code d&apos;accès (généré automatiquement)</li>
              </ul>

              <p><strong>Matchs et tournois :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Scores des matchs</li>
                <li>Noms des buteurs (optionnels, si renseignés par l&apos;organisateur)</li>
                <li>Planning et configuration du tournoi</li>
              </ul>

              <p><strong>Paiements :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Traités via Stripe — aucune donnée de carte bancaire n&apos;est stockée sur nos serveurs</li>
                <li>Identifiant client Stripe, statut de l&apos;abonnement</li>
              </ul>

              <p><strong>Notifications push :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Endpoint de notification</li>
                <li>Clés publiques de souscription</li>
              </ul>

              <p><strong>Données techniques :</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Adresse IP</li>
                <li>User-agent du navigateur</li>
                <li>Logs d&apos;erreur (via Sentry)</li>
              </ul>
            </LegalSection>

            <LegalSection title="3. Finalités du traitement">
              <p>Les données sont collectées pour :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Fournir le service de gestion de tournois de football</li>
                <li>Gérer l&apos;authentification et la sécurité des comptes</li>
                <li>Permettre le suivi en temps réel des tournois</li>
                <li>Envoyer des notifications push (scores, rappels de matchs)</li>
                <li>Gérer les abonnements et paiements</li>
                <li>Améliorer le service et corriger les bugs</li>
              </ul>
            </LegalSection>

            <LegalSection title="4. Base légale du traitement">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Exécution du contrat</strong> (article 6.1.b du RGPD) :
                  traitement nécessaire à la fourniture du service Footix
                </li>
                <li>
                  <strong>Consentement</strong> (article 6.1.a du RGPD) :
                  notifications push, souscription aux alertes
                </li>
                <li>
                  <strong>Intérêt légitime</strong> (article 6.1.f du RGPD) :
                  sécurité du service, prévention des abus, monitoring
                  d&apos;erreurs
                </li>
              </ul>
            </LegalSection>

            <LegalSection title="5. Durée de conservation">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Compte actif :</strong> toute la durée
                  d&apos;utilisation du service
                </li>
                <li>
                  <strong>Compte inactif :</strong> 3 ans après la dernière
                  connexion, puis suppression
                </li>
                <li>
                  <strong>Tournois archivés :</strong> 5 ans après la fin du
                  tournoi
                </li>
                <li>
                  <strong>Logs techniques :</strong> 1 an
                </li>
              </ul>
            </LegalSection>

            <LegalSection title="6. Destinataires des données">
              <p>Vos données peuvent être transmises aux tiers suivants :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Hébergeur</strong> — [À COMPLÉTER] : stockage des
                  données sur nos serveurs
                </li>
                <li>
                  <strong>Stripe</strong> (États-Unis) : traitement des
                  paiements par carte bancaire
                </li>
                <li>
                  <strong>Sentry</strong> (États-Unis) : monitoring des
                  erreurs et stabilité de l&apos;application
                </li>
              </ul>
              <p>
                Aucune donnée n&apos;est vendue ou partagée à des fins
                publicitaires.
              </p>
            </LegalSection>

            <LegalSection title="7. Transferts hors Union Européenne">
              <p>
                Certains de nos sous-traitants (Stripe, Sentry) sont basés
                aux États-Unis. Ces transferts sont encadrés par des clauses
                contractuelles types approuvées par la Commission européenne
                (article 46.2.c du RGPD) et/ou par le Data Privacy Framework
                UE-États-Unis.
              </p>
            </LegalSection>

            <LegalSection title="8. Vos droits (RGPD)">
              <p>
                Conformément au Règlement Général sur la Protection des
                Données, vous disposez des droits suivants :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Droit d&apos;accès :</strong> obtenir une copie de
                  vos données personnelles
                </li>
                <li>
                  <strong>Droit de rectification :</strong> corriger des
                  données inexactes ou incomplètes
                </li>
                <li>
                  <strong>Droit à l&apos;effacement :</strong> demander la
                  suppression de vos données
                </li>
                <li>
                  <strong>Droit à la portabilité :</strong> récupérer vos
                  données dans un format structuré
                </li>
                <li>
                  <strong>Droit d&apos;opposition :</strong> vous opposer au
                  traitement de vos données
                </li>
                <li>
                  <strong>Droit à la limitation :</strong> restreindre
                  temporairement le traitement
                </li>
              </ul>
              <p>
                Pour exercer ces droits, contactez-nous à :{" "}
                <a href="mailto:privacy@footix.app" className="text-primary hover:underline">
                  privacy@footix.app
                </a>{" "}
                [À COMPLÉTER]
              </p>
              <p>
                En cas de réclamation, vous pouvez saisir la CNIL :{" "}
                <a
                  href="https://www.cnil.fr"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.cnil.fr
                </a>
              </p>
            </LegalSection>

            <LegalSection title="9. Cookies et stockage local">
              <p>
                Footix n&apos;utilise <strong>aucun cookie de tracking</strong>
                . Nous utilisons uniquement le stockage local du navigateur
                (localStorage) pour :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>L&apos;authentification (jetons JWT)</li>
                <li>Les préférences de thème (clair / sombre / système)</li>
                <li>Le cache de données hors-ligne (scores en attente)</li>
                <li>L&apos;état de l&apos;onboarding (première visite)</li>
              </ul>
              <p>
                Aucun outil d&apos;analytique tiers (Google Analytics, etc.)
                n&apos;est utilisé.
              </p>
            </LegalSection>

            <LegalSection title="10. Sécurité">
              <p>
                Nous mettons en œuvre des mesures techniques et
                organisationnelles appropriées pour protéger vos données :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Chiffrement HTTPS pour toutes les communications</li>
                <li>Mots de passe hashés (bcrypt/argon2)</li>
                <li>Authentification par jetons JWT avec expiration courte</li>
                <li>Rate limiting sur les endpoints sensibles</li>
                <li>Accès aux données restreint au strict nécessaire</li>
              </ul>
            </LegalSection>

            <LegalSection title="11. Modifications">
              <p>
                Nous nous réservons le droit de modifier cette politique de
                confidentialité à tout moment. En cas de modification
                substantielle, les utilisateurs seront informés via
                l&apos;application. La date de dernière mise à jour est
                indiquée ci-dessous.
              </p>
            </LegalSection>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground/60 text-center">
                Dernière mise à jour : avril 2026
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
