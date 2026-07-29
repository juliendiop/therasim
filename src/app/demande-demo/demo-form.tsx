"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitDemoRequest, type DemoRequestState } from "./actions";

const initialState: DemoRequestState = { ok: false, message: "" };

export default function DemoRequestForm() {
  const [state, formAction, pending] = useActionState(submitDemoRequest, initialState);

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]";

  // Confirmation explicite : ce qui a été fait, ce qui va se passer, et quoi faire
  // si rien n'arrive — un simple « envoyé ✓ » laisse le visiteur sans repère.
  if (state.ok) {
    return (
      <div className="card-soft p-6 text-sm">
        <p className="flex items-center gap-2 font-semibold text-green-700">
          <CheckCircle2 className="h-5 w-5" /> Votre demande est bien envoyée
        </p>
        <p className="mt-2 text-[var(--ink-soft)]">{state.message}</p>
        <ul className="mt-3 space-y-1.5 text-[var(--muted)]">
          <li className="flex gap-2">
            <span className="text-[var(--accent)]">1.</span> Nous étudions votre besoin et
            préparons une démonstration adaptée à votre établissement.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--accent)]">2.</span> Vous recevez notre réponse par
            email <b>sous 2 jours ouvrés</b>, avec des créneaux de rendez-vous.
          </li>
        </ul>
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
          Sans nouvelle de notre part passé ce délai, pensez à vérifier vos indésirables, ou
          écrivez-nous directement à{" "}
          <a href="mailto:contact@meleta.app" className="underline">
            contact@meleta.app
          </a>
          .
        </p>
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
