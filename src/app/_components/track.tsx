"use client";

// Beacon d'entonnoir : envoie UNE fois un événement anonyme au montage.
// Ultra-léger (un seul fetch, pas de dépendance). Anti-doublon par event+path
// à l'échelle du module (survit aux re-render, pas aux rechargements complets —
// ce qui correspond bien à « une vue = un chargement de page »).
import { useEffect } from "react";

const sent = new Set<string>();

export function trackEvent(event: string, path?: string) {
  const key = `${event}|${path ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);
  // keepalive : l'envoi survit à une navigation immédiate.
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, path }),
    keepalive: true,
  }).catch(() => {
    sent.delete(key); // échec réseau : autorise une nouvelle tentative
  });
}

export default function Track({ event, path }: { event: string; path?: string }) {
  useEffect(() => {
    trackEvent(event, path);
  }, [event, path]);
  return null;
}
