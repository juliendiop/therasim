// Support client : règles pures + cloisonnement (ces derniers exigent TEST_DATABASE_URL).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  parseTicketStatus,
  parseTicketType,
  ticketTypeSchema,
  TICKET_TYPE_LABEL,
} from "../src/lib/support-types";
import { isEuOnlyUsage, EU_ONLY_USAGES } from "../src/lib/config";

describe("types de ticket", () => {
  it("n'accepte que les deux types prévus", () => {
    expect(ticketTypeSchema.safeParse("bug").success).toBe(true);
    expect(ticketTypeSchema.safeParse("idea").success).toBe(true);
    expect(ticketTypeSchema.safeParse("urgent").success).toBe(false);
    expect(TICKET_TYPE_LABEL.bug).toBe("Anomalie");
  });

  it("dégrade proprement une valeur inconnue venue de la base", () => {
    // Un statut inconnu ne doit pas faire planter une page : on le traite comme clos
    // (le plus restrictif : le client ne pourra pas écrire).
    expect(parseTicketStatus("open")).toBe("open");
    expect(parseTicketStatus("wat")).toBe("closed");
    expect(parseTicketType("wat")).toBe("bug");
  });
});

describe("verrou UE de l'IA", () => {
  it("l'usage support est verrouillé, les autres non", () => {
    expect(isEuOnlyUsage("support")).toBe(true);
    expect(isEuOnlyUsage("evaluateur")).toBe(false);
    expect(isEuOnlyUsage("patient")).toBe(false);
    expect(isEuOnlyUsage("generation")).toBe(false);
    expect(EU_ONLY_USAGES).toContain("support");
  });
});

// --- Cloisonnement (base requise) -------------------------------------------

const TEST_DB = process.env.TEST_DATABASE_URL;
const describeDb = TEST_DB ? describe : describe.skip;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB ?? process.env.DATABASE_URL }),
});

describeDb("cloisonnement des tickets", () => {
  const created = { userIds: [] as string[], ticketIds: [] as string[] };
  let owner = "";
  let intruder = "";
  let ticketId = "";

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: "public" } });
    if (!tenant) throw new Error("tenant public absent");

    const mk = async (tag: string) => {
      const u = await prisma.user.create({
        data: {
          email: `test-support-${tag}-${Date.now()}@example.invalid`,
          tenantId: tenant.id,
          role: "learner",
        },
      });
      created.userIds.push(u.id);
      return u.id;
    };
    owner = await mk("owner");
    intruder = await mk("intruder");

    const t = await prisma.supportTicket.create({
      data: {
        userId: owner,
        tenantId: tenant.id,
        type: "bug",
        subject: "Test cloisonnement",
        status: "open",
        lastMessageFrom: "client",
      },
    });
    ticketId = t.id;
    created.ticketIds.push(t.id);
    await prisma.supportMessage.create({
      data: { ticketId: t.id, authorRole: "client", authorId: owner, body: "bonjour" },
    });
  });

  afterAll(async () => {
    await prisma.supportMessage.deleteMany({ where: { ticketId: { in: created.ticketIds } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: created.ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.$disconnect();
  });

  it("le propriétaire lit son ticket", async () => {
    const { getTicket } = await import("../src/lib/support");
    const t = await getTicket(ticketId, owner);
    expect(t).not.toBeNull();
    expect(t?.subject).toBe("Test cloisonnement");
  });

  it("un autre utilisateur ne le voit pas, même avec l'identifiant exact", async () => {
    const { getTicket } = await import("../src/lib/support");
    // Indistinguable d'un ticket inexistant : sinon on pourrait énumérer les tickets.
    expect(await getTicket(ticketId, intruder)).toBeNull();
    expect(await getTicket("00000000-0000-0000-0000-000000000000", intruder)).toBeNull();
  });

  it("un intrus ne peut pas écrire dans le fil", async () => {
    const { addMessage } = await import("../src/lib/support");
    const res = await addMessage(ticketId, { role: "client", id: intruder }, "intrusion");
    expect(res.ok).toBe(false);

    const count = await prisma.supportMessage.count({ where: { ticketId } });
    expect(count).toBe(1); // le message d'origine, rien de plus
  });

  it("un ticket clos n'accepte plus de message", async () => {
    const { addMessage } = await import("../src/lib/support");
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "closed" } });
    const res = await addMessage(ticketId, { role: "client", id: owner }, "encore un mot");
    expect(res.ok).toBe(false);
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "open" } });
  });

  it("la suppression d'un compte supprime ses tickets et messages", async () => {
    const { deleteTicketsForUser } = await import("../src/lib/support");
    await deleteTicketsForUser(owner);
    expect(await prisma.supportTicket.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.supportMessage.count({ where: { ticketId } })).toBe(0);
  });
});
