"use client";

// Modale UNIQUE des deux murs (crédits insuffisants / séance complète découverte
// épuisée). Ouverte par le paramètre d'URL `?creditwall=simulation|miniscene` — posé
// soit par le pré-check client (instantané), soit par la garde serveur en repli. Les
// données (mur autoritaire + solde FRAIS + options) viennent de /api/me/credits-wall,
// donc le pré-check périmé (autre onglet, recharge) est corrigé à l'ouverture.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Coins, Sparkles, X } from "lucide-react";
import { checkoutPackAction, checkoutPlanAction } from "@/app/credits/actions";

type WallData = {
  show: boolean;
  wall?: "credits" | "level3";
  kind?: string;
  plan?: string;
  canRecharge?: boolean;
  recharge?: { packId: string; credits: number; priceEurCents: number; perCreditCents: number } | null;
  upgrade?: {
    planId: string;
    label: string;
    monthlyCredits: number | null;
    priceEurCents: number;
    perCreditCents: number | null;
    specialties: string;
  } | null;
  total?: number;
  cost?: number;
};

const eur = (cents: number) => (cents / 100).toFixed(2).replace(".00", "");
const perCredit = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €/crédit`;

export default function CreditsWall() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kind = params.get("creditwall"); // "simulation" | "miniscene" | null
  const [data, setData] = useState<WallData | null>(null);

  const close = useCallback(() => {
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.delete("creditwall");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    setData(null);
  }, [params, pathname, router]);

  useEffect(() => {
    if (!kind) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/me/credits-wall?kind=${encodeURIComponent(kind)}`)
      .then((r) => r.json())
      .then((d: WallData) => {
        if (cancelled) return;
        if (!d.show) close();
        else setData(d);
      })
      .catch(() => {
        if (!cancelled) close();
      });
    return () => {
      cancelled = true;
    };
  }, [kind, close]);

  useEffect(() => {
    if (!data?.show) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [data, close]);

  if (!kind || !data?.show || typeof document === "undefined") return null;

  const isLevel3 = data.wall === "level3";
  const analytics = { wall: data.wall ?? "", plan: data.plan ?? "" };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Coins className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold">
                {isLevel3 ? "La séance complète est réservée aux abonnés" : "Il vous faut plus de crédits"}
              </h2>
            </div>
            <button
              onClick={close}
              aria-label="Fermer"
              className="rounded-md p-1 text-[var(--muted)] hover:bg-gray-100 hover:text-[var(--foreground)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {isLevel3
              ? "Vous avez déjà utilisé votre séance complète offerte à vie. Les exercices et mini-scènes restent ouverts ; un abonnement débloque les séances complètes."
              : `Cette ${data.kind === "miniscene" ? "mini-scène" : "séance"} coûte ${data.cost} crédit${(data.cost ?? 0) > 1 ? "s" : ""} — il vous en reste ${data.total}.`}
          </p>

          <div
            className={`mt-4 grid gap-3 ${data.recharge && data.upgrade ? "sm:grid-cols-2" : "grid-cols-1"}`}
          >
            {/* RECHARGER (abonnés uniquement, jamais sur le mur niveau 3) */}
            {data.recharge && !isLevel3 && (
              <form
                action={checkoutPackAction}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Recharger
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {data.recharge.credits}{" "}
                  <span className="text-sm font-normal text-[var(--muted)]">crédits</span>
                </div>
                <div className="text-sm font-semibold">{eur(data.recharge.priceEurCents)} €</div>
                <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {perCredit(data.recharge.perCreditCents)}
                </div>
                <input type="hidden" name="packId" value={data.recharge.packId} />
                <input type="hidden" name="cta" value="credits_recharge" />
                <input type="hidden" name="wall" value={analytics.wall} />
                <input type="hidden" name="plan" value={analytics.plan} />
                <button className="mt-3 w-full rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  Recharger maintenant
                </button>
              </form>
            )}

            {/* PASSER AU NIVEAU SUPÉRIEUR */}
            {data.upgrade ? (
              <form
                action={checkoutPlanAction}
                className="flex flex-col rounded-xl border border-[var(--accent)] bg-white p-4"
              >
                <div className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  <Sparkles className="h-3.5 w-3.5" /> {data.upgrade.label}
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {eur(data.upgrade.priceEurCents)} €
                  <span className="text-sm font-normal text-[var(--muted)]">/mois</span>
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {data.upgrade.monthlyCredits == null
                    ? "Séances sans compter"
                    : `${data.upgrade.monthlyCredits} crédits/mois`}
                  {data.upgrade.perCreditCents != null && (
                    <span className="text-[11px]"> · {perCredit(data.upgrade.perCreditCents)}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--muted)]">{data.upgrade.specialties}</div>
                <input type="hidden" name="planId" value={data.upgrade.planId} />
                <input type="hidden" name="cycle" value="monthly" />
                <input type="hidden" name="cta" value="credits_upgrade" />
                <input type="hidden" name="wall" value={analytics.wall} />
                <input type="hidden" name="plan" value={analytics.plan} />
                <button className="mt-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
                  Passer à {data.upgrade.label}
                </button>
              </form>
            ) : (
              !data.recharge && (
                <p className="text-sm text-[var(--muted)]">
                  <Link href="/tarifs" className="font-medium text-[var(--accent)] hover:underline">
                    Voir les forfaits
                  </Link>
                </p>
              )
            )}
          </div>

          <button
            onClick={close}
            className="mt-4 w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
