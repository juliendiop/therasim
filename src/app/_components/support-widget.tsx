"use client";

// Ouverture d'un ticket depuis N'IMPORTE QUELLE page, sans quitter ce qu'on fait :
// le bouton vit dans l'en-tête (donc dans le layout racine) et ouvre une modale.
// La page courante est relevée à l'envoi et jointe au contexte technique.

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, X } from "lucide-react";
import { createTicketAction, type SupportFormState } from "@/app/support/actions";
import { SUBJECT_MAX, BODY_MAX } from "@/lib/support-types";

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [state, action, pending] = useActionState<SupportFormState, FormData>(
    createTicketAction,
    null,
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fermeture au clavier : une modale qui ne se ferme qu'à la souris est une impasse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const sent = Boolean(state?.ok);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Signaler un problème ou proposer une amélioration"
        aria-label="Aide et signalements"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:px-2.5"
      >
        <LifeBuoy className="h-4 w-4" />
        <span className="hidden lg:inline">Aide</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            // Fermeture au clic sur le fond, jamais sur le contenu.
            if (!dialogRef.current?.contains(e.target as Node)) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Nouvelle demande"
            className="w-full max-w-lg rounded-t-2xl border border-[var(--border)] bg-white p-5 shadow-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Une anomalie ? Une idée ?</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Dis-nous en deux lignes. On relève automatiquement le contexte technique.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-lg p-1 text-[var(--muted)] hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="mt-5">
                <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  Message bien reçu. On te répond par email, et l&apos;échange se poursuit dans
                  l&apos;application.
                </p>
                <div className="mt-4 flex gap-2">
                  {state?.ticketId && (
                    <Link
                      href={`/support/${state.ticketId}`}
                      onClick={() => setOpen(false)}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                    >
                      Voir ma demande
                    </Link>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                  >
                    Reprendre où j&apos;en étais
                  </button>
                </div>
              </div>
            ) : (
              <form action={action} className="mt-4 space-y-3">
                {/* Contexte : page courante, relevée sans que l'utilisateur la saisisse. */}
                <input type="hidden" name="page" value={pathname} />

                <div>
                  <label className="text-xs font-medium">Type de demande</label>
                  <select
                    name="type"
                    defaultValue="bug"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
                  >
                    <option value="bug">Signaler une anomalie</option>
                    <option value="idea">Proposer une amélioration</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium">Sujet</label>
                  <input
                    name="subject"
                    required
                    maxLength={SUBJECT_MAX}
                    placeholder="En quelques mots"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium">Description</label>
                  <textarea
                    name="body"
                    required
                    rows={5}
                    maxLength={BODY_MAX}
                    placeholder="Ce que tu faisais, ce que tu attendais, ce qui s'est passé."
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
                  />
                </div>

                {state && !state.ok && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {state.message}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Link
                    href="/support"
                    onClick={() => setOpen(false)}
                    className="text-sm text-[var(--muted)] underline hover:text-[var(--foreground)]"
                  >
                    Mes demandes
                  </Link>
                  <button
                    disabled={pending}
                    className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {pending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
