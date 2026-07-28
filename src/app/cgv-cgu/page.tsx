import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, ToFill } from "@/app/_components/legal-page";
import { EDITEUR, SERVICE } from "@/lib/legal";
import { CREDIT_PACKS } from "@/lib/credits";
import { usageSettings } from "@/lib/usage-limits";

// Les plafonds d'usage loyal sont paramétrables en base : la page lit les valeurs
// réellement appliquées, jamais des valeurs recopiées à la main.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions générales de vente et d'utilisation — MELETA",
  description:
    "Conditions générales de vente et d'utilisation de MELETA : abonnements, packs de crédits, résiliation, droit de rétractation.",
};

export default async function CgvCguPage() {
  const limits = await usageSettings();

  return (
    <LegalPage
      titre="Conditions générales de vente et d'utilisation"
      chapeau={`Les présentes conditions régissent l'accès et l'utilisation du service ${SERVICE.nom}, édité par ${EDITEUR.denomination}, ainsi que les abonnements et packs de crédits souscrits sur ${SERVICE.domaine}.`}
    >
      <LegalSection id="objet" titre="1. Objet et acceptation">
        <p>
          Les présentes conditions générales de vente et d&apos;utilisation (les « Conditions »)
          définissent les modalités d&apos;accès et d&apos;utilisation du service {SERVICE.nom}
          (le « Service »), ainsi que les conditions de vente des abonnements et des packs de
          crédits.
        </p>
        <p>
          La création d&apos;un compte et toute commande valent acceptation pleine et entière
          des Conditions en vigueur à cette date. Elles complètent les{" "}
          <Link href="/mentions-legales">mentions légales</Link> et la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection id="service" titre="2. Description du service">
        <p>
          {SERVICE.nom} est une plateforme d&apos;entraînement à la relation clinique. Elle
          propose trois types d&apos;activités : des exercices ciblés, des mini-scènes et des
          entretiens complets avec un patient simulé par intelligence artificielle, assortis
          d&apos;un suivi de progression par compétence.
        </p>
        <p>
          <b>
            Le Service est un outil formatif et non certifiant. Il ne délivre aucun diplôme,
            aucune certification, ni aucune attestation de compétence opposable.
          </b>{" "}
          Les cas cliniques sont fictifs. Le Service complète la formation et la supervision
          humaines sans s&apos;y substituer, et ne constitue ni un avis médical, ni un outil
          d&apos;aide à la décision clinique auprès de patients réels.
        </p>
        <p>
          Les réponses du patient simulé et les évaluations sont produites par des modèles
          d&apos;intelligence artificielle et peuvent comporter des imprécisions. L&apos;éditeur
          ne garantit ni l&apos;exactitude clinique de chaque réponse générée, ni un résultat
          pédagogique déterminé.
        </p>
      </LegalSection>

      <LegalSection id="compte" titre="3. Compte utilisateur">
        <p>
          L&apos;accès au Service suppose la création d&apos;un compte personnel, avec une
          adresse email valide. Le compte est strictement personnel : le partage
          d&apos;identifiants et l&apos;usage par un tiers sont interdits. L&apos;utilisateur est
          responsable de la confidentialité de ses moyens d&apos;accès et de toute activité
          réalisée depuis son compte.
        </p>
        <p>
          <ToFill>
            [À COMPLÉTER PAR JULIEN — préciser les conditions d&apos;éligibilité : âge minimum,
            qualité requise (étudiant, professionnel de santé, tout public), et si un contrôle
            est effectué.]
          </ToFill>
        </p>
        <p>
          L&apos;utilisateur peut demander la suppression de son compte à tout moment à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>. La suppression entraîne la
          perte définitive de la progression, de l&apos;historique et des crédits non consommés,
          sous réserve des durées de conservation légales décrites dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection id="offres" titre="4. Offres, prix et disponibilité">
        <p>Le Service est proposé selon trois modalités :</p>
        <ul>
          <li>
            <b>Compte gratuit</b> — accès au socle clinique et à une spécialité au choix,
            exercices illimités, avec une dotation de crédits offerts à l&apos;inscription puis
            renouvelée chaque mois. Aucune carte bancaire n&apos;est demandée.
          </li>
          <li>
            <b>Abonnement mensuel</b> — renouvelle chaque mois une allocation de crédits et
            ouvre le socle ainsi qu&apos;un nombre de spécialités variable selon le niveau
            souscrit. Sans engagement de durée.
          </li>
          <li>
            <b>Pack de crédits</b> — achat unique, sans abonnement. Les packs actuellement
            proposés comptent {CREDIT_PACKS.map((p) => p.credits).join(", ")} crédits. Un pack
            n&apos;ouvre aucune spécialité : il ajoute uniquement du volume de mises en
            situation.
          </li>
        </ul>
        <p>
          Les prix applicables sont ceux affichés sur la page{" "}
          <Link href="/tarifs">Tarifs</Link> au moment de la commande. {EDITEUR.denomination}{" "}
          étant assujettie à la TVA, les prix sont indiqués <b>toutes taxes comprises</b>, au
          taux de TVA en vigueur applicable au consommateur. L&apos;éditeur peut modifier ses
          prix à tout moment ; le prix appliqué à une commande est celui en vigueur lors de sa
          validation, et une modification tarifaire affectant un abonnement en cours est
          notifiée dans les conditions prévues à l&apos;article&nbsp;11.
        </p>
        <p>
          L&apos;offre de spécialités s&apos;enrichit régulièrement. L&apos;éditeur ne garantit
          pas le maintien permanent d&apos;un contenu particulier au catalogue ; le retrait
          d&apos;une spécialité déjà ouverte à un abonné fait l&apos;objet d&apos;une information
          préalable.
        </p>
      </LegalSection>

      <LegalSection id="commande" titre="5. Commande et paiement">
        <p>
          Les paiements sont opérés par notre prestataire <b>Stripe Payments Europe, Ltd.</b>{" "}
          via une page de paiement sécurisée. {EDITEUR.denomination} n&apos;a jamais accès aux
          données de carte bancaire, qui ne transitent ni ne sont stockées sur ses serveurs.
        </p>
        <p>
          La commande est ferme dès la validation du paiement. Un reçu est adressé
          automatiquement par email par Stripe pour chaque paiement, abonnement comme pack.
        </p>
        <p>
          En cas d&apos;échec de prélèvement d&apos;une échéance d&apos;abonnement, l&apos;accès
          aux fonctionnalités payantes peut être suspendu jusqu&apos;à régularisation.
        </p>
      </LegalSection>

      <LegalSection id="credits" titre="6. Fonctionnement des crédits">
        <p>
          Un crédit est consommé à chaque mise en situation avec un patient simulé. Les
          exercices sont gratuits et illimités sur les spécialités accessibles. Le nombre de
          crédits consommés par type d&apos;activité est indiqué dans l&apos;application.
        </p>
        <ul>
          <li>
            <b>Crédits d&apos;abonnement</b> — allocation de la période en cours. Ils sont remis
            à leur valeur à chaque nouvelle période et <b>ne sont pas reportés</b> d&apos;une
            période sur l&apos;autre. Ils reviennent à zéro à la fin de l&apos;abonnement.
          </li>
          <li>
            <b>Crédits achetés en pack</b> — ils s&apos;ajoutent au solde permanent, <b>ne
            périment pas</b> et restent acquis même après la fin d&apos;un abonnement.
          </li>
          <li>
            Lors d&apos;une mise en situation, les crédits d&apos;abonnement sont débités en
            priorité, afin de ne jamais consommer un crédit acheté tant qu&apos;il reste de
            l&apos;allocation en cours.
          </li>
        </ul>
        <p>
          Les crédits n&apos;ont pas de valeur monétaire, ne sont ni cessibles, ni échangeables,
          ni remboursables en numéraire en dehors des cas prévus à l&apos;article&nbsp;8.
        </p>
      </LegalSection>

      <LegalSection id="duree" titre="7. Durée, reconduction et résiliation">
        <p>
          L&apos;abonnement est souscrit pour une durée d&apos;un mois, <b>reconduit
          automatiquement</b> à chaque échéance, sans engagement de durée minimale.
        </p>
        <p>
          <b>Résiliation par l&apos;utilisateur.</b> La résiliation s&apos;effectue à tout
          moment, en quelques clics depuis l&apos;espace « Gérer mon abonnement », sans
          justification ni préavis, conformément à l&apos;article L215-1-1 du code de la
          consommation. Elle prend effet à la fin de la période en cours : l&apos;accès et
          l&apos;allocation de crédits sont conservés jusqu&apos;à cette échéance, et aucun
          nouveau prélèvement n&apos;intervient ensuite.
        </p>
        <p>
          <b>Résiliation par l&apos;éditeur.</b> L&apos;éditeur peut suspendre ou résilier un
          compte en cas de manquement grave aux présentes Conditions — notamment usage
          frauduleux, partage de compte, contournement des garde-fous d&apos;usage loyal, ou
          atteinte à la sécurité du Service. Sauf manquement rendant impossible le maintien de
          la relation, la suspension est précédée d&apos;une mise en demeure restée sans effet
          sous quinze jours. Les sommes correspondant à une période payée et non utilisée du
          fait d&apos;une résiliation non fautive sont remboursées au prorata.
        </p>
      </LegalSection>

      <LegalSection id="retractation" titre="8. Droit de rétractation">
        <p>
          Conformément à l&apos;article L221-18 du code de la consommation, le consommateur
          dispose d&apos;un délai de <b>quatorze jours</b> à compter de la conclusion du contrat
          pour exercer son droit de rétractation, sans avoir à motiver sa décision ni à
          supporter de pénalité.
        </p>
        <p>
          <b>Exécution immédiate et remboursement au prorata.</b> En validant sa commande,
          l&apos;utilisateur demande expressément que l&apos;exécution du Service commence
          immédiatement, avant l&apos;expiration du délai de rétractation. Il conserve son droit
          de rétractation. S&apos;il l&apos;exerce, il est redevable, conformément à
          l&apos;article L221-25 du code de la consommation, d&apos;un montant proportionnel à
          ce qui a été fourni jusqu&apos;à la communication de sa décision. En pratique :
        </p>
        <ul>
          <li>
            <b>Abonnement</b> — remboursement du montant versé, déduction faite de la part
            correspondant aux jours écoulés depuis le début de la période et des crédits
            consommés au-delà de l&apos;offre gratuite.
          </li>
          <li>
            <b>Pack de crédits</b> — remboursement au prorata des crédits <b>non consommés</b> à
            la date de la demande. Les crédits déjà utilisés correspondent à un service fourni
            et ne sont pas remboursés.
          </li>
        </ul>
        <p>
          La rétractation s&apos;exerce par toute déclaration dénuée d&apos;ambiguïté adressée à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>, ou au moyen du formulaire
          type reproduit ci-dessous. Le remboursement intervient dans les quatorze jours suivant
          la réception de la demande, par le même moyen de paiement que celui utilisé lors de la
          commande.
        </p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-4 text-sm">
          <p className="font-semibold text-[var(--foreground)]">
            Formulaire type de rétractation
          </p>
          <p className="mt-2 whitespace-pre-line">
            {`À l'attention de ${EDITEUR.denomination}, ${EDITEUR.adresse} — ${EDITEUR.email}

Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous :

Commandé le : ……………………………………
Nom du consommateur : ……………………………………
Adresse du consommateur : ……………………………………
Adresse email du compte : ……………………………………

Date : ……………………
Signature (uniquement en cas de notification sur papier) :`}
          </p>
        </div>
        <p>
          Le compte gratuit ne donnant lieu à aucun paiement, il n&apos;entre pas dans le champ
          du présent article.
        </p>
      </LegalSection>

      <LegalSection id="usage" titre="9. Usage loyal et obligations de l'utilisateur">
        <p>L&apos;utilisateur s&apos;engage à :</p>
        <ul>
          <li>
            ne pas saisir dans le Service de données concernant des <b>patients réels</b>, ni
            aucune donnée de santé identifiante appartenant à un tiers ;
          </li>
          <li>
            ne pas utiliser le Service à des fins de diagnostic, de soin ou de décision
            clinique ;
          </li>
          <li>
            ne pas extraire, reproduire ou réutiliser les contenus du Service en dehors de son
            usage personnel de formation ;
          </li>
          <li>
            ne pas automatiser ses accès, ni contourner les mécanismes de comptage, de
            facturation ou de sécurité.
          </li>
        </ul>
        <p>
          Des <b>garde-fous d&apos;usage loyal</b> protègent le Service contre les usages
          automatisés. Ils sont calibrés très au-delà d&apos;un usage humain normal et sont, à
          ce jour, fixés à {limits.simDaily} mises en situation par période de 24 heures et{" "}
          {limits.simMonthly} par mois glissant, ainsi que {limits.drillDaily} évaluations
          d&apos;exercices par période de 24 heures. Ces seuils peuvent être ajustés ; ils ne
          constituent pas une limite commerciale de l&apos;offre.
        </p>
      </LegalSection>

      <LegalSection id="pi" titre="10. Propriété intellectuelle et licence d'usage">
        <p>
          L&apos;éditeur concède à l&apos;utilisateur un droit d&apos;usage personnel, non
          exclusif et non transférable du Service et de ses contenus, pour la durée de son
          accès et pour ses seuls besoins de formation. Toute autre exploitation — diffusion,
          reproduction, adaptation, usage collectif ou commercial — requiert une autorisation
          écrite préalable.
        </p>
        <p>
          Les transcriptions des entretiens simulés produites par l&apos;utilisateur lui restent
          accessibles depuis son historique. L&apos;éditeur se réserve le droit de les exploiter
          sous forme <b>anonymisée et agrégée</b> à des fins d&apos;amélioration du Service,
          dans les conditions décrites dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection id="disponibilite" titre="11. Disponibilité, évolutions et responsabilité">
        <p>
          L&apos;éditeur s&apos;engage à mettre en œuvre les moyens raisonnables pour assurer
          l&apos;accessibilité du Service, sans garantie de disponibilité ininterrompue. Des
          interruptions peuvent survenir pour maintenance, mise à jour, ou du fait d&apos;un
          prestataire technique tiers.
        </p>
        <p>
          L&apos;éditeur peut faire évoluer le Service et les présentes Conditions. Toute
          modification substantielle des Conditions ou des tarifs affectant un abonnement en
          cours est notifiée par email <ToFill>[À COMPLÉTER PAR JULIEN — délai de préavis
          retenu, usuellement 30 jours]</ToFill> avant son entrée en vigueur. L&apos;utilisateur
          qui refuse la modification peut résilier sans frais avant cette date.
        </p>
        <p>
          La responsabilité de l&apos;éditeur ne saurait être engagée à raison des décisions
          professionnelles prises par l&apos;utilisateur, ni des conséquences d&apos;un usage du
          Service non conforme aux présentes Conditions. Aucune stipulation des présentes
          n&apos;a pour effet d&apos;écarter les garanties légales de conformité et des vices
          cachés dues au consommateur, ni de limiter la responsabilité de l&apos;éditeur en cas
          de faute lourde, de dol ou de dommage corporel.
        </p>
      </LegalSection>

      <LegalSection id="donnees" titre="12. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>, qui fait partie
          intégrante des présentes Conditions.
        </p>
      </LegalSection>

      <LegalSection id="ambassadeurs" titre="13. Programme ambassadeur">
        <p>
          La participation au programme ambassadeur est régie par des conditions distinctes :{" "}
          <Link href="/conditions-ambassadeurs">conditions du programme ambassadeur</Link>. Elle
          est indépendante de la souscription d&apos;un abonnement.
        </p>
      </LegalSection>

      <LegalSection id="litiges" titre="14. Réclamations, médiation et droit applicable">
        <p>
          Toute réclamation peut être adressée à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>. L&apos;éditeur s&apos;efforce
          d&apos;y répondre dans les meilleurs délais.
        </p>
        <p>
          Conformément à l&apos;article L612-1 du code de la consommation, le consommateur peut
          recourir gratuitement à un médiateur de la consommation en vue de la résolution
          amiable d&apos;un litige :{" "}
          <ToFill>
            [À COMPLÉTER PAR JULIEN — nom, adresse et site du médiateur de la consommation
            auquel l&apos;entreprise a adhéré. Cette adhésion est une obligation légale pour
            toute activité B2C : sans médiateur désigné, cette clause est incomplète.]
          </ToFill>
        </p>
        <p>
          Le consommateur peut également recourir à la plateforme européenne de règlement en
          ligne des litiges :{" "}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
        <p>
          Les présentes Conditions sont soumises au droit français. À défaut de résolution
          amiable, le litige relève des juridictions compétentes dans les conditions prévues par
          le code de procédure civile et le code de la consommation.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
