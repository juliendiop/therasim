"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createMember, type MemberResult } from "./actions";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

export default function AddMemberForm() {
  const [state, action, pending] = useActionState<MemberResult | null, FormData>(
    createMember,
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
    <div>
      <form
        action={action}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-white p-4"
      >
        <div className="flex-1">
          <label className="text-xs font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="personne@exemple.fr"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Rôle</label>
          <select
            name="role"
            defaultValue="formateur"
            className="mt-1 rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Ajouter & inviter"}
        </button>
      </form>

      {state && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            state.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p>{state.message}</p>
          {state.inviteLink && (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={state.inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border border-[var(--border)] bg-white p-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => copy(state.inviteLink!)}
                className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-medium hover:border-[var(--accent)]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
