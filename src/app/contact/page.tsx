import type { Metadata } from "next";
import Link from "next/link";
import { Building2, LifeBuoy, Mail, Phone, ShieldCheck } from "lucide-react";
import { EDITEUR, SERVICE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact — MELETA",
  description:
    "Contacter l'équipe MELETA : questions sur le service, écoles et organismes de formation, support, données personnelles.",
};

/** Carte de contact : une entrée = un motif de contact, une adresse, un lien. */
function ContactCard({
  icon,
  titre,
  texte,
  action,
}: {
  icon: React.ReactNode;
  titre: string;
  texte: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      <h2 className="mt-3 font-semibold">{titre}</h2>
      <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{texte}</p>
      <div className="mt-3 text-sm font-medium text-[var(--accent)]">{action}</div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="animate-in mx-auto max-w-3xl">
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          Contact
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Une question ? Écrivez-nous.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-soft)]">
          Nous répondons à toutes les demandes concernant {SERVICE.nom} : usage du service,
          facturation, partenariats, ou exercice de vos droits sur vos données.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <ContactCard
          icon={<Mail className="h-5 w-5" />}
          titre="Question générale"
          texte="Le moyen le plus direct pour toute question sur le service, votre compte ou votre facturation."
          action={<a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>}
        />
        <ContactCard
          icon={<Building2 className="h-5 w-5" />}
          titre="Écoles et organismes de formation"
          texte="Accès dédié pour vos apprenants, tarif adapté au volume, démonstration et devis."
          action={<Link href="/demande-demo">Demander une démonstration</Link>}
        />
        <ContactCard
          icon={<LifeBuoy className="h-5 w-5" />}
          titre="Support technique"
          texte="Si vous avez un compte, ouvrez un ticket depuis l'application : nous voyons directement votre contexte."
          action={<Link href="/support">Ouvrir un ticket</Link>}
        />
        <ContactCard
          icon={<ShieldCheck className="h-5 w-5" />}
          titre="Données personnelles"
          texte="Accès, rectification, suppression, portabilité, opposition : nous répondons sous un mois."
          action={<a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>}
        />
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-tint)] p-5">
        <h2 className="font-semibold">Coordonnées de l&apos;éditeur</h2>
        <div className="mt-3 space-y-1.5 text-sm text-[var(--ink-soft)]">
          <p>
            <b>{EDITEUR.denomination}</b>
          </p>
          <p>{EDITEUR.adresse}</p>
          <p className="flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-[var(--muted)]" />
            <a href={`tel:${EDITEUR.telephone.replace(/\s/g, "")}`} className="underline">
              {EDITEUR.telephone}
            </a>
          </p>
          <p className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-[var(--muted)]" />
            <a href={`mailto:${EDITEUR.email}`} className="underline">
              {EDITEUR.email}
            </a>
          </p>
          <p className="text-[var(--muted)]">
            SIREN {EDITEUR.siren} — RCS {EDITEUR.rcs}
          </p>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Détail complet dans les <Link href="/mentions-legales" className="underline">mentions
          légales</Link>.
        </p>
      </section>
    </div>
  );
}
