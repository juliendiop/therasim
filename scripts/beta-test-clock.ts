/**
 * Validation du cycle de 90 jours avec une Test Clock Stripe.
 *
 * C'est le seul moyen fiable de vérifier ce mécanisme sans attendre trois mois :
 * on crée une horloge, on y rattache un client, on ouvre l'essai, puis on avance
 * le temps pour observer `trial_will_end` (J+87) puis l'annulation (J+91).
 *
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/beta-test-clock.ts
 *
 * ⚠️ Refuse de s'exécuter avec une clé LIVE : les Test Clocks n'existent qu'en mode
 * test, et créer des abonnements réels sur le compte de production serait une erreur.
 *
 * Ce script observe l'état CÔTÉ STRIPE. Pour vérifier de bout en bout que l'app
 * réagit (crédits versés, email envoyé, accès révoqué), faites pointer le webhook
 * de test vers l'app — `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 * — pendant l'exécution.
 */
import "dotenv/config";
import Stripe from "stripe";

const DAY = 24 * 60 * 60;
const TRIAL_DAYS = 90;

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
  // À défaut, le premier prix récurrent du compte de test.
  const prices = await stripe.prices.list({ active: true, type: "recurring", limit: 1 });
  const price = prices.data[0];
  if (!price) {
    throw new Error(
      "Aucun prix récurrent en mode test. Créez-en un, ou passez son id en argument : npx tsx scripts/beta-test-clock.ts price_XXX",
    );
  }
  return price.id;
}

async function advance(stripe: Stripe, clockId: string, toUnix: number, label: string) {
  process.stdout.write(`\n→ Avance de l'horloge : ${label}…\n`);
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });

  // L'avance est asynchrone : on attend que l'horloge soit de nouveau prête.
  for (let i = 0; i < 60; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return;
    if (clock.status === "internal_failure") throw new Error("échec interne de la Test Clock");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("délai dépassé en attendant l'horloge");
}

async function main() {
  const stripe = requireTestKey();
  const priceId = await priceIdFromArgs(stripe);
  const start = Math.floor(Date.now() / 1000);

  console.log(`Prix utilisé : ${priceId}`);

  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: start });
  console.log(`Test Clock   : ${clock.id}`);

  const customer = await stripe.customers.create({
    email: `beta-clock-${start}@example.invalid`,
    test_clock: clock.id,
    metadata: { purpose: "validation bêta 90 jours" },
  });

  // Mêmes paramètres que la réclamation réelle (src/lib/beta.ts) : aucun moyen de
  // paiement fourni, annulation propre au terme.
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: TRIAL_DAYS,
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { betaTestClock: "true" },
  });

  console.log(`Abonnement   : ${sub.id}`);
  console.log(`Statut initial attendu « trialing » -> obtenu « ${sub.status} »`);
  if (sub.status !== "trialing") throw new Error("l'abonnement aurait dû démarrer en essai");

  // --- J+87 : Stripe émet `customer.subscription.trial_will_end` (3 j avant le terme).
  await advance(stripe, clock.id, start + 87 * DAY, "J+87 (trial_will_end attendu)");
  const at87 = await stripe.subscriptions.retrieve(sub.id);
  console.log(`  statut à J+87 : ${at87.status} (attendu « trialing »)`);

  const events87 = await stripe.events.list({ type: "customer.subscription.trial_will_end", limit: 20 });
  const sawWillEnd = events87.data.some(
    (e) => (e.data.object as Stripe.Subscription).id === sub.id,
  );
  console.log(`  événement trial_will_end émis : ${sawWillEnd ? "OUI" : "NON"}`);

  // --- J+91 : plus d'essai, aucun moyen de paiement -> annulation, sans facture payée.
  await advance(stripe, clock.id, start + 91 * DAY, "J+91 (annulation attendue)");
  const at91 = await stripe.subscriptions.retrieve(sub.id);
  console.log(`  statut à J+91 : ${at91.status} (attendu « canceled »)`);

  const invoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
  const paid = invoices.data.filter((i) => i.amount_paid > 0);
  console.log(`  factures émises : ${invoices.data.length} · dont payées : ${paid.length}`);

  console.log("\n--- Verdict ---");
  const checks: [string, boolean][] = [
    ["démarrage en trialing", sub.status === "trialing"],
    ["toujours en essai à J+87", at87.status === "trialing"],
    ["trial_will_end émis", sawWillEnd],
    ["annulé à J+91", at91.status === "canceled"],
    ["aucun prélèvement", paid.length === 0],
  ];
  for (const [label, ok] of checks) console.log(`  ${ok ? "✓" : "❌"} ${label}`);

  const allOk = checks.every(([, ok]) => ok);
  console.log(`\n→ ${allOk ? "Cycle de 90 jours VALIDÉ" : "ÉCHEC — voir ci-dessus"}`);
  console.log(`\nNettoyage : supprimez l'horloge ${clock.id} depuis le Dashboard (mode test).`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(`\nÉchec : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
