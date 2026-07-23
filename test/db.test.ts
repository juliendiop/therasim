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

describeDb("crédits d'abonnement — idempotence structurelle", () => {
  let userId = "";
  const subId = `sub_test_${Date.now()}`;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: "public" } });
    if (!tenant) throw new Error("tenant public absent");
    const u = await prisma.user.create({
      data: {
        email: `test-credits-${generateBetaCode(10)}@example.invalid`,
        tenantId: tenant.id,
        role: "learner",
        credits: 0,
      },
    });
    userId = u.id;
    CLEANUP.userIds.push(u.id);
  });

  afterAll(async () => {
    await prisma.creditLedger.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("un webhook rejoué ne crédite pas deux fois", async () => {
    const { grantSubscriptionCredits } = await import("../src/lib/credits");

    const first = await grantSubscriptionCredits({
      userId,
      amount: 200,
      reason: "subscription_renewal",
      stripeSubscriptionId: subId,
      periodIndex: 0,
    });
    const replay = await grantSubscriptionCredits({
      userId,
      amount: 200,
      reason: "subscription_renewal",
      stripeSubscriptionId: subId,
      periodIndex: 0,
    });

    expect(first).toBe(true);
    expect(replay).toBe(false); // refusé par la contrainte unique, silencieusement

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.credits).toBe(200); // et non 400

    const rows = await prisma.creditLedger.count({
      where: { stripeSubscriptionId: subId, reason: "subscription_renewal", periodIndex: 0 },
    });
    expect(rows).toBe(1);
  });

  it("la période suivante est bien créditée", async () => {
    const { grantSubscriptionCredits } = await import("../src/lib/credits");
    const ok = await grantSubscriptionCredits({
      userId,
      amount: 200,
      reason: "subscription_renewal",
      stripeSubscriptionId: subId,
      periodIndex: 1,
    });
    expect(ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.credits).toBe(400);
  });

  it("un upgrade en cours de cycle n'est pas avalé par la déduplication", async () => {
    const { grantSubscriptionCredits } = await import("../src/lib/credits");

    // Même abonnement, même période que le renouvellement déjà versé : seul le
    // `reason` distinct permet au différentiel de passer.
    const topup = await grantSubscriptionCredits({
      userId,
      amount: 110, // Intensif (200) - Praticien (90)
      reason: "plan_upgrade_topup",
      stripeSubscriptionId: subId,
      periodIndex: 1,
    });
    expect(topup).toBe(true);

    const replay = await grantSubscriptionCredits({
      userId,
      amount: 110,
      reason: "plan_upgrade_topup",
      stripeSubscriptionId: subId,
      periodIndex: 1,
    });
    expect(replay).toBe(false);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.credits).toBe(510); // 400 + 110, une seule fois
  });
});
