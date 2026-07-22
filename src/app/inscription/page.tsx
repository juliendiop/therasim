"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, Check, Mail, UserPlus } from "lucide-react";
import { trackEvent } from "@/app/_components/track";

type Mode = "password" | "magic";

export default function InscriptionPage() {
  return (
    <Suspense>
      <InscriptionForm />
    </Suspense>
  );
}

function InscriptionForm() {
  // Forfait choisi sur /tarifs (repris après création de compte).
  const planId = useSearchParams().get("plan");
  // Mesure d'entonnoir : arrivée sur la page d'inscription (visiteur anonyme).
  useEffect(() => {
    trackEvent("signup_start", "/inscription");
  }, []);
  const [mode, setMode] = useState<Mode>("password");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Merci d'accepter les conditions pour créer votre compte.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, email, password, consent, planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      // Rechargement COMPLET : le layout serveur doit relire le cookie de session.
      window.location.assign(data.redirect ?? "/accueil?bienvenue=1");
      return;
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Merci d'accepter les conditions pour créer votre compte.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planId }),
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

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]";

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

  return (
    <div className="mx-auto mt-10 max-w-sm animate-in">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md">
          <Brain className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Créer votre compte</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Gratuit, sans carte bancaire. Commencez à vous entraîner en une minute.
        </p>
      </div>

      {/* Réassurance : ce qu'on obtient */}
      <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-sm text-[var(--ink-soft)]">
        <Bullet>Un domaine clinique offert, exercices illimités</Bullet>
        <Bullet>Des crédits offerts pour les mises en situation avec IA</Bullet>
        <Bullet>Votre carte de progression, compétence par compétence</Bullet>
      </ul>

      <div className="card-soft mt-6 p-6">
        {sent ? (
          <div className="text-sm">
            <p className="font-medium text-green-700">Lien envoyé ✓</p>
            <p className="mt-1 text-[var(--muted)]">
              Vérifiez votre boîte mail et cliquez sur le lien pour activer votre compte.
            </p>
            {devLink && (
              <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  Mode développement — lien direct :
                </p>
                <a href={devLink} className="mt-1 block break-all text-xs text-[var(--accent)] underline">
                  {devLink}
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
              {tab("password", "Mot de passe")}
              {tab("magic", "Lien par email")}
            </div>

            <form onSubmit={mode === "password" ? register : sendMagic}>
              <label className="text-xs font-medium">Prénom</label>
              <input
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Marie"
                className={inputCls}
              />

              <label className="mt-3 block text-xs font-medium">Email</label>
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

              {mode === "password" && (
                <>
                  <label className="mt-3 block text-xs font-medium">Mot de passe</label>
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
                </>
              )}

              {mode === "magic" && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Vous recevrez un lien pour activer votre compte, sans mot de passe.
                </p>
              )}

              <label className="mt-4 flex items-start gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  J&apos;accepte que mes données soient traitées pour le fonctionnement du
                  service. MELETA est un outil formatif, non certifiant ; les cas sont fictifs.
                </span>
              </label>

              <button
                disabled={loading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {mode === "password" ? (
                  <>
                    <UserPlus className="h-4 w-4" /> {loading ? "Création…" : "Créer mon compte"}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" /> {loading ? "Envoi…" : "Recevoir mon lien"}
                  </>
                )}
              </button>
            </form>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
      <span>{children}</span>
    </li>
  );
}
