"use client";

// Bandeau discret « il vous reste peu de crédits », affiché au plus une fois
// par session navigateur (sessionStorage — pas de réapparition tant que
// l'onglet reste ouvert, réapparaît dans un nouvel onglet/session).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, X } from "lucide-react";

const DISMISS_KEY = "ts_low_credits_dismissed_v1";

export default function LowCreditsBanner({
  credits,
  threshold,
}: {
  credits: number;
  threshold: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (credits <= 0 || credits > threshold) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, [credits, threshold]);

  if (!visible) return null;

  return (
    <div className="border-b border-[var(--accent-border)] bg-[var(--accent-soft)]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-2 text-sm text-[var(--ink-soft)]">
        <Coins className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="flex-1">
          Il vous reste <b>{credits}</b> crédit{credits > 1 ? "s" : ""}.{" "}
          <Link href="/tarifs" className="font-medium text-[var(--accent)] hover:underline">
            Voir les offres
          </Link>
        </span>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          aria-label="Fermer"
          className="shrink-0 rounded-md p-1 text-[var(--muted)] hover:bg-white/60 hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
