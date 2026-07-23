// Limitation de débit adossée à la base.
//
// Pourquoi pas un compteur en mémoire : sur Vercel, chaque instance de fonction a
// sa propre mémoire et le nombre d'instances varie — un compteur en RAM ne limite
// donc rien en pratique. Pourquoi pas Upstash/Redis : ce serait un service et une
// dépendance de plus pour un besoin qui se compte en dizaines d'appels.

import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export type RateLimitResult = { ok: boolean; remaining: number };

/**
 * Enregistre une tentative et indique si le quota est dépassé sur la fenêtre.
 *
 * Note d'honnêteté : le couple compter-puis-insérer n'est pas atomique, donc sous
 * forte concurrence quelques tentatives peuvent passer au-delà du seuil. C'est
 * sans importance ici : l'objectif est d'empêcher le balayage de codes (des
 * milliers d'essais), pas de garantir un compte exact à l'unité près.
 */
export async function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - opts.windowMs);
  try {
    const count = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gte: since } },
    });
    if (count >= opts.max) return { ok: false, remaining: 0 };

    await prisma.rateLimitHit.create({ data: { key } });

    // Purge opportuniste (~2 % des appels) : évite d'avoir à câbler un cron pour
    // une table de rétention courte.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - Math.max(opts.windowMs, 24 * 60 * 60 * 1000));
      await prisma.rateLimitHit
        .deleteMany({ where: { createdAt: { lt: cutoff } } })
        .catch(() => {});
    }

    return { ok: true, remaining: Math.max(0, opts.max - count - 1) };
  } catch (e) {
    // Un incident de base ne doit pas bloquer un utilisateur légitime.
    console.error("[rate-limit] échec, on laisse passer", key, e);
    return { ok: true, remaining: 0 };
  }
}

/**
 * IP de l'appelant, depuis les en-têtes posés par le proxy Vercel.
 * `x-forwarded-for` peut contenir une chaîne d'IP : la première est le client.
 */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
