import { Coins, Mail, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { creditSettings } from "@/lib/credits";
import { getOffers } from "@/lib/offers";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/auth";
import { saveCreditSettings, saveOffers } from "./actions";
import GrantForm from "./grant-form";
import OfferButton from "./offer-button";
import AddCreditsButton from "./add-credits-button";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; email?: string; max?: string }>;
}) {
  const sp = await searchParams;
  const tenantId = sp.tenant || undefined;
  const emailQ = sp.email?.trim() || undefined;
  const maxCredits = sp.max !== undefined && sp.max !== "" ? Number(sp.max) : undefined;

  const [s, offers, tenants, users] = await Promise.all([
    creditSettings(),
    getOffers(),
    prisma.tenant.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.user.findMany({
      where: {
        role: { not: "super_admin" },
        ...(tenantId ? { tenantId } : {}),
        ...(emailQ ? { email: { contains: emailQ, mode: "insensitive" } } : {}),
        ...(maxCredits !== undefined && Number.isFinite(maxCredits)
          ? { credits: { lte: maxCredits } }
          : {}),
      },
      orderBy: [{ credits: "asc" }, { email: "asc" }],
      take: 200,
      select: { id: true, email: true, credits: true, role: true, tenantId: true },
    }),
  ]);

  const tenantNom = new Map(tenants.map((t) => [t.id, t.nom]));
  const offerOptions = offers.map((o) => ({ id: o.id, label: o.label }));

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Crédits & quotas IA</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Les exercices QCM restent gratuits. Seules les mini-scènes et les entretiens simulés
          consomment des crédits.
        </p>
      </div>

      {/* Utilisateurs & soldes */}
      <section>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Utilisateurs & soldes
          </h3>
        </div>

        {/* Filtres */}
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium">Plateforme</label>
            <select
              name="tenant"
              defaultValue={sp.tenant ?? ""}
              className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="">Toutes</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Email</label>
            <input
              name="email"
              defaultValue={sp.email ?? ""}
              placeholder="rechercher…"
              className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Solde ≤</label>
            <input
              name="max"
              type="number"
              min={0}
              defaultValue={sp.max ?? ""}
              placeholder="ex. 3"
              className="mt-1 block w-24 rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Filtrer
          </button>
        </form>

        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Plateforme</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2 text-right">Solde</th>
                <th className="px-4 py-2 text-right">Ajouter</th>
                <th className="px-4 py-2 text-right">Offre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                    Aucun utilisateur pour ces filtres.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-medium">{u.email}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">
                      {tenantNom.get(u.tenantId) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[var(--muted)]">
                      {ROLE_LABELS[u.role as Role] ?? u.role}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`tabular font-semibold ${
                          u.credits <= 3 ? "text-red-600" : "text-[var(--foreground)]"
                        }`}
                      >
                        {u.credits}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <AddCreditsButton userId={u.id} />
                    </td>
                    <td className="px-4 py-2">
                      <OfferButton userId={u.id} offers={offerOptions} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Triés par solde croissant (les plus bas d&apos;abord) — pratique pour les relances.
        </p>
      </section>

      {/* Offres (emails éditables) */}
      <section>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Offres (emails de relance)
          </h3>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Modèles envoyés via le bouton « Faire une offre ». Variables disponibles :{" "}
          <code className="rounded bg-[var(--surface-tint)] px-1">{"{brand}"}</code>{" "}
          <code className="rounded bg-[var(--surface-tint)] px-1">{"{credits}"}</code>{" "}
          <code className="rounded bg-[var(--surface-tint)] px-1">{"{email}"}</code>.
        </p>
        <form action={saveOffers} className="mt-3 space-y-5">
          {offers.map((o) => (
            <div key={o.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex items-center justify-between">
                <b className="text-sm">{o.label}</b>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                  {o.kind === "grant" ? "crédits offerts" : "promo (email seul)"}
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {o.kind === "grant" && (
                  <div>
                    <label className="text-xs font-medium">Crédits offerts</label>
                    <input
                      name={`credits_${o.id}`}
                      type="number"
                      min={0}
                      defaultValue={o.credits}
                      className="mt-1 w-28 rounded-lg border border-[var(--border)] p-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium">Sujet</label>
                  <input
                    name={`subject_${o.id}`}
                    defaultValue={o.subject}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Message</label>
                  <textarea
                    name={`body_${o.id}`}
                    defaultValue={o.body}
                    rows={6}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Enregistrer les offres
          </button>
        </form>
      </section>

      {/* Réglages quotas */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Réglages
        </h3>
        <form
          action={saveCreditSettings}
          className="mt-3 grid gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2"
        >
          <Field name="welcome" label="Pack de bienvenue" hint="Crédits offerts à la création du compte." value={s.welcome} />
          <Field name="monthly" label="Recharge mensuelle" hint="Plancher de crédits gratuits rechargé chaque mois." value={s.monthly} />
          <Field name="costMiniscene" label="Coût d'une mini-scène" hint="Crédits débités au lancement." value={s.costMiniscene} />
          <Field name="costSimulation" label="Coût d'un entretien simulé" hint="Crédits débités au lancement." value={s.costSimulation} />
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              Enregistrer
            </button>
          </div>
        </form>
      </section>

      {/* Octroi manuel */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Offrir des crédits (manuel)
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Créditer directement le compte d&apos;un utilisateur, sans email.
        </p>
        <div className="mt-3">
          <GrantForm />
        </div>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  value,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
      />
      <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>
    </div>
  );
}
