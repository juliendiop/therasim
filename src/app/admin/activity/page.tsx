import { Activity, Download, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_TYPE_LABEL,
  buildActivity,
  type ActivityType,
} from "@/lib/activity";
import { SEGMENTS, SEGMENT_LABEL, type Segment } from "@/lib/segments";
import { buildUserStatsMap, computeSegmentsForUsers } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "1 an" },
];

const TYPE_BADGE: Record<ActivityType, string> = {
  drill: "bg-[var(--accent-soft)] text-[var(--accent)]",
  miniscene: "bg-[var(--ochre-soft)] text-[var(--ochre)]",
  simulation: "bg-[var(--ochre-soft)] text-[var(--ochre)]",
  credit: "bg-gray-100 text-[var(--foreground)]",
  signup: "bg-green-50 text-green-700",
  login: "bg-[var(--accent-soft)] text-[var(--accent)]",
  invite: "bg-green-50 text-green-700",
  role: "bg-gray-100 text-[var(--foreground)]",
  unlock: "bg-green-50 text-green-700",
  subscription: "bg-[var(--ochre-soft)] text-[var(--ochre)]",
};

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; email?: string; type?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = Number(sp.days) || 30;
  const email = sp.email?.trim() || undefined;
  const filters = {
    tenantId: sp.tenant || undefined,
    email,
    type: sp.type || undefined,
    days,
  };

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600 * 1000);

  const [tenants, { events, kpis, totalMatched }, matchedUser] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    buildActivity(filters),
    // Fiche utilisateur : uniquement quand le filtre email cible un compte PRÉCIS
    // (correspondance exacte, pas une recherche partielle).
    email?.includes("@")
      ? prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true, email: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  let userHeader: {
    segment: Segment;
    n3: number;
    n2: number;
    drills: number;
    lastActivityAt: Date | null;
    planLabel: string | null;
    subStatus: string | null;
    credits: number;
  } | null = null;

  if (matchedUser) {
    const [statsByUser, sub, creditsUser] = await Promise.all([
      buildUserStatsMap([matchedUser.id]),
      prisma.userSubscription.findUnique({ where: { userId: matchedUser.id } }),
      prisma.user.findUnique({
        where: { id: matchedUser.id },
        select: { credits: true, planCredits: true },
      }),
    ]);
    const stats = statsByUser.get(matchedUser.id);
    const plan = sub ? await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } }) : null;
    const segments = await computeSegmentsForUsers(
      [matchedUser],
      new Map(sub ? [[matchedUser.id, { status: sub.status }]] : []),
      statsByUser,
    );
    userHeader = {
      segment: segments.get(matchedUser.id) ?? "jamais_actif",
      n3: stats?.n3Completed ?? 0,
      n2: stats?.n2Completed ?? 0,
      drills: stats?.drillsCount ?? 0,
      lastActivityAt: stats?.lastActivityAt ?? null,
      planLabel: plan?.label ?? null,
      subStatus: sub?.status ?? null,
      credits: (creditsUser?.credits ?? 0) + (creditsUser?.planCredits ?? 0),
    };
  }

  const journalExportParams = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (matchedUser) journalExportParams.set("userId", matchedUser.id);
  else if (email) journalExportParams.set("email", email);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Journal d&apos;activité</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Toutes les actions menées sur les plateformes (exercices, mini-scènes, séances,
        crédits, inscriptions, abonnements), avec l&apos;email et la plateforme.
      </p>

      {/* Filtres */}
      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
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
            placeholder="rechercher… (email exact = fiche détaillée)"
            className="mt-1 block w-64 rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Type</label>
          <select
            name="type"
            defaultValue={sp.type ?? ""}
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            <option value="">Tous</option>
            {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Période</label>
          <select
            name="days"
            defaultValue={String(days)}
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Filtrer
        </button>
        <a
          href={`/api/admin/export/journal?${journalExportParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
        >
          <Download className="h-4 w-4" /> Exporter le journal (CSV)
        </a>
      </form>

      {/* Fiche utilisateur : uniquement si le filtre email cible un compte précis. */}
      {userHeader && (
        <div className="mt-5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            Fiche : {matchedUser?.email}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <MiniStat l="Segment" v={SEGMENT_LABEL[userHeader.segment]} />
            <MiniStat l="N3 terminés" v={userHeader.n3} />
            <MiniStat l="N2 (mini-scènes)" v={userHeader.n2} />
            <MiniStat l="Drills" v={userHeader.drills} />
            <MiniStat
              l="Dernière activité"
              v={
                userHeader.lastActivityAt
                  ? userHeader.lastActivityAt.toLocaleDateString("fr-FR", {
                      timeZone: "Europe/Paris",
                    })
                  : "—"
              }
            />
            <MiniStat l="Forfait" v={userHeader.planLabel ?? "—"} sub={userHeader.subStatus ?? undefined} />
            <MiniStat l="Crédits" v={userHeader.credits} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            La liste ci-dessous est déjà son journal, filtré sur cet email.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi k={kpis.total} l="Actions" />
        <Kpi k={kpis.activeUsers} l="Utilisateurs actifs" />
        <Kpi k={kpis.drills} l="Exercices" />
        <Kpi k={kpis.miniscenes} l="Mini-scènes" />
        <Kpi k={kpis.simulations} l="Séances" />
        <Kpi k={kpis.creditsConsumed} l="Crédits consommés" />
      </div>

      {/* Tableau */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Plateforme</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune activité sur cette période.
                </td>
              </tr>
            ) : (
              events.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-[var(--muted)]">
                    {new Date(e.at).toLocaleString("fr-FR", {
                      timeZone: "Europe/Paris",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.email}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{e.tenantName}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[e.type]}`}
                    >
                      {e.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">{e.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalMatched > events.length && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {events.length} évènements affichés sur {totalMatched} — affinez les filtres pour
          réduire la liste.
        </p>
      )}

      {/* Export contacts (CRM) */}
      <div className="mt-10 rounded-xl border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Export contacts (CRM)
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Une ligne par compte, avec le segment calculé. Les apprenants des plateformes
          clientes (B2B) sont exclus par défaut — ce sont les contacts de l&apos;école, pas
          les nôtres.
        </p>
        <form
          method="get"
          action="/api/admin/export/contacts"
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="text-xs font-medium">Segment</label>
            <select
              name="segment"
              defaultValue=""
              className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="">Tous</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Inscrit entre</label>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="date"
                name="signupFrom"
                className="rounded-lg border border-[var(--border)] p-2 text-sm"
              />
              <span className="text-[var(--muted)]">→</span>
              <input
                type="date"
                name="signupTo"
                className="rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Actif entre</label>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="date"
                name="activityFrom"
                className="rounded-lg border border-[var(--border)] p-2 text-sm"
              />
              <span className="text-[var(--muted)]">→</span>
              <input
                type="date"
                name="activityTo"
                className="rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs font-medium">
            <input type="checkbox" name="includeB2B" value="1" />
            Inclure les apprenants B2B
          </label>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            <Download className="h-4 w-4" /> Exporter les contacts (CSV)
          </button>
        </form>
      </div>
    </div>
  );
}

function Kpi({ k, l }: { k: number; l: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="tabular text-2xl font-semibold text-[var(--foreground)]">{k}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{l}</div>
    </div>
  );
}

function MiniStat({ l, v, sub }: { l: string; v: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{l}</div>
      <div className="text-sm font-semibold text-[var(--foreground)]">
        {v}
        {sub && <span className="ml-1 font-normal text-[var(--muted)]">({sub})</span>}
      </div>
    </div>
  );
}
