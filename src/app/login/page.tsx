"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, LogIn, Mail } from "lucide-react";

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      router.push(data.redirect ?? "/catalogue");
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMagic(e: React.FormEvent) {
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
        setError(data.message ?? data.error ?? "Erreur");
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

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        mode === m
          ? "bg-white text-[var(--foreground)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <div className="mx-auto mt-12 max-w-sm animate-in">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md">
          <Brain className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">MELETA</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Entraînement clinique par compétences
        </p>
      </div>

      <div className="card-soft mt-8 p-6">
        {sent ? (
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
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-xs text-[var(--muted)] underline"
            >
              ← Revenir
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
              {tab("password", "Mot de passe")}
              {tab("magic", "Lien magique")}
            </div>

            {mode === "password" ? (
              <form onSubmit={loginPassword}>
                <label className="text-xs font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className={inputCls}
                />
                <label className="mt-3 block text-xs font-medium">Mot de passe</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                <button
                  disabled={loading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" /> {loading ? "Connexion…" : "Se connecter"}
                </button>
              </form>
            ) : (
              <form onSubmit={sendMagic}>
                <p className="text-xs text-[var(--muted)]">
                  Entrez votre email : vous recevrez un lien de connexion (sans mot de passe).
                </p>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className={inputCls}
                />
                <button
                  disabled={loading}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" /> {loading ? "Envoi…" : "Recevoir le lien"}
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
