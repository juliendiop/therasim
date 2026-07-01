"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { createMemberInvite, type MemberResult } from "./actions";

/** Bouton par membre : (re)génère un lien de connexion et permet de le copier. */
export default function MemberInvite({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState<MemberResult | null, FormData>(
    createMemberInvite,
    null,
  );
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {state?.inviteLink ? (
        <>
          <button
            type="button"
            onClick={() => copy(state.inviteLink!)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié" : "Copier le lien"}
          </button>
          <span className="text-[11px] text-[var(--muted)]">
            {state.emailSent ? "Envoyé par email ✓" : "Valable 7 jours"}
          </span>
        </>
      ) : (
        <form action={action}>
          <input type="hidden" name="id" value={memberId} />
          <button
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" /> {pending ? "…" : "Lien de connexion"}
          </button>
        </form>
      )}
    </div>
  );
}
