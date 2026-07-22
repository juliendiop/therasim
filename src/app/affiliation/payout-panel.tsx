"use client";

import { useActionState } from "react";
import { requestPayoutAction, markInvoiceSentAction, type PayoutActionResult } from "./actions";
import { AFFILIATION_DASHBOARD } from "@/lib/affiliation-copy";

type ActiveRequest = { id: string; status: string; amountCents: number } | null;

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".00", "");
}

export default function PayoutPanel({
  balanceCents,
  payoutMinCents,
  activeRequest,
}: {
  balanceCents: number;
  payoutMinCents: number;
  activeRequest: ActiveRequest;
}) {
  const [requestState, requestAction, requestPending] = useActionState<
    PayoutActionResult | null,
    FormData
  >(requestPayoutAction, null);
  const [sentState, sentAction, sentPending] = useActionState<PayoutActionResult | null, FormData>(
    markInvoiceSentAction,
    null,
  );

  const eligible = balanceCents >= payoutMinCents;

  // Une demande vient d'être créée dans cette même session (state local) : on
  // l'affiche même avant que la page ne se recharge depuis le serveur.
  const showInstructions = activeRequest?.status === "pending" || (requestState?.ok && !activeRequest);
  const amountCents = activeRequest?.amountCents ?? balanceCents;

  if (activeRequest?.status === "invoice_received") {
    return (
      <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm">
        {AFFILIATION_DASHBOARD.payoutPendingNote}
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <p className="text-sm">
          {AFFILIATION_DASHBOARD.payoutInstructions.replace(
            "{MONTANT}",
            formatEuros(amountCents),
          )}
        </p>
        <form action={sentAction} className="mt-3">
          <button
            disabled={sentPending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {sentPending ? "…" : AFFILIATION_DASHBOARD.payoutInvoiceSentCta}
          </button>
        </form>
        {sentState && (
          <p
            className={`mt-2 text-sm ${sentState.ok ? "text-green-700" : "text-red-700"}`}
          >
            {sentState.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <form action={requestAction}>
        <button
          disabled={!eligible || requestPending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {requestPending ? "…" : AFFILIATION_DASHBOARD.payoutCta}
        </button>
      </form>
      {!eligible && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {AFFILIATION_DASHBOARD.payoutBelowThreshold.replace(
            "{SEUIL}",
            formatEuros(payoutMinCents),
          )}
        </p>
      )}
      {requestState && !requestState.ok && (
        <p className="mt-2 text-sm text-red-700">{requestState.message}</p>
      )}
    </div>
  );
}
