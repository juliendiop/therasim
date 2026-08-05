import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "@/app/_components/legal-page";
import { AMBASSADEUR_REGLES, EDITEUR, SERVICE } from "@/lib/legal";
import { resolveCommissionRate } from "@/lib/affiliation";

// Taux, seuil et durée d'attribution sont paramétrables en base (AppConfig) :
// la page affiche les valeurs RÉELLEMENT appliquées, jamais des valeurs recopiées.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions du programme ambassadeur — MELETA",
  description:
    "Commissions, attribution des filleuls, seuil et modalités de paiement, obligation de facturation, modification et résiliation du programme ambassadeur MELETA.",
};

export default async function ConditionsAmbassadeursPage() {
  const rates = await resolveCommissionRate();
  const seuil = (rates.payoutMinCents / 100).toFixed(2).replace(".00", "");

  return (
    <LegalPage
      titre="Conditions du programme ambassadeur"
      chapeau={`Règles applicables aux participants du programme de recommandation de ${SERVICE.nom}. Elles complètent les conditions générales du service.`}
      brouillon={false}
    >
      {!rates.enabled && (
        <p className="rounded-xl border border-[var(--border-strong)] bg-[var(--paper-2)] p-4">
          <b>Le programme ambassadeur est actuellement suspendu.</b> Les présentes conditions
          restent publiées à titre d&apos;information et s&apos;appliquent aux soldes acquis
          avant la suspension.
        </p>
      )}

      <LegalSection id="objet" titre="1. Objet et adhésion">
        <p>
          Le programme ambassadeur permet à un utilisateur de {SERVICE.nom} de recommander le
          service et de percevoir une commission sur les abonnements souscrits par les personnes
          qu&apos;il a orientées (ses « filleuls »).
        </p>
        <p>
          L&apos;adhésion est <b>gratuite et sans engagement</b>. Elle s&apos;effectue depuis
          l&apos;espace ambassadeur, par acceptation expresse des présentes conditions. Elle
          suppose un compte {SERVICE.nom} actif et éligible.
        </p>
        <p>
          <b>
            L&apos;ambassadeur agit en toute indépendance. Le programme ne crée ni contrat de
            travail, ni mandat, ni contrat d&apos;agence commerciale, ni société entre
            l&apos;ambassadeur et {EDITEUR.denomination}.
          </b>{" "}
          L&apos;ambassadeur ne peut engager l&apos;éditeur, ni se présenter comme son
          représentant, salarié ou distributeur exclusif.
        </p>
      </LegalSection>

      <LegalSection id="attribution" titre="2. Attribution des filleuls">
        <p>
          Chaque ambassadeur dispose d&apos;un lien de parrainage unique. Lorsqu&apos;un visiteur
          suit ce lien, un identifiant de parrainage est enregistré dans son navigateur pour une
          durée de <b>{rates.cookieDays} jours</b>. S&apos;il crée un compte pendant cette
          période, il est rattaché à cet ambassadeur.
        </p>
        <p>
          L&apos;attribution obéit à la règle du <b>premier contact</b> : si un identifiant de
          parrainage est déjà enregistré, il n&apos;est jamais remplacé par un lien suivi
          ultérieurement. Le rattachement est enregistré à la création du compte et devient{" "}
          <b>définitif</b> : il ne peut plus être modifié, y compris à la demande du filleul ou
          de l&apos;ambassadeur.
        </p>
        <p>
          L&apos;attribution suppose que le visiteur accepte les cookies techniques du site et
          n&apos;efface pas les données de son navigateur entre le clic et l&apos;inscription.
          Aucune attribution rétroactive n&apos;est possible en dehors de ce mécanisme, sauf
          pour les recommandations d&apos;établissements visées à l&apos;article 4.
        </p>
        <p>
          <b>Sont exclus</b> l&apos;auto-parrainage, la création de comptes de complaisance, et
          tout rattachement obtenu par un moyen frauduleux. Ces situations entraînent
          l&apos;annulation des commissions correspondantes.
        </p>
      </LegalSection>

      <LegalSection id="commissions" titre="3. Commissions">
        <ul>
          <li>
            <b>Niveau 1 — {rates.rateTier1} %</b> de chaque paiement d&apos;abonnement effectué
            par un filleul direct, versé à chaque échéance tant que l&apos;abonnement demeure
            actif et payé.
          </li>
          <li>
            <b>Niveau 2 — {rates.rateTier2} %</b> des paiements d&apos;abonnement générés par
            les filleuls directs des ambassadeurs que vous avez vous-même parrainés.
          </li>
        </ul>
        <p>
          <b>
            Le programme comporte {AMBASSADEUR_REGLES.niveauxMax} niveaux au maximum.
          </b>{" "}
          Aucune commission n&apos;est versée au-delà, ce qui exclut tout mécanisme de type
          pyramidal prohibé par l&apos;{AMBASSADEUR_REGLES.fondementInterdictionPyramidale}.
          Aucune contrepartie n&apos;est due au titre du seul recrutement d&apos;un ambassadeur :
          la commission naît exclusivement d&apos;un paiement d&apos;abonnement effectif.
        </p>
        <p>
          Les commissions sont calculées sur les paiements d&apos;<b>abonnement</b> réellement
          encaissés, <b>hors taxes (HT)</b>. Les achats de packs de crédits, les périodes
          gratuites et les périodes d&apos;essai ne génèrent pas de commission.
        </p>
        <p>
          En cas de remboursement, d&apos;impayé ou de rétractation d&apos;un filleul, la
          commission correspondante est annulée et déduite du solde de l&apos;ambassadeur.
        </p>
        <p>
          Les taux, le seuil de paiement et la durée d&apos;attribution ci-dessus sont ceux en
          vigueur à ce jour. Ils peuvent être modifiés dans les conditions de l&apos;article 7.
        </p>
      </LegalSection>

      <LegalSection id="ecoles" titre="4. Recommandation d'écoles et d'organismes">
        <p>
          Un ambassadeur peut recommander {SERVICE.nom} à une école ou à un organisme de
          formation. Si l&apos;établissement prend contact en indiquant le nom de
          l&apos;ambassadeur et signe un contrat, une commission est créditée manuellement.
        </p>
        <p>
          Cette commission « école » comporte deux volets :
        </p>
        <ul>
          <li>
            <b>10 %</b> du montant HT de l&apos;abonnement souscrit par l&apos;établissement,
            versé à chaque échéance <b>pendant les douze mois</b> suivant la signature du
            contrat ;
          </li>
          <li>
            au-delà de cette première année, ainsi que pour <b>tout achat additionnel</b>{" "}
            effectué individuellement par un élève de cet établissement (pack de crédits,
            abonnement personnel, référentiel à l&apos;unité…), les taux normaux du programme
            décrits à l&apos;article 3 s&apos;appliquent (niveau 1 — {rates.rateTier1} %).
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="paiement" titre="5. Seuil, facturation et paiement">
        <p>
          Les commissions alimentent un solde consultable en temps réel dans l&apos;espace
          ambassadeur. Le paiement est déclenché <b>à la demande de l&apos;ambassadeur</b>, dès
          que son solde atteint <b>{seuil} €</b>.
        </p>
        <p>
          <b>
            Le paiement est subordonné à l&apos;émission d&apos;une facture par
            l&apos;ambassadeur.
          </b>{" "}
          Celui-ci doit disposer d&apos;un statut lui permettant de facturer une prestation
          (micro-entrepreneur, société, association…) et adresser sa facture à{" "}
          <a href={`mailto:${AMBASSADEUR_REGLES.emailFacturation}`}>
            {AMBASSADEUR_REGLES.emailFacturation}
          </a>{" "}
          en précisant l&apos;email de son compte. La facture doit comporter les mentions
          légales obligatoires et, le cas échéant, la TVA applicable.
        </p>
        <p>
          Aucun paiement ne peut être effectué à un ambassadeur dans l&apos;incapacité
          d&apos;émettre une facture conforme. Le solde reste alors acquis et disponible tant que
          l&apos;adhésion au programme n&apos;a pas pris fin.
        </p>
        <p>
          Le règlement intervient par virement dans un délai de <b>30 jours</b> à compter de la
          réception de la facture conforme. Le solde est remis à zéro une fois la facture
          réglée. Une seule demande de paiement peut être en cours à la fois.
        </p>
        <p>
          L&apos;ambassadeur est seul responsable de ses obligations déclaratives, fiscales et
          sociales au titre des sommes perçues.
        </p>
      </LegalSection>

      <LegalSection id="obligations" titre="6. Obligations de l'ambassadeur">
        <p>Dans toute communication relative à {SERVICE.nom}, l&apos;ambassadeur s&apos;engage à :</p>
        <ul>
          <li>
            rester factuel et ne promettre <b>aucun résultat clinique, professionnel ou
            pédagogique</b> ;
          </li>
          <li>
            présenter {SERVICE.nom} pour ce qu&apos;il est — un outil <b>formatif et non
            certifiant</b> — et ne jamais laisser entendre qu&apos;il délivre une certification
            ou une équivalence ;
          </li>
          <li>
            <b>indiquer clairement le caractère rémunéré</b> de sa recommandation lorsqu&apos;il
            communique publiquement, conformément aux règles applicables aux pratiques
            commerciales et à l&apos;influence commerciale ;
          </li>
          <li>
            ne pas recourir au spam, à l&apos;achat de mots-clés reprenant la marque
            {" "}{SERVICE.nom}, à des noms de domaine prêtant à confusion, ni à des annonces se
            faisant passer pour le site officiel ;
          </li>
          <li>
            respecter les règles déontologiques de sa profession et la réglementation
            applicable à la publicité en matière de santé ;
          </li>
          <li>
            ne pas dénigrer de concurrents ni utiliser les marques et visuels de l&apos;éditeur
            en dehors du kit de diffusion fourni.
          </li>
        </ul>
        <p>
          Tout manquement peut entraîner l&apos;annulation des commissions concernées et
          l&apos;exclusion du programme, sans préjudice de réparation.
        </p>
      </LegalSection>

      <LegalSection id="modification" titre="7. Modification et fin du programme">
        <p>
          L&apos;éditeur peut modifier les taux de commission, le seuil de paiement, la durée
          d&apos;attribution et les présentes conditions, ou suspendre et clore le programme.
        </p>
        <p>
          Toute modification défavorable et la clôture du programme sont notifiées par email{" "}
          <b>30 jours</b> avant leur entrée en vigueur. Les modifications ne sont pas
          rétroactives : les
          commissions déjà acquises restent dues et payables selon les modalités de
          l&apos;article 5, y compris après la fin du programme.
        </p>
        <p>
          Le caractère « à vie » de la commission s&apos;entend <b>pour la durée de
          l&apos;abonnement du filleul et tant que le programme est maintenu</b> — il ne
          constitue pas un engagement perpétuel de l&apos;éditeur.
        </p>
      </LegalSection>

      <LegalSection id="resiliation" titre="8. Résiliation de l'adhésion">
        <p>
          L&apos;ambassadeur peut quitter le programme à tout moment, sans préavis ni
          justification, en écrivant à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>. Son solde acquis lui reste dû
          dès lors qu&apos;il atteint le seuil de paiement et qu&apos;une facture conforme est
          émise.
        </p>
        <p>
          L&apos;éditeur peut exclure un ambassadeur en cas de manquement aux articles 2 ou 6,
          de fraude, ou de comportement portant atteinte à l&apos;image du service. En cas de
          fraude avérée, les commissions issues des rattachements frauduleux sont annulées.
        </p>
        <p>
          Dans tous les cas, la fin de l&apos;adhésion n&apos;affecte ni le compte utilisateur,
          ni l&apos;abonnement éventuel de l&apos;ambassadeur, ni les comptes de ses filleuls.
        </p>
      </LegalSection>

      <LegalSection id="donnees" titre="9. Données des filleuls">
        <p>
          Par respect de leur vie privée, les filleuls sont présentés à leur parrain de façon{" "}
          <b>anonymisée</b> : statut d&apos;abonnement et commission générée uniquement, sans
          nom, email ni contenu pédagogique. L&apos;ambassadeur s&apos;interdit toute tentative
          de réidentification. Voir la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection id="divers" titre="10. Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit français et complètent les{" "}
          <Link href="/cgv-cgu">conditions générales de vente et d&apos;utilisation</Link>. Les
          règles de règlement des litiges qui y figurent s&apos;appliquent au présent programme.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
