"use client";

import { useActionState } from "react";
import { Gift } from "lucide-react";
import { sendOffer, type OfferResult } from "./actions";

export default function OfferButton({
  userId,
  offers,
}: {
  userId: string;
  offers: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<OfferResult | null, FormData>(
    sendOffer,
    null,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action} className="flex items-center gap-1">
        <input type="hidden" name="userId" value={userId} />
        <select
          name="offerId"
          className="rounded border border-[var(--border)] px-2 py-1 text-xs"
        >
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          <Gift className="h-3.5 w-3.5" /> {pending ? "…" : "Faire une offre"}
        </button>
      </form>
      {state && (
        <span
          className={`text-[11px] ${state.ok ? "text-green-700" : "text-red-600"}`}
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
