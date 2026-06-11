import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import { publicDrill } from "@/lib/drill-view";
import DrillPlayer from "./drill-player";

export const dynamic = "force-dynamic";

export default async function DrillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const drill = await prisma.drill.findUnique({ where: { id } });
  if (!drill) notFound();
  // Le tenant doit avoir accès au référentiel du drill.
  if (!(await tenantCanAccess(user.tenantId, drill.frameworkId))) notFound();

  // On ne passe au client QUE la vue publique (aucun corrigé).
  return <DrillPlayer drill={publicDrill(drill)} />;
}
