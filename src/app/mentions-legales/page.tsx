import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "@/app/_components/legal-page";
import { EDITEUR, HEBERGEUR, HEBERGEUR_BDD, REGISTRAR, SERVICE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales — MELETA",
  description:
    "Éditeur, directeur de la publication, hébergeur et propriété intellectuelle du service MELETA.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      titre="Mentions légales"
      chapeau={`Informations relatives à l'éditeur et à l'hébergeur du site ${SERVICE.domaine}, conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique.`}
      brouillon={false}
    >
      <LegalSection id="editeur" titre="1. Éditeur du site">
        <p>
          Le site {SERVICE.domaine} et le service {SERVICE.nom} sont édités par :
        </p>
        <ul>
          <li>
            <b>Dénomination sociale :</b> {EDITEUR.denomination}
          </li>
          <li>
            <b>Forme juridique :</b> {EDITEUR.formeJuridique}
          </li>
          <li>
            <b>Capital social :</b> {EDITEUR.capitalSocial}
          </li>
          <li>
            <b>Siège social :</b> {EDITEUR.adresse}
          </li>
          <li>
            <b>SIREN :</b> {EDITEUR.siren}
          </li>
          <li>
            <b>Immatriculation :</b> RCS {EDITEUR.rcs}
          </li>
          <li>
            <b>Numéro de TVA intracommunautaire :</b> {EDITEUR.tvaIntracom}
          </li>
          <li>
            <b>Téléphone :</b> {EDITEUR.telephone}
          </li>
          <li>
            <b>Email :</b>{" "}
            <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
          </li>
          <li>
            <b>Gérant :</b> {EDITEUR.gerant}
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="publication" titre="2. Directeur de la publication">
        <p>
          Le directeur de la publication est {EDITEUR.directeurPublication}, en qualité de gérant
          et représentant légal de {EDITEUR.denomination}.
        </p>
      </LegalSection>

      <LegalSection id="hebergeur" titre="3. Hébergement">
        <p>Le site est hébergé par :</p>
        <ul>
          <li>
            <b>{HEBERGEUR.nom}</b> — {HEBERGEUR.adresse} —{" "}
            <a href={HEBERGEUR.site} target="_blank" rel="noopener noreferrer">
              {HEBERGEUR.site}
            </a>
            <br />
            {HEBERGEUR.role}.
          </li>
          <li>
            <b>{HEBERGEUR_BDD.nom}</b> — {HEBERGEUR_BDD.adresse} —{" "}
            <a href={HEBERGEUR_BDD.site} target="_blank" rel="noopener noreferrer">
              {HEBERGEUR_BDD.site}
            </a>
            <br />
            {HEBERGEUR_BDD.role}. Région d&apos;hébergement : {HEBERGEUR_BDD.region}.
          </li>
        </ul>
        <p>
          Le nom de domaine {SERVICE.domaine} est enregistré auprès de {REGISTRAR.nom},{" "}
          {REGISTRAR.adresse}.
        </p>
      </LegalSection>

      <LegalSection id="propriete" titre="4. Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments composant le site — structure, textes, contenus
          pédagogiques, référentiels de compétences, scénarios cliniques, grilles
          d&apos;évaluation, marques, logos, chartes graphiques et développements logiciels —
          est la propriété exclusive de {EDITEUR.denomination} ou fait l&apos;objet d&apos;une
          autorisation d&apos;usage, et est protégé par le code de la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, adaptation ou exploitation, totale ou partielle,
          par quelque procédé que ce soit, sans l&apos;autorisation écrite préalable de
          l&apos;éditeur, est interdite. L&apos;accès au service confère un droit d&apos;usage
          personnel et non exclusif, dans les conditions prévues par les{" "}
          <Link href="/cgv-cgu">conditions générales</Link>.
        </p>
        <p>
          Les référentiels de compétences, grilles d&apos;évaluation et scénarios cliniques
          proposés par le Service ne sont pas issus de sources externes soumises à une licence
          tierce : ils sont créés en propre par {EDITEUR.denomination}, le cas échéant avec le
          concours de sous-traitants intervenant pour son compte, et lui appartiennent en
          totalité.
        </p>
      </LegalSection>

      <LegalSection id="donnees" titre="5. Données personnelles et cookies">
        <p>
          Le traitement des données personnelles et l&apos;usage des cookies sont décrits dans
          la <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection id="responsabilite" titre="6. Nature du service et responsabilité">
        <p>
          {SERVICE.nom} est un <b>outil formatif, non certifiant</b>. Il propose des exercices
          et des mises en situation avec des patients simulés par intelligence artificielle, à
          partir de cas <b>fictifs</b>. Il ne délivre aucun diplôme, aucune certification et
          aucune attestation de compétence opposable.
        </p>
        <p>
          Le service complète la formation et la supervision humaines ; il ne s&apos;y substitue
          pas. Il ne constitue en aucun cas un avis médical, un acte de soin, ni un outil d&apos;aide
          à la décision clinique auprès de patients réels. Les retours et scores produits par le
          service sont des indications pédagogiques et ne valent pas évaluation officielle.
        </p>
        <p>
          Les contenus générés par les modèles d&apos;intelligence artificielle peuvent comporter
          des imprécisions. L&apos;utilisateur conserve la responsabilité de sa pratique
          professionnelle et de l&apos;usage qu&apos;il fait des contenus du service.
        </p>
      </LegalSection>

      <LegalSection id="contact" titre="7. Nous contacter">
        <p>
          Pour toute question relative au site ou à ces mentions :{" "}
          <Link href="/contact">page contact</Link> ou{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
