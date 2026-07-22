"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Bouton « Copier » pour le lien de parrainage, affiché à côté du lien en clair. */
export default function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible : le lien reste sélectionnable à la main */
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copié" : "Copier le lien"}
    </button>
  );
}
