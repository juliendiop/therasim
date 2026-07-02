import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { publicDrill } from "@/lib/drill-view";
import DrillPlayer from "./drill-player";

export const dynamic = "force-dynamic";

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { id } = await params;
  const { focus } = await searchParams;
  const user = await requireUser();
  const drill = await prisma.drill.findUnique({ where: { id } });
  if (!drill) notFound();
  // L'utilisateur doit avoir débloqué le référentiel du drill (paywall sinon).
  if (!(await userCanAccess(user, drill.frameworkId))) redirect(`/f/${drill.frameworkId}`);

  // key={id} : force la réinitialisation du lecteur quand on passe à l'exercice suivant.
  // On ne passe au client QUE la vue publique (aucun corrigé).
  return <DrillPlayer key={id} drill={publicDrill(drill)} focusCompetency={focus ?? null} />;
}
