/**
 * Tests adossés à une vraie base Postgres.
 *
 * Ils ÉCRIVENT des lignes : ils ne s'exécutent que si `TEST_DATABASE_URL` est fourni,
 * et sont ignorés sinon. Ne jamais y mettre l'URL de production — créez une branche
 * Neon jetable (là, le branching est pleinement justifié : ces tests modifient la base).
 *
 *   TEST_DATABASE_URL="postgresql://…branche…" npm run test
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateBetaCode } from "../src/lib/beta-code";

const TEST_DB = process.env.TEST_DATABASE_URL;
const describeDb = TEST_DB ? describe : describe.skip;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB ?? process.env.DATABASE_URL }),
});

const CLEANUP = { userIds: [] as string[], inviteIds: [] as string[], subIds: [] as string[] };

describeDb("réclamation d'invitation — atomicité", () => {
  let tenantId = "";

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: "public" } });
    if (!tenant) throw new Error("tenant public absent de la base de test");
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.creditLedger.deleteMany({ where: { userId: { in: CLEANUP.userIds } } });
    await prisma.userSubscription.deleteMany({ where: { userId: { in: CLEANUP.userIds } } });
    await prisma.betaInvite.deleteMany({ where: { id: { in: CLEANUP.inviteIds } } });
    await prisma.user.deleteMany({ where: { id: { in: CLEANUP.userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const u = await prisma.user.create({
      data: { email: `test-beta-${generateBetaCode(10)}@example.invalid`, tenantId, role: "learner" },
    });
    CLEANUP.userIds.push(u.id);
    return u.id;
  }

  async function makeInvite(): Promise<string> {
    const inv = await prisma.betaInvite.create({
      data: {
        code: generateBetaCode(),
        cohort: "test-vitest",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    CLEANUP.inviteIds.push(inv.id);
    return inv.code;
  }

  it("deux réclamations concurrentes : une seule réussit", async () => {
    const code = await makeInvite();
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const now = new Date();

    // C'est EXACTEMENT le verrou utilisé par claimBetaInvite : un updateMany
    // conditionnel, pas un read-then-write. La base arbitre la course.
    const claim = (userId: string) =>
      prisma.betaInvite.updateMany({
        where: { code, status: "PENDING", expiresAt: { gt: now } },
        data: { status: "CLAIMED", claimedByUserId: userId, claimedAt: now },
      });

    const [r1, r2] = await Promise.all([claim(a), claim(b)]);

    expect(r1.count + r2.count).toBe(1);

    const invite = await prisma.betaInvite.findUnique({ where: { code } });
    expect(invite?.status).toBe("CLAIMED");
    expect([a, b]).toContain(invite?.claimedByUserId);
  });

  it("un code expiré n'est pas réclamable", async () => {
    const inv = await prisma.betaInvite.create({
      data: {
        code: generateBetaCode(),
        cohort: "test-vitest",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000), // déjà expiré
      },
    });
    CLEANUP.inviteIds.push(inv.id);
    const userId = await makeUser();

    const res = await prisma.betaInvite.updateMany({
      where: { code: inv.code, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "CLAIMED", claimedByUserId: userId, claimedAt: new Date() },
    });
    expect(res.count).toBe(0);
  });

  it("un code révoqué n'est pas réclamable", async () => {
    const code = await makeInvite();
    await prisma.betaInvite.update({ where: { code }, data: { status: "REVOKED" } });
    const userId = await makeUser();

    const res = await prisma.betaInvite.updateMany({
      where: { code, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "CLAIMED", claimedByUserId: userId, claimedAt: new Date() },
    });
    expect(res.count).toBe(0);
  });
});

describeDb("crédits de forfait — non cumulatif + remise à zéro", () => {
  let userId = "";
  let planId = "";
  let tenantId = "";
  const subId = `sub_test_${Date.now()}`;
  // Ancre fixe : période 0 en janvier, période 1 en février (index relatif à l'ancre).
  const anchor = new Date("2026-01-10T00:00:00Z");
  const inPeriod0 = new Date("2026-01-20T00:00:00Z");
  const inPeriod1 = new Date("2026-02-15T00:00:00Z");

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: "public" } });
    if (!tenant) throw new Error("tenant public absent");
    tenantId = tenant.id;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        key: `test-intensif-${generateBetaCode(6)}`,
        label: "Test Intensif",
        monthlyCredits: 200,
        priceEurCents: 4900,
      },
    });
    planId = plan.id;

    const u = await prisma.user.create({
      data: {
        email: `test-credits-${generateBetaCode(10)}@example.invalid`,
        tenantId,
        role: "learner",
        credits: 0,
      },
    });
    userId = u.id;
    CLEANUP.userIds.push(u.id);

    // Abonnement d'essai : `trialing` est entitled, donc l'allocation s'applique.
    await prisma.userSubscription.create({
      data: {
        userId,
        tenantId,
        planId,
        stripeSubscriptionId: subId,
        status: "trialing",
        periodAnchorAt: anchor,
      },
    });
    CLEANUP.subIds.push(subId);
  });

  afterAll(async () => {
    await prisma.creditLedger.deleteMany({ where: { userId } });
    await prisma.userSubscription.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
  });

  it("alloue l'allocation du forfait, une seule fois par période (idempotent)", async () => {
    const { syncSubscriptionCredits } = await import("../src/lib/credits");

    await syncSubscriptionCredits(userId, inPeriod0);
    await syncSubscriptionCredits(userId, inPeriod0); // rejeu même période

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(200); // et non 400
    expect(user?.credits).toBe(0); // le portefeuille persistant n'est pas touché

    const rows = await prisma.creditLedger.count({
      where: { stripeSubscriptionId: subId, reason: "subscription_renewal", periodIndex: 0 },
    });
    expect(rows).toBe(1);
  });

  it("période suivante : REMET à l'allocation (non cumulatif), le reliquat est perdu", async () => {
    const { syncSubscriptionCredits, debit } = await import("../src/lib/credits");

    // Consomme 50 sur l'allocation de la période 0 (200 -> 150).
    await debit(userId, 50, "consume_test");
    let user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(150);

    // Période 1 : reset à 200 — surtout PAS 150 + 200 = 350.
    await syncSubscriptionCredits(userId, inPeriod1);
    user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(200);
  });

  it("upgrade en cours de cycle : ajoute le différentiel, idempotent", async () => {
    const { topUpPlanCredits } = await import("../src/lib/credits");

    await topUpPlanCredits({
      userId,
      amount: 110, // Intensif (200) - Praticien (90)
      stripeSubscriptionId: subId,
      periodIndex: 1,
    });
    await topUpPlanCredits({
      userId,
      amount: 110,
      stripeSubscriptionId: subId,
      periodIndex: 1,
    }); // rejeu : refusé par la contrainte unique

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(310); // 200 + 110, une seule fois
  });

  it("débit à deux étages : puise dans le forfait AVANT le portefeuille", async () => {
    const { debit, grant } = await import("../src/lib/credits");

    await grant(userId, 30, "purchase"); // portefeuille : 0 -> 30 (forfait toujours 310)
    await debit(userId, 320, "consume_test"); // 310 forfait + 10 portefeuille

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(0);
    expect(user?.credits).toBe(20); // 30 - 10 : les crédits achetés servent en dernier
  });

  it("fin d'accès : remet le forfait à 0 sans toucher au portefeuille", async () => {
    const { topUpPlanCredits, zeroPlanCredits } = await import("../src/lib/credits");

    await topUpPlanCredits({ userId, amount: 50, stripeSubscriptionId: subId, periodIndex: 2 });
    await zeroPlanCredits(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.planCredits).toBe(0);
    expect(user?.credits).toBe(20); // portefeuille intact
  });
});
