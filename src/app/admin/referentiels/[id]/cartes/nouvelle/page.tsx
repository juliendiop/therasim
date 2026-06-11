import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isEvaluatorConfigured } from "@/lib/evaluator";
import DrillEditor from "./drill-editor";

export const dynamic = "force-dynamic";

export default async function NouvelleCarte({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ competency?: string }>;
}) {
  const { id } = await params;
  const { competency } = await searchParams;
  const fw = await prisma.framework.findUnique({ where: { id } });
  if (!fw) notFound();

  const competencies = await prisma.competency.findMany({
    where: { gridId: fw.gridId },
    orderBy: { ordre: "asc" },
  });
  if (competencies.length === 0) notFound();

  const selected =
    competencies.find((c) => c.code === competency)?.code ?? competencies[0].code;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/admin/referentiels/${id}`}
        className="text-sm text-[var(--muted)] hover:underline"
      >
        ← {fw.nom}
      </Link>
      <h2 className="mt-2 text-lg font-semibold">Nouvelle carte d&apos;exercice</h2>

      <DrillEditor
        frameworkId={id}
        competencies={competencies.map((c) => ({ code: c.code, nom: c.nom }))}
        defaultCompetency={selected}
        aiAvailable={isEvaluatorConfigured()}
      />
    </div>
  );
}
