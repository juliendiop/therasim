/**
 * Génération des invitations de bêta fermée.
 *
 *   npm run beta:invites -- --count 25 --cohort beta-2026-01
 *   npm run beta:invites -- --email julien@exemple.fr --note "Julien, psychologue"
 *
 * Sortie : CSV `code,url,email` sur stdout (les messages d'info vont sur stderr,
 * pour pouvoir rediriger proprement : `npm run beta:invites -- --count 25 > invites.csv`).
 *
 * L'URL est construite depuis APP_BASE_URL (le repo n'a pas de NEXT_PUBLIC_APP_URL ;
 * src/lib/base-url.ts est `server-only` donc inimportable ici — mêmes priorités,
 * moins le cas « origine de la requête » qui n'a pas de sens hors HTTP).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateBetaCode } from "../src/lib/beta-code";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_COHORT = "beta-2026-01";
const DEFAULT_EXPIRES_DAYS = 30; // expiration du CODE, pas de l'essai de 90 jours

type Options = {
  count: number;
  cohort: string;
  email: string | null;
  note: string | null;
  expiresDays: number;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    count: 1,
    cohort: DEFAULT_COHORT,
    email: null,
    note: null,
    expiresDays: DEFAULT_EXPIRES_DAYS,
  };
  let sawCount = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new Error(`valeur manquante pour ${arg}`);
      }
      i++;
      return v;
    };

    switch (arg) {
      case "--count": {
        const n = Number.parseInt(next(), 10);
        if (!Number.isFinite(n) || n < 1 || n > 500) {
          throw new Error("--count doit être un entier entre 1 et 500");
        }
        opts.count = n;
        sawCount = true;
        break;
      }
      case "--cohort":
        opts.cohort = next().trim();
        break;
      case "--email":
        opts.email = next().trim().toLowerCase();
        break;
      case "--note":
        opts.note = next().trim();
        break;
      case "--expires-days": {
        const n = Number.parseInt(next(), 10);
        if (!Number.isFinite(n) || n < 1) throw new Error("--expires-days doit être ≥ 1");
        opts.expiresDays = n;
        break;
      }
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`option inconnue : ${arg}`);
    }
  }

  // --email crée une invitation unitaire pré-affectée, sauf --count explicite.
  if (opts.email && !sawCount) opts.count = 1;
  if (opts.email && opts.count > 1) {
    throw new Error("--email est incompatible avec --count > 1 (une invitation = un destinataire)");
  }
  if (opts.email && !opts.email.includes("@")) {
    throw new Error("--email invalide");
  }
  return opts;
}

function printUsage(): void {
  process.stderr.write(
    [
      "Usage :",
      "  npm run beta:invites -- --count 25 [--cohort beta-2026-01] [--expires-days 30]",
      "  npm run beta:invites -- --email a@b.fr [--note \"Prénom, profession\"]",
      "",
      "Sortie CSV (stdout) : code,url,email",
      "",
    ].join("\n"),
  );
}

/** Base publique de l'app — mêmes priorités que src/lib/base-url.ts. */
function appBaseUrl(): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, "");
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit && !explicit.includes("localhost")) return clean(explicit);
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${clean(prod)}`;
  if (explicit) return clean(explicit);
  return "http://localhost:3000";
}

/** Échappement CSV minimal (un nom ou une note peut contenir une virgule). */
function csv(value: string | null): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const baseUrl = appBaseUrl();
  const expiresAt = new Date(Date.now() + opts.expiresDays * 24 * 60 * 60 * 1000);

  process.stderr.write(
    `Génération de ${opts.count} invitation(s) · cohorte "${opts.cohort}" · ` +
      `code valable ${opts.expiresDays} j (jusqu'au ${expiresAt.toISOString().slice(0, 10)})\n`,
  );

  // Garde-fou : des liens localhost envoyés à de vrais destinataires ne mènent
  // nulle part, et l'erreur ne se voit qu'après l'envoi.
  if (baseUrl.includes("localhost")) {
    process.stderr.write(
      `\n⚠️  Les URL générées pointent sur ${baseUrl} — inutilisables dans un email.\n` +
        `   Pour un vrai publipostage, relancez avec le domaine public :\n` +
        `   APP_BASE_URL=https://meleta.app npm run beta:invites -- --count ${opts.count}\n\n`,
    );
  }

  // En-tête CSV sur stdout.
  process.stdout.write("code,url,email\n");

  for (let i = 0; i < opts.count; i++) {
    // Collision quasi impossible (10^35), mais on retente proprement si le hasard
    // ou une reprise de script produisait un doublon.
    let created: { code: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const code = generateBetaCode();
      try {
        const invite = await prisma.betaInvite.create({
          data: {
            code,
            email: opts.email,
            note: opts.note,
            cohort: opts.cohort,
            status: "PENDING",
            expiresAt,
          },
          select: { code: true },
        });
        created = invite;
      } catch (e) {
        const isDuplicate =
          typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
        if (!isDuplicate) throw e;
        process.stderr.write("collision de code (improbable) : nouvel essai\n");
      }
    }
    if (!created) throw new Error("impossible de générer un code unique après 5 essais");

    process.stdout.write(
      `${csv(created.code)},${csv(`${baseUrl}/beta/${created.code}`)},${csv(opts.email)}\n`,
    );
  }

  process.stderr.write(`OK : ${opts.count} invitation(s) créée(s).\n`);
}

main()
  .catch((e: unknown) => {
    process.stderr.write(`\nÉchec : ${e instanceof Error ? e.message : String(e)}\n`);
    printUsage();
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
