import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { isEvaluatorConfigured } from "@/lib/evaluator";
import { startSimulationAction } from "@/app/sim/actions";

export const dynamic = "force-dynamic";

export default async function SimulationStart({
  params,
}: {
  params: Promise<{ framework_id: string }>;
}) {
  const { framework_id } = await params;
  const user = await requireUser();
  // Verrouillé pour cet utilisateur -> la page référentiel affiche le paywall.
  if (!(await userCanAccess(user, framework_id))) redirect(`/f/${framework_id}`);

  const [framework, scenarios] = await Promise.all([
    prisma.framework.findUnique({ where: { id: framework_id } }),
    prisma.scenario.findMany({ where: { frameworkId: framework_id } }),
  ]);
  if (!framework) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/f/${framework_id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> {framework.nom}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Entretien simulé</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Mène un entretien complet, sans filet. Le patient est incarné et réagit à ta posture.
        À la fin, tu reçois un débrief et ta carte de progression se met à jour.
      </p>

      {!isEvaluatorConfigured() && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Le simulateur a besoin d&apos;une clé API IA (<code>MISTRAL_API_KEY</code> ou{" "}
          <code>ANTHROPIC_API_KEY</code> selon le fournisseur choisi). Tu peux démarrer, mais le
          patient ne répondra qu&apos;une fois la clé configurée.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {scenarios.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Aucun cas pour ce référentiel. Ajoutez-en un dans l&apos;admin de contenu.
          </p>
        )}
        {scenarios.map((s) => (
          <form
            key={s.id}
            action={startSimulationAction}
            className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <input type="hidden" name="frameworkId" value={framework_id} />
            <input type="hidden" name="scenarioId" value={s.id} />
            <div className="min-w-0">
              <div className="font-medium">{s.titre}</div>
              {s.contexte && (
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{s.contexte}</div>
              )}
            </div>
            <button className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              <Play className="h-4 w-4" /> Démarrer
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
