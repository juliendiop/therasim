import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, ToFill } from "@/app/_components/legal-page";
import { COOKIES, EDITEUR, RETENTIONS, SERVICE, SOUS_TRAITANTS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité — MELETA",
  description:
    "Données collectées par MELETA, sous-traitants, durées de conservation, cookies et droits des personnes au titre du RGPD.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      titre="Politique de confidentialité"
      chapeau={`Comment ${EDITEUR.denomination} collecte, utilise et protège vos données personnelles dans le cadre du service ${SERVICE.nom}, conformément au règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.`}
      brouillon={false}
    >
      <LegalSection id="responsable" titre="1. Responsable du traitement">
        <p>
          Le responsable du traitement est <b>{EDITEUR.denomination}</b>, {EDITEUR.adresse},
          SIREN {EDITEUR.siren}. Contact pour toute question relative aux données personnelles :{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
        </p>
        <p>
          Aucun délégué à la protection des données n&apos;a été désigné, cette désignation
          n&apos;étant pas obligatoire au regard de l&apos;article 37 du RGPD pour
          l&apos;activité exercée. Les demandes relatives aux données sont traitées directement
          par le gérant, à l&apos;adresse indiquée ci-dessus.
        </p>
        <p>
          Lorsque {SERVICE.nom} est mis à disposition par une école ou un organisme de formation
          pour ses apprenants, cet établissement détermine les finalités de l&apos;usage
          pédagogique : il est alors responsable de traitement pour ce périmètre, et{" "}
          {EDITEUR.denomination} agit en qualité de sous-traitant.
        </p>
      </LegalSection>

      <LegalSection id="donnees" titre="2. Données collectées et bases légales">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Données</th>
                <th>Finalité</th>
                <th>Base légale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Adresse email, prénom, mot de passe (haché), rôle</td>
                <td>Création et gestion du compte, authentification</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>
                  Contenu des exercices et des séances simulées, scores, progression par
                  compétence
                </td>
                <td>Fourniture du service pédagogique et suivi de progression</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>
                  Identifiant client de paiement, historique des abonnements et achats, solde de
                  crédits
                </td>
                <td>Facturation, gestion des abonnements, comptabilité</td>
                <td>Exécution du contrat et obligation légale</td>
              </tr>
              <tr>
                <td>Tickets et messages de support</td>
                <td>Traitement des demandes d&apos;assistance</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>
                  Journal d&apos;audit : connexions, invitations, changements de rôle
                </td>
                <td>Sécurité du service, traçabilité des accès</td>
                <td>Intérêt légitime (sécurité)</td>
              </tr>
              <tr>
                <td>
                  Identifiant de visite anonyme et étapes du parcours d&apos;inscription
                </td>
                <td>Mesure d&apos;audience interne, amélioration du parcours</td>
                <td>Intérêt légitime (mesure first-party, sans traceur tiers)</td>
              </tr>
              <tr>
                <td>
                  Rattachement à un ambassadeur, commissions, demandes de paiement
                </td>
                <td>Gestion du programme ambassadeur</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>Consentement horodaté à l&apos;inscription</td>
                <td>Preuve de l&apos;information délivrée</td>
                <td>Obligation légale (preuve)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <b>Aucune donnée de patient réel n&apos;a vocation à transiter par le Service.</b> Les
          cas cliniques sont fictifs et générés par le Service. Il est interdit d&apos;y saisir
          des informations concernant une personne réelle en cours de suivi.
        </p>
      </LegalSection>

      <LegalSection id="ia" titre="3. Traitement par les modèles d'intelligence artificielle">
        <p>
          Les mises en situation et les évaluations formatives reposent sur des modèles de
          langage exploités par des prestataires tiers (voir article 5). Le contenu des échanges
          de la mise en situation leur est transmis pour produire la réponse du patient simulé
          ou le retour pédagogique. Aucun identifiant de compte, nom ou adresse email n&apos;est
          joint à ces requêtes.
        </p>
      </LegalSection>

      <LegalSection id="destinataires" titre="4. Destinataires">
        <p>
          {EDITEUR.denomination} étant une société à associé unique sans salarié, l&apos;accès
          interne aux données est limité à son gérant, {EDITEUR.gerant}, dans la seule mesure
          nécessaire à l&apos;exploitation et au support du Service. S&apos;y ajoutent les
          sous-traitants listés à l&apos;article 5. Lorsqu&apos;un accès est fourni par une école, les
          formateurs et superviseurs désignés par celle-ci accèdent aux productions
          pédagogiques de leurs apprenants.
        </p>
        <p>
          Dans le cadre du programme ambassadeur, les filleuls apparaissent auprès de leur
          parrain de façon <b>anonymisée</b> : ni nom, ni email, ni contenu pédagogique ne lui
          sont communiqués. Aucune donnée n&apos;est vendue, louée ou cédée à des fins
          publicitaires.
        </p>
      </LegalSection>

      <LegalSection id="sous-traitants" titre="5. Sous-traitants et transferts hors UE">
        <p>
          Les prestataires ci-dessous interviennent dans le fonctionnement du Service. La liste
          reflète les intégrations réellement présentes dans l&apos;application.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Prestataire</th>
                <th>Finalité</th>
                <th>Données concernées</th>
                <th>Localisation</th>
              </tr>
            </thead>
            <tbody>
              {SOUS_TRAITANTS.map((s) => (
                <tr key={s.nom}>
                  <td>
                    <b>{s.nom}</b>
                  </td>
                  <td>{s.finalite}</td>
                  <td>{s.donnees}</td>
                  <td>{s.localisation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Certains de ces prestataires sont établis aux États-Unis. Les transferts hors Union
          européenne sont encadrés par les clauses contractuelles types de la Commission
          européenne et par l&apos;adhésion de ces prestataires au cadre de protection des
          données UE–États-Unis (<i>EU-U.S. Data Privacy Framework</i>).
        </p>
      </LegalSection>

      <LegalSection id="durees" titre="6. Durées de conservation">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Donnée</th>
                <th>Durée de conservation</th>
              </tr>
            </thead>
            <tbody>
              {RETENTIONS.map((r) => (
                <tr key={r.donnee}>
                  <td>{r.donnee}</td>
                  <td>{r.verifie ? r.duree : <ToFill>{r.duree}</ToFill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="cookies" titre="7. Cookies">
        <p>
          {SERVICE.nom} n&apos;utilise <b>aucun cookie publicitaire, aucun traceur tiers et
          aucune solution d&apos;analytics externe</b>. Seuls les cookies suivants, déposés par
          le site lui-même et inaccessibles au JavaScript de la page, sont utilisés :
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Rôle</th>
                <th>Durée</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.nom}>
                  <td>
                    <code>{c.nom}</code>
                  </td>
                  <td>{c.role}</td>
                  <td>{c.duree}</td>
                  <td>{c.categorie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Ces cookies sont nécessaires au fonctionnement du service ou relèvent d&apos;une mesure
          d&apos;audience interne strictement limitée, exemptée de consentement dans les
          conditions posées par la CNIL. Aucun bandeau de consentement n&apos;est donc affiché.
        </p>
      </LegalSection>

      <LegalSection id="droits" titre="8. Vos droits">
        <p>
          Conformément aux articles 15 à 22 du RGPD, vous disposez des droits d&apos;accès, de
          rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité,
          ainsi que du droit de définir des directives relatives au sort de vos données après
          votre décès.
        </p>
        <p>
          Ces droits s&apos;exercent en écrivant à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a> depuis l&apos;adresse email de
          votre compte. Une pièce justificative d&apos;identité peut être demandée en cas de
          doute raisonnable. Nous répondons dans un délai d&apos;un mois, prolongeable de deux
          mois pour les demandes complexes.
        </p>
        <p>
          <b>Suppression du compte.</b> Le Service ne propose pas encore de suppression en
          autonomie depuis l&apos;espace personnel : la demande est traitée manuellement à
          réception de votre message. Elle entraîne l&apos;effacement du compte, de la
          progression, de l&apos;historique des séances et des tickets de support, à
          l&apos;exception des pièces comptables que la loi impose de conserver.
        </p>
        <p>
          Vous pouvez introduire une réclamation auprès de la CNIL — 3 place de Fontenoy, TSA
          80715, 75334 Paris Cedex 07 —{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            cnil.fr
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="securite" titre="9. Sécurité">
        <p>
          Les mots de passe sont stockés sous forme de condensats et ne sont jamais conservés en
          clair. Les échanges avec le site sont chiffrés (HTTPS). Les sessions reposent sur un
          jeton signé, déposé dans un cookie inaccessible au JavaScript. Les liens de connexion
          par email sont à usage unique et expirent rapidement. Les accès aux fonctions
          d&apos;administration sont contrôlés par rôle et journalisés.
        </p>
      </LegalSection>

      <LegalSection id="modifications" titre="10. Modifications">
        <p>
          Cette politique peut évoluer avec le Service. Toute modification substantielle est
          portée à la connaissance des utilisateurs par email ou par une information visible
          dans l&apos;application. Les{" "}
          <Link href="/cgv-cgu">conditions générales</Link> et les{" "}
          <Link href="/mentions-legales">mentions légales</Link> complètent le présent document.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
