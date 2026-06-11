import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Driver Postgres natif (port 5432). Fiable en local (y compris derrière un proxy
// d'entreprise) ET sur Vercel (Fluid Compute = Node). On évite le driver "serverless"
// HTTP/WS de Neon, bloqué sur certains réseaux pro. Voir 03_DECISIONS.md.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
