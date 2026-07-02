"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      router.push(data.redirect ?? "/accueil");
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="text-xs font-medium">Nouveau mot de passe</label>
      <input
        type="password"
        name="new-password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="8 caractères minimum"
        className={inputCls}
      />
      <label className="mt-3 block text-xs font-medium">Confirmez le mot de passe</label>
      <input
        type="password"
        name="confirm-password"
        autoComplete="new-password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
        className={inputCls}
      />
      <button
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" />
        {loading ? "Enregistrement…" : "Définir le mot de passe"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-center">
        <Link href="/login" className="text-xs text-[var(--muted)] underline">
          ← Revenir à la connexion
        </Link>
      </p>
    </form>
  );
}
