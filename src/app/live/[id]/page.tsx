import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { Brain } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isLiveOpen } from "@/lib/live";
import { publicDrill } from "@/lib/drill-view";
import { joinLive } from "./actions";
import LivePlayer from "./live-player";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.liveSession.findUnique({ where: { id } });

  // Cadre commun (branding couleur du tenant de la session).
  const tenant = session
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId } })
    : null;
  const isPublic = !tenant || tenant.type === "public";
  const brandName = isPublic ? "TheraSim" : tenant!.brandName || tenant!.nom;
  const color =
    !isPublic && tenant!.colorPrimary && HEX.test(tenant!.colorPrimary)
      ? tenant!.colorPrimary
      : null;
  const style = color ? ({ "--accent": color } as CSSProperties) : undefined;

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div style={style} className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
          <Brain className="h-5 w-5 text-[var(--accent)]" /> {brandName}
        </div>
        {children}
      </div>
    );
  }

  if (!session) {
    return (
      <Shell>
        <Msg titre="Session introuvable" texte="Ce lien n'est pas (ou plus) valide." />
      </Shell>
    );
  }

  if (session.statut === "brouillon") {
    return (
      <Shell>
        <Msg
          titre={session.titre}
          texte="La session n'a pas encore démarré. Patientez : le formateur va la lancer."
        />
      </Shell>
    );
  }

  if (!isLiveOpen(session)) {
    return (
      <Shell>
        <Msg titre={session.titre} texte="Session terminée. Merci de votre participation !" />
      </Shell>
    );
  }

  // Session ouverte : participant déjà inscrit ?
  const participantId = (await cookies()).get(`lp_${id}`)?.value;
  const participant = participantId
    ? await prisma.liveParticipant.findUnique({ where: { id: participantId } })
    : null;

  if (!participant || participant.sessionId !== id) {
    // Formulaire pour rejoindre.
    return (
      <Shell>
        <div className="card-soft p-6 text-center">
          <h1 className="text-xl font-semibold">{session.titre}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Entrez votre nom pour commencer l&apos;étude de cas.
          </p>
          <form action={joinLive} className="mx-auto mt-5 max-w-sm space-y-3 text-left">
            <input type="hidden" name="sessionId" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <input
                name="prenom"
                required
                placeholder="Prénom"
                className="rounded-lg border border-[var(--border)] p-2.5 text-sm"
              />
              <input
                name="nom"
                required
                placeholder="Nom"
                className="rounded-lg border border-[var(--border)] p-2.5 text-sm"
              />
            </div>
            <button className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              Commencer
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // Inscrit : on charge les questions (mêmes pour tous) + ses réponses déjà données.
  const drillIds = session.drillIds as string[];
  const drills = await prisma.drill.findMany({ where: { id: { in: drillIds } } });
  const byId = new Map(drills.map((d) => [d.id, d]));
  const questions = drillIds
    .map((did) => byId.get(did))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((d) => publicDrill(d));

  const answered = await prisma.liveAnswer.findMany({
    where: { participantId: participant.id },
    select: { drillId: true },
  });

  return (
    <div style={style}>
      <LivePlayer
        sessionId={id}
        titre={session.titre}
        mode={session.mode as "apprentissage" | "evaluation"}
        closesAt={session.closesAt ? session.closesAt.toISOString() : null}
        prenom={participant.prenom}
        questions={questions}
        answeredDrillIds={answered.map((a) => a.drillId)}
      />
    </div>
  );
}

function Msg({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="card-soft p-8 text-center">
      <h1 className="text-lg font-semibold">{titre}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{texte}</p>
    </div>
  );
}
