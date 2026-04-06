import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LegalSection } from "@/components/legal/legal-section";

export const metadata = {
  title: "Mentions légales — Footix",
};

export default function MentionsLegalesPage() {
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
          <h1 className="text-2xl font-bold">Mentions légales</h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            <LegalSection title="1. Éditeur du site">
              <p>
                <strong>Nom :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Forme juridique :</strong> [À COMPLÉTER — ex : SAS, SARL, auto-entrepreneur]
              </p>
              <p>
                <strong>Siège social :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Capital social :</strong> [À COMPLÉTER — si applicable]
              </p>
              <p>
                <strong>SIRET :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Numéro RCS :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Directeur de la publication :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Email de contact :</strong>{" "}
                <a href="mailto:contact@footix.app" className="text-primary hover:underline">
                  contact@footix.app
                </a>{" "}
                [À COMPLÉTER]
              </p>
            </LegalSection>

            <LegalSection title="2. Hébergeur">
              <p>
                <strong>Nom :</strong> [À COMPLÉTER — ex : OVH, Scaleway, Vercel]
              </p>
              <p>
                <strong>Adresse :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Téléphone :</strong> [À COMPLÉTER]
              </p>
              <p>
                <strong>Site web :</strong> [À COMPLÉTER]
              </p>
            </LegalSection>

            <LegalSection title="3. Propriété intellectuelle">
              <p>
                L&apos;ensemble des contenus présents sur le site et
                l&apos;application Footix (textes, images, logos, icônes,
                illustrations, code source) sont protégés par les lois
                relatives à la propriété intellectuelle et sont la propriété
                exclusive de l&apos;éditeur, sauf mention contraire.
              </p>
              <p>
                Toute reproduction, représentation, modification,
                distribution ou exploitation, même partielle, sans
                autorisation écrite préalable de l&apos;éditeur est
                strictement interdite.
              </p>
            </LegalSection>

            <LegalSection title="4. Responsabilité">
              <p>
                L&apos;éditeur s&apos;efforce de fournir des informations
                exactes et à jour. Toutefois, il ne saurait être tenu
                responsable des erreurs, omissions ou résultats qui
                pourraient être obtenus par un mauvais usage de ces
                informations.
              </p>
              <p>
                L&apos;utilisation du service Footix se fait aux risques et
                périls de l&apos;utilisateur. L&apos;éditeur ne pourra être
                tenu responsable des dommages directs ou indirects résultant
                de l&apos;utilisation du service.
              </p>
            </LegalSection>

            <LegalSection title="5. Données personnelles">
              <p>
                Le traitement des données personnelles est décrit dans notre{" "}
                <Link href="/legal/confidentialite" className="text-primary hover:underline">
                  Politique de confidentialité
                </Link>
                .
              </p>
            </LegalSection>

            <LegalSection title="6. Cookies et stockage local">
              <p>
                Footix n&apos;utilise pas de cookies de tracking. Seul le
                stockage local du navigateur (localStorage) est utilisé pour
                le fonctionnement de l&apos;application (authentification,
                préférences de thème, données hors-ligne).
              </p>
            </LegalSection>

            <LegalSection title="7. Droit applicable">
              <p>
                Les présentes mentions légales sont régies par le droit
                français. En cas de litige, les tribunaux français seront
                seuls compétents.
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
