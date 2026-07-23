"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Sparkles, Send } from "lucide-react";
import {
  assistAction,
  replyAsAdminAction,
  type AssistState,
  type AdminReplyState,
} from "../actions";

/**
 * Aide IA + réponse, dans un même composant : le projet de réponse doit remplir la
 * zone de texte tout en restant librement modifiable. C'est le contenu de la zone au
 * moment du clic qui est envoyé — jamais la sortie brute de l'IA.
 *
 * Rien de ce que produit l'IA n'est persisté : tout vit dans l'état local et
 * disparaît à la navigation.
 */
export default function AssistPanel({
  ticketId,
  closed,
}: {
  ticketId: string;
  closed: boolean;
}) {
  const [assistState, runAssist, assisting] = useActionState<AssistState, FormData>(
    assistAction,
    null,
  );
  const [replyState, sendReply, sending] = useActionState<AdminReplyState, FormData>(
    replyAsAdminAction,
    null,
  );
  const [draft, setDraft] = useState("");

  // Le projet arrive : on remplit la zone, sans écraser une saisie déjà commencée.
  const proposed = assistState?.assist?.draftReply ?? "";
  useEffect(() => {
    if (proposed && draft.trim() === "") setDraft(proposed);
    // On ne dépend volontairement pas de `draft` : ne réagir qu'à l'arrivée du projet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposed]);

  const assist = assistState?.assist;

  return (
    <div className="space-y-4">
      {/* --- Sollicitation de l'IA (jamais automatique) --- */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Aide IA</h3>
            <p className="text-xs text-[var(--muted)]">
              Analyse, informations manquantes, projet de réponse et brief. Une seule
              sollicitation, déclenchée par ce bouton.
            </p>
          </div>
          <form action={runAssist}>
            <input type="hidden" name="ticketId" value={ticketId} />
            <button
              disabled={assisting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {assisting ? "Analyse…" : assist ? "Relancer" : "Demander l'aide de l'IA"}
            </button>
          </form>
        </div>

        {assistState && !assistState.ok && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {assistState.message}
          </p>
        )}

        {assist && (
          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Analyse
              </div>
              <p className="mt-1 whitespace-pre-line text-sm">{assist.analysis}</p>
            </div>

            {assist.missingInfo.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ochre)]">
                  Informations manquantes
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {assist.missingInfo.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {assist.fixBrief && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Brief de correction (hypothèses à vérifier)
                </div>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-tint)] p-3 text-xs leading-relaxed">
                  {assist.fixBrief}
                </pre>
              </div>
            )}

            <p className="text-xs text-[var(--muted)]">
              Rien de tout ceci n&apos;est conservé : en quittant la page, l&apos;analyse
              disparaît.
            </p>
          </div>
        )}
      </div>

      {/* --- Réponse au client --- */}
      {closed ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-4 text-sm text-[var(--muted)]">
          Demande close. Rouvre-la pour répondre.
        </p>
      ) : (
        <form action={sendReply} className="rounded-xl border border-[var(--border)] bg-white p-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <label className="text-sm font-semibold">Réponse au client</label>
          <textarea
            name="body"
            required
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ta réponse. Le projet de l'IA, s'il y en a un, apparaît ici et reste modifiable."
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" name="close" /> clore la demande après envoi
            </label>
            <button
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Envoi…" : "Envoyer au client"}
            </button>
          </div>
          {replyState && (
            <p
              className={`mt-2 text-sm ${replyState.ok ? "text-green-700" : "text-red-700"}`}
            >
              {replyState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
