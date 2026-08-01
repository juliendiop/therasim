/**
 * Validation du cycle d'essai bêta (30 jours) avec une Test Clock Stripe.
 *
 * DEUX PASSES, car le point sensible dépend du mois d'ancrage :
 *   - Passe A — ancre en SEPTEMBRE (mois de 30 jours) : ancre+1 mois = J+30, soit
 *     l'instant EXACT de fin d'essai → course entre l'annulation et un rafraîchissement
 *     d'allocation. C'est le cas NOMINAL de la bêta de septembre.
 *   - Passe B — ancre en FÉVRIER (28 jours) : ancre+1 mois = J+28, soit une fenêtre
 *     FRANCHE de 2 jours où `periodIndex` vaut déjà 1 alors que le statut est encore
 *     `trialing`.
 *
 * Ce script observe l'état CÔTÉ STRIPE (démarrage `trialing`, `trial_will_end` à J+27,
 * annulation après J+30, aucun prélèvement) pour les DEUX ancres. La preuve « une seule
 * allocation `planCredits` » est CÔTÉ APP : elle est faite en vitest (test/beta-exit),
 * car `src/lib/credits.ts` importe `server-only`, inutilisable depuis un script tsx.
 * Pour vérifier de bout en bout que l'app réagit, faites pointer le webhook de test vers
 * l'app pendant l'exécution :
 *   stripe listen --forward-to localhost:3010/api/stripe/webhook
 *
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/beta-test-clock.ts [price_XXX]
 *
 * ⚠️ Refuse une clé LIVE : les Test Clocks n'existent qu'en mode test.
 */
import "dotenv/config";
import Stripe from "stripe";
import { BETA_CONFIG } from "../src/lib/beta-constants";

const DAY = 24 * 60 * 60;
const TRIAL_DAYS = BETA_CONFIG.trialDays.default; // 30 — même source que l'app
const WILL_END_DAY = TRIAL_DAYS - 3; // Stripe émet trial_will_end 3 j avant le terme (J+27)
const AFTER_END_DAY = TRIAL_DAYS + 1; // au-delà du terme : annulation (J+31)

function requireTestKey(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY absente.");
  if (!key.startsWith("sk_test_")) {
    throw new Error(
      "Clé LIVE détectée. Les Test Clocks n'existent qu'en mode test — relancez avec une clé sk_test_.",
    );
  }
  return new Stripe(key);
}

async function priceIdFromArgs(stripe: Stripe): Promise<string> {
  const fromArg = process.argv.find((a) => a.startsWith("price_"));
  if (fromArg) return fromArg;
  const prices = await stripe.prices.list({ active: true, type: "recurring", limit: 1 });
  const price = prices.data[0];
  if (!price) {
    throw new Error(
      "Aucun prix récurrent en mode test. Créez-en un, ou passez son id : npx tsx scripts/beta-test-clock.ts price_XXX",
    );
  }
  return price.id;
}

async function advance(stripe: Stripe, clockId: string, toUnix: number, label: string) {
  process.stdout.write(`   → avance : ${label}…\n`);
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });
  for (let i = 0; i < 60; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return;
    if (clock.status === "internal_failure") throw new Error("échec interne de la Test Clock");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("délai dépassé en attendant l'horloge");
}

/** Une passe complète pour une ancre donnée. Renvoie true si tous les contrôles passent. */
async function runPass(stripe: Stripe, priceId: string, label: string, startUnix: number): Promise<boolean> {
  console.log(`\n===== PASSE ${label} — ancre ${new Date(startUnix * 1000).toISOString().slice(0, 10)} =====`);

  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: startUnix });
  console.log(`Test Clock : ${clock.id}`);
  const customer = await stripe.customers.create({
    email: `beta-clock-${label}-${startUnix}@example.invalid`,
    test_clock: clock.id,
    metadata: { purpose: `validation bêta 30 jours (${label})` },
  });

  // Mêmes paramètres que la réclamation réelle (src/lib/beta.ts) : aucun moyen de
  // paiement, annulation propre au terme.
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: TRIAL_DAYS,
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { betaTestClock: "true", pass: label },
  });
  console.log(`Abonnement : ${sub.id} — statut initial « ${sub.status} » (attendu trialing)`);

  await advance(stripe, clock.id, startUnix + WILL_END_DAY * DAY, `J+${WILL_END_DAY} (trial_will_end attendu)`);
  const atWillEnd = await stripe.subscriptions.retrieve(sub.id);
  const willEndEvents = await stripe.events.list({ type: "customer.subscription.trial_will_end", limit: 50 });
  const sawWillEnd = willEndEvents.data.some((e) => (e.data.object as Stripe.Subscription).id === sub.id);
  console.log(`   statut à J+${WILL_END_DAY} : ${atWillEnd.status} · trial_will_end émis : ${sawWillEnd ? "OUI" : "NON"}`);

  await advance(stripe, clock.id, startUnix + AFTER_END_DAY * DAY, `J+${AFTER_END_DAY} (annulation attendue)`);
  const atEnd = await stripe.subscriptions.retrieve(sub.id);
  const invoices = await stripe.invoices.list({ customer: customer.id, limit: 20 });
  const paid = invoices.data.filter((i) => i.amount_paid > 0);
  console.log(`   statut après J+${TRIAL_DAYS} : ${atEnd.status} · factures payées : ${paid.length}`);

  const checks: [string, boolean][] = [
    ["démarrage en trialing", sub.status === "trialing"],
    [`toujours en essai à J+${WILL_END_DAY}`, atWillEnd.status === "trialing"],
    ["trial_will_end émis", sawWillEnd],
    ["annulé après le terme", atEnd.status === "canceled"],
    ["aucun prélèvement", paid.length === 0],
  ];
  console.log("   — contrôles —");
  for (const [l, ok] of checks) console.log(`     ${ok ? "✓" : "❌"} ${l}`);
  console.log(`   Nettoyage : supprimez l'horloge ${clock.id} (Dashboard, mode test).`);
  return checks.every(([, ok]) => ok);
}

async function main() {
  const stripe = requireTestKey();
  const priceId = await priceIdFromArgs(stripe);
  console.log(`Prix utilisé : ${priceId} · essai ${TRIAL_DAYS} jours`);

  // Ancres choisies pour exposer les deux formes de défaillance :
  //  - septembre 2026 (30 j) : ancre+1 mois = J+30 (coïncidence à la fin) ;
  //  - février 2027 (28 j)   : ancre+1 mois = J+28 (fenêtre franche).
  const septA = Math.floor(Date.UTC(2026, 8, 10, 9, 0, 0) / 1000); // 10 sept. 2026
  const febB = Math.floor(Date.UTC(2027, 1, 10, 9, 0, 0) / 1000); // 10 févr. 2027

  const a = await runPass(stripe, priceId, "A (septembre)", septA);
  const b = await runPass(stripe, priceId, "B (février)", febB);

  console.log("\n--- Verdict global ---");
  console.log(`  Passe A (septembre) : ${a ? "VALIDÉE" : "ÉCHEC"}`);
  console.log(`  Passe B (février)   : ${b ? "VALIDÉE" : "ÉCHEC"}`);
  console.log(
    "\nRappel : la preuve « une seule allocation planCredits » est côté app (vitest test/beta-exit),\n" +
      "et le contrôle des 5 invariants de sortie de bêta y est également couvert.",
  );
  process.exit(a && b ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(`\nÉchec : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
