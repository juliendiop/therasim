"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Bloc de prompt copiable en un clic (à coller dans une IA de dev). */
export default function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible : l'utilisateur peut sélectionner le texte à la main */
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-tint)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Prompt à copier dans votre IA de dev
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:border-[var(--accent)]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2.5 text-xs leading-relaxed text-[var(--ink-soft)]">
        {text}
      </pre>
    </div>
  );
}
