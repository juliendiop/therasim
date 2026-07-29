"use client";

// Pré-check CLIENT (instantané) des deux mises en situation payantes. Si le solde
// connu suffit, on lance normalement (l'action serveur reste l'autorité). Sinon on
// ouvre la modale via `?creditwall=` — la même que la garde serveur. Sur un compte
// « sans compter » (isUnlimited), aucun blocage.
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { startMiniSceneAction } from "@/app/sim/actions";
import SubmitButton from "@/app/_components/submit-button";

type Common = {
  frameworkId: string;
  total: number;
  isUnlimited: boolean;
};

/** Bouton « Lancer une mini-scène » (N2, coût = costMini). */
export function MiniSceneLauncher({
  frameworkId,
  total,
  isUnlimited,
  costMini,
}: Common & { costMini: number }) {
  const router = useRouter();
  const blocked = !isUnlimited && total < costMini;

  return (
    <form
      action={startMiniSceneAction}
      onSubmit={(e) => {
        if (blocked) {
          e.preventDefault();
          router.push(`/f/${frameworkId}?creditwall=miniscene`, { scroll: false });
        }
      }}
    >
      <input type="hidden" name="frameworkId" value={frameworkId} />
      <SubmitButton
        pendingText="Lancement…"
        className="w-full rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        Lancer une mini-scène
      </SubmitButton>
    </form>
  );
}

/** Bouton « Démarrer une séance » (N3). Bloqué si : abonné sans crédits, ou Découverte
 *  ayant déjà consommé sa séance à vie. Découverte avec séance dispo -> passe (gratuite). */
export function SeanceLauncher({
  frameworkId,
  total,
  isUnlimited,
  costSim,
  entitledSub,
  discoveryAvailable,
}: Common & { costSim: number; entitledSub: boolean; discoveryAvailable: boolean }) {
  const router = useRouter();
  const [going, setGoing] = useState(false);

  const blocked =
    !isUnlimited &&
    (entitledSub ? total < costSim : !discoveryAvailable);

  function go() {
    if (blocked) {
      router.push(`/f/${frameworkId}?creditwall=simulation`, { scroll: false });
      return;
    }
    setGoing(true);
    router.push(`/f/${frameworkId}/simulation`);
  }

  return (
    <button
      onClick={go}
      disabled={going}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
    >
      {going && <Loader2 className="h-4 w-4 animate-spin" />} Démarrer une séance
    </button>
  );
}
