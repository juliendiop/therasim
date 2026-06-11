"use client";

import { useState } from "react";
import { Brain, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setSent(true);
      setDevLink(data.devLink ?? null);
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="flex items-center justify-center gap-2 text-lg font-semibold">
        <Brain className="h-6 w-6 text-[var(--accent)]" /> TheraSim
      </div>
      <p className="mt-1 text-center text-sm text-[var(--muted)]">
        Entraînement clinique par compétences
      </p>

      <div className="mt-8 rounded-xl border border-[var(--border)] bg-white p-6">
        {!sent ? (
          <form onSubmit={submit}>
            <label className="text-sm font-medium">Connexion par lien magique</label>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Entrez votre email : vous recevrez un lien de connexion (sans mot de passe).
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              className="mt-3 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              disabled={loading}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" /> {loading ? "Envoi…" : "Recevoir le lien"}
            </button>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        ) : (
          <div className="text-sm">
            <p className="font-medium text-green-700">Lien envoyé ✓</p>
            <p className="mt-1 text-[var(--muted)]">
              Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter.
            </p>
            {devLink && (
              <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  Mode développement — pas d&apos;email configuré. Lien direct :
                </p>
                <a
                  href={devLink}
                  className="mt-1 block break-all text-xs text-[var(--accent)] underline"
                >
                  {devLink}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
