"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Lobby({
  sessionId,
  prenom,
  titre,
}: {
  sessionId: string;
  prenom: string;
  titre: string;
}) {
  const router = useRouter();

  // Détecte le démarrage du compte à rebours par le formateur.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${sessionId}/status`, { cache: "no-store" });
        const data = await res.json();
        if (data.statut === "en_cours" || data.statut === "fermee") router.refresh();
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [sessionId, router]);

  return (
    <div className="card-soft p-8 text-center">
      <h1 className="text-lg font-semibold">{titre}</h1>
      <p className="mt-2 text-sm">
        Vous êtes bien inscrit·e, <b>{prenom}</b>.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 text-[var(--accent)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">En attente du démarrage par le formateur…</span>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        L&apos;étude de cas commencera dès que le formateur lance le compte à rebours.
      </p>
    </div>
  );
}
