import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Play, Square } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getLiveResults, roleCanManageLive } from "@/lib/live";
import { closeSessionAction, startSessionAction } from "../actions";
import LiveDashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function SessionManage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!roleCanManageLive(user.role)) redirect("/catalogue");

  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session || session.tenantId !== user.tenantId) notFound();

  const framework = await prisma.framework.findUnique({
    where: { id: session.frameworkId },
  });
  const results = await getLiveResults(id);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const base = process.env.APP_BASE_URL || `${proto}://${host}`;
  const joinUrl = `${base}/live/${id}`;

  return (
    <div>
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Sessions live
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{session.titre}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {framework?.nom} · {(session.competencies as string[]).length} compétence(s) ·{" "}
            {session.mode === "apprentissage" ? "mode apprentissage" : "mode évaluation"} ·{" "}
            {session.durationMin} min
          </p>
        </div>

        {session.statut === "brouillon" && (
          <form action={startSessionAction}>
            <input type="hidden" name="id" value={id} />
            <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
              <Play className="h-4 w-4" /> Démarrer la session
            </button>
          </form>
        )}
        {session.statut === "ouverte" && (
          <form action={closeSessionAction}>
            <input type="hidden" name="id" value={id} />
            <button className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              <Square className="h-4 w-4" /> Fermer maintenant
            </button>
          </form>
        )}
        {session.statut === "fermee" && (
          <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-[var(--muted)]">
            Session terminée
          </span>
        )}
      </div>

      {session.statut === "brouillon" ? (
        <div className="mt-6 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 text-sm">
          Cette session est en <b>brouillon</b>. Cliquez sur <b>Démarrer</b> pour lancer le
          compte à rebours et ouvrir le lien aux participants. Vous pourrez partager le lien
          ci-dessous dès qu&apos;elle est ouverte.
        </div>
      ) : (
        <div className="mt-6">
          <LiveDashboard
            sessionId={id}
            joinUrl={joinUrl}
            initial={{
              statut: session.statut,
              mode: session.mode,
              closesAt: session.closesAt ? session.closesAt.toISOString() : null,
              results,
            }}
          />
        </div>
      )}
    </div>
  );
}
