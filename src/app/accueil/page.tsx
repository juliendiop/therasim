import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Dumbbell,
  Flame,
  History,
  Lock,
  MessagesSquare,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDashboard } from "@/lib/dashboard";
import { userFrameworkAccess } from "@/lib/entitlements";
import { KIND_LABEL, fmtDate, pct } from "@/lib/ui";
import { patientDisplayName } from "@/lib/patient";
import PatientAvatar from "@/app/_components/patient-avatar";

export const dynamic = "force-dynamic";

// Tableau de bord d'accueil : répond à « que faire aujourd'hui ? ».
// Reprise en un clic (entretien en cours, dernier domaine), révisions dues,
// activité de la semaine, dernières mises en situation.
export default async function AccueilPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await searchParams;
  const user = await requireUser();
  const access = await userFrameworkAccess(user);
  const d = await buildDashboard(user.id, user.tenantId, access.unlocked);

  // « À découvrir » : domaines verrouillés (freemium) suggérés en fin de page.
  const decouvrir =
    access.locked.size > 0
      ? await prisma.framework.findMany({
          where: { id: { in: [...access.locked] }, statut: "publie" },
          take: 3,
        })
      : [];

  // Domaines débloqués pour cet utilisateur (affichés explicitement à l'accueil
  // de bienvenue — sinon un nouvel inscrit ne « voit » pas son domaine gratuit).
  const mesDomaines =
    access.unlocked.size > 0
      ? await prisma.framework.findMany({
          where: { id: { in: [...access.unlocked] }, statut: "publie" },
          orderBy: { nom: "asc" },
        })
      : [];
  const startFw = mesDomaines[0] ?? null;

  const premierePratique = !d.reprendre && !d.ongoingSim && d.recentSims.length === 0;
  const prenom = user.firstName ? ` ${user.firstName}` : "";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour{prenom} 👋</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        Votre point de départ du jour : reprenez où vous en étiez, révisez ce qui
        s&apos;estompe, et suivez votre pratique de la semaine.
      </p>

      {!d.hasFrameworks ? (
        <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          Aucun domaine n&apos;est encore disponible sur votre espace. Revenez bientôt !
        </div>
      ) : bienvenue || premierePratique ? (
        /* Bienvenue / première visite : un seul appel à l'action, clair et direct. */
        <div className="mt-6 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="font-semibold">
                {bienvenue
                  ? `Bienvenue${prenom}, votre compte est prêt 🎉`
                  : "Bienvenue ! Faites votre premier pas."}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {startFw
                  ? `Commencez par « ${startFw.nom} » — chaque essai alimente votre carte de progression, dès le premier exercice.`
                  : "Choisissez un domaine à travailler — chaque essai alimente votre carte de progression, dès le premier exercice."}
              </p>
            </div>
            <Link
              href={startFw ? `/f/${startFw.id}/entrainement` : "/catalogue"}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Compass className="h-4 w-4" /> {startFw ? "Commencer maintenant" : "Choisir un domaine"}
            </Link>
          </div>
          {/* Rappel du parcours, pour situer le nouvel inscrit */}
          <div className="mt-4 grid gap-2 border-t border-[var(--accent-border)] pt-4 sm:grid-cols-3">
            <MiniStep n="1" t="Exercices" d="Une compétence à la fois, feedback immédiat." />
            <MiniStep n="2" t="Mises en situation" d="Un patient simulé par IA qui réagit." />
            <MiniStep n="3" t="Progression" d="Vos forces et lacunes, en temps réel." />
          </div>
        </div>
      ) : null}

      {/* Domaines accessibles : toujours visibles (résout « je ne vois aucun
          domaine » après inscription). Tuiles cliquables vers la carte du domaine. */}
      {d.hasFrameworks && mesDomaines.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              {mesDomaines.length > 1 ? "Vos domaines" : "Votre domaine"}
            </h2>
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Explorer le catalogue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mesDomaines.map((f) => (
              <Link
                key={f.id}
                href={`/f/${f.id}`}
                className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Dumbbell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold group-hover:text-[var(--accent)]">
                    {f.nom}
                  </div>
                  {f.description && (
                    <p className="line-clamp-1 text-xs text-[var(--muted)]">{f.description}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contenu « habituel » (reprise, révisions, stats) — masqué pour un
          nouvel inscrit (rien à reprendre), affiché dès la première activité. */}
      {d.hasFrameworks && !(bienvenue || premierePratique) && (
        <>
          {/* Entretien laissé en cours : reprise en un clic */}
          {d.ongoingSim && (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                  {KIND_LABEL[d.ongoingSim.kind] ?? "Mise en situation"} en cours
                </div>
                <h2 className="mt-0.5 font-semibold">
                  {d.ongoingSim.scenarioTitre}{" "}
                  <span className="font-normal text-[var(--muted)]">
                    · {d.ongoingSim.frameworkNom}
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  commencé le {fmtDate(d.ongoingSim.createdAt)}
                </p>
              </div>
              <Link
                href={`/sim/${d.ongoingSim.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <Play className="h-4 w-4" /> Reprendre
              </Link>
            </div>
          )}

          {/* Activité de la semaine */}
          <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-[var(--border)] bg-white p-5">
            <Stat
              icon={<Dumbbell className="h-4 w-4" />}
              label="Exercices cette semaine"
              value={String(d.semaine.exercices)}
            />
            <Stat
              icon={<MessagesSquare className="h-4 w-4" />}
              label="Mises en situation"
              value={String(d.semaine.entretiens)}
            />
            <Stat
              icon={<Flame className="h-4 w-4" />}
              label="Compétences travaillées"
              value={String(d.semaine.competences)}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Reprendre là où j'en étais */}
            {d.reprendre && (
              <section className="card-soft p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <Play className="h-4 w-4" /> Reprendre là où j&apos;en étais
                </h2>
                <div className="mt-3">
                  <Link
                    href={`/f/${d.reprendre.frameworkId}`}
                    className="text-lg font-semibold hover:text-[var(--accent)]"
                  >
                    {d.reprendre.frameworkNom}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    maîtrise {pct(d.reprendre.masteryMoyenne)} ·{" "}
                    {d.reprendre.couvertes}/{d.reprendre.total} compétences couvertes
                  </p>
                </div>
                {d.reprendre.priorites.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ochre)]">
                      <Sparkles className="h-3.5 w-3.5" /> À travailler en priorité
                    </div>
                    {d.reprendre.priorites.map((p) => (
                      <div
                        key={p.competency_id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      >
                        <span className="flex-1">
                          {p.nom}{" "}
                          <span className="text-xs text-[var(--muted)]">— {p.raison}</span>
                        </span>
                        <Link
                          href={`/f/${d.reprendre!.frameworkId}/entrainement?competency=${p.competency_id}`}
                          className="shrink-0 rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
                        >
                          S&apos;entraîner
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href={`/f/${d.reprendre.frameworkId}/entrainement`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                >
                  <Dumbbell className="h-4 w-4" /> Continuer l&apos;entraînement
                </Link>
              </section>
            )}

            {/* À réviser */}
            <section className="card-soft p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                <RotateCcw className="h-4 w-4" /> À réviser
              </h2>
              {d.aReviser.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Rien ne s&apos;estompe pour l&apos;instant — vos compétences pratiquées
                  sont fraîches. 👌
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {d.aReviser.map((r) => (
                    <div
                      key={`${r.frameworkId}:${r.code}`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span className="flex-1">
                        {r.nom}{" "}
                        <span className="text-xs text-[var(--muted)]">
                          · {r.frameworkNom} · il y a {r.jours} j
                        </span>
                      </span>
                      <Link
                        href={`/f/${r.frameworkId}/entrainement?competency=${r.code}`}
                        className="shrink-0 rounded-md border border-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        Réviser
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Dernières mises en situation */}
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                <History className="h-4 w-4" /> Dernières mises en situation
              </h2>
              <Link
                href="/historique"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Tout l&apos;historique <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {d.recentSims.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-white p-5 text-center text-sm text-[var(--muted)]">
                Aucune mise en situation encore — la première est la plus instructive.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {d.recentSims.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sim/${s.id}`}
                    className="group rounded-xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--accent)]">
                        {KIND_LABEL[s.kind] ?? s.kind}
                      </span>
                      <span className="text-[var(--muted)]">{fmtDate(s.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <PatientAvatar
                        name={patientDisplayName(s.scenarioTitre)}
                        seed={s.scenarioTitre}
                        size="sm"
                      />
                      <div className="line-clamp-1 text-sm font-semibold group-hover:text-[var(--accent)]">
                        {s.scenarioTitre}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {s.frameworkNom} · {s.tours} tour{s.tours > 1 ? "s" : ""}
                      {s.statut === "en_cours"
                        ? " · en cours"
                        : s.moyenne !== null
                          ? ` · ${s.moyenne.toFixed(1).replace(".", ",")}/5`
                          : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* À découvrir : domaines verrouillés (vitrine incitative freemium) */}
      {decouvrir.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Lock className="h-4 w-4 text-[var(--ochre)]" /> À découvrir
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {decouvrir.map((f) => (
              <Link
                key={f.id}
                href={`/f/${f.id}`}
                className="group rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-tint)] p-4 transition hover:border-[var(--ochre)] hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--ochre)]">Nouveau domaine</span>
                  <Lock className="h-3.5 w-3.5 text-[var(--ochre)]" />
                </div>
                <div className="mt-1.5 text-sm font-semibold group-hover:text-[var(--ochre)]">
                  {f.nom}
                </div>
                {f.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                    {f.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStep({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[var(--accent)]">
        {n}
      </span>
      <div>
        <div className="text-xs font-semibold">{t}</div>
        <div className="text-[11px] text-[var(--muted)]">{d}</div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="tabular text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        {icon} {label}
      </div>
    </div>
  );
}
