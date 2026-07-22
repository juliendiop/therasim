"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { submitDemoRequest, type DemoRequestState } from "./actions";

const initialState: DemoRequestState = { ok: false, message: "" };

export default function DemoRequestForm() {
  const [state, formAction, pending] = useActionState(submitDemoRequest, initialState);

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]";

  if (state.ok) {
    return (
      <div className="card-soft p-6 text-center text-sm">
        <p className="font-medium text-green-700">Demande envoyée ✓</p>
        <p className="mt-1 text-[var(--muted)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-soft space-y-3 p-6">
      <div>
        <label className="text-xs font-medium">Votre nom</label>
        <input name="nom" required className={inputCls} placeholder="Jeanne Dupont" />
      </div>
      <div>
        <label className="text-xs font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          className={inputCls}
          placeholder="jeanne@ecole.fr"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Établissement</label>
        <input
          name="organisme"
          className={inputCls}
          placeholder="Institut de formation… (optionnel)"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Votre besoin (optionnel)</label>
        <textarea
          name="message"
          rows={3}
          className={inputCls}
          placeholder="Nombre d'apprenants, référentiels visés, calendrier…"
        />
      </div>
      <div>
        <label className="text-xs font-medium">
          Recommandé par (nom ou email de votre ambassadeur MELETA — optionnel)
        </label>
        <input
          name="parrainage"
          className={inputCls}
          placeholder="ex. Jeanne Dupont ou jeanne@exemple.fr"
        />
      </div>
      <button
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {pending ? "Envoi…" : "Envoyer la demande"}
      </button>
      {!state.ok && state.message && (
        <p className="text-center text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
