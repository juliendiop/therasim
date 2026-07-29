import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWalletView, creditSettings, isUnlimited, getCreditPacks } from "@/lib/credits";
import { resolveB2CEntitlement } from "@/lib/entitlements";
import { recordInteraction } from "@/lib/funnel";

export const dynamic = "force-dynamic";

// GET /api/me/credits-wall?kind=simulation|miniscene
// Recalcule AUTORITAIREMENT (solde frais) le mur de blocage et les options. Sert la
// modale — le pré-check client pouvant être périmé (autre onglet, recharge mensuelle).
// Ne montre JAMAIS rien sur un compte « sans compter ». Les deux murs (crédits / niveau 3)
// sont exclusifs.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ show: false }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind") === "miniscene" ? "miniscene" : "simulation";

  if (await isUnlimited(user.id)) return NextResponse.json({ show: false });

  const [settings, wallet, ent, u] = await Promise.all([
    creditSettings(),
    getWalletView(user.id),
    resolveB2CEntitlement(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { discoveryInterviewUsedAt: true },
    }),
  ]);
  const cost = kind === "simulation" ? settings.costSimulation : settings.costMiniscene;

  // Mur déclencheur (exclusif) : niveau 3 découverte épuisé OU solde insuffisant.
  let wall: "credits" | "level3" | null = null;
  if (kind === "simulation" && !ent.entitledSub && u?.discoveryInterviewUsedAt) {
    wall = "level3";
  } else if (wallet.total < cost) {
    wall = "credits";
  }
  if (!wall) return NextResponse.json({ show: false });

  const canRecharge = ent.entitledSub; // recharge réservée aux abonnés

  // Option RECHARGER (abonnés) : le plus petit pack disponible.
  let recharge:
    | { packId: string; credits: number; priceEurCents: number; perCreditCents: number }
    | null = null;
  if (canRecharge) {
    const packs = await getCreditPacks();
    const p = packs.find((x) => x.stripePriceId);
    if (p) {
      recharge = {
        packId: p.id,
        credits: p.credits,
        priceEurCents: p.priceEurCents,
        perCreditCents: p.priceEurCents / p.credits,
      };
    }
  }

  // Option PASSER AU NIVEAU SUPÉRIEUR : le forfait juste au-dessus (par prix).
  const plans = await prisma.subscriptionPlan.findMany({
    where: { active: true },
    orderBy: { priceEurCents: "asc" },
  });
  const currentPrice = ent.entitledSub
    ? plans.find((pl) => pl.key === ent.planKey)?.priceEurCents ?? 0
    : 0;
  const next = plans.find((pl) => pl.priceEurCents > currentPrice && pl.stripePriceId);
  let upgrade: {
    planId: string;
    label: string;
    monthlyCredits: number | null;
    priceEurCents: number;
    perCreditCents: number | null;
    specialties: string;
  } | null = null;
  if (next) {
    let specialties: string;
    if (next.frameworkQuota == null) {
      specialties = "toutes les spécialités actuelles";
    } else {
      const gained = next.frameworkQuota - (ent.quota ?? 0);
      specialties =
        gained > 0
          ? `+${gained} spécialité${gained > 1 ? "s" : ""}`
          : `${next.frameworkQuota} spécialité${next.frameworkQuota > 1 ? "s" : ""}`;
    }
    upgrade = {
      planId: next.id,
      label: next.label,
      monthlyCredits: next.monthlyCredits,
      priceEurCents: next.priceEurCents,
      perCreditCents: next.monthlyCredits ? next.priceEurCents / next.monthlyCredits : null,
      specialties,
    };
  }

  // Analytics : affichage du mur (mur déclencheur + plan au moment du déclenchement).
  await recordInteraction("credits_prompt_view", {
    userId: user.id,
    meta: { wall, kind, plan: ent.planKey },
  });

  return NextResponse.json({
    show: true,
    wall,
    kind,
    plan: ent.planKey,
    canRecharge,
    recharge,
    upgrade,
    total: wallet.total,
    cost,
  });
}
