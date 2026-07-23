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
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateBetaCode } from "../src/lib/beta-code";
import { isEmailConfigured, sendBetaInvitation } from "../src/lib/email";
import { BETA_PLAN_KEY, BETA_TRIAL_DAYS } from "../src/lib/beta-constants";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_COHORT = "beta-2026-01";
const DEFAULT_EXPIRES_DAYS = 30; // expiration du CODE, pas de l'essai de 90 jours

type Recipient = { email: string; firstName: string | null };

type Options = {
  count: number;
  cohort: string;
  email: string | null;
  note: string | null;
  expiresDays: number;
  send: boolean;
  fromFile: string | null;
  dryRun: boolean;
};

/**
 * Lit un fichier de destinataires : une ligne par personne, au choix
 *   contact@exemple.fr
 *   contact@exemple.fr, Marie
 * Les lignes vides et celles commençant par # sont ignorées.
 */
function readRecipients(path: string): Recipient[] {
  const raw = readFileSync(path, "utf8");
  const out: Recipient[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [emailPart, ...rest] = trimmed.split(",");
    const email = emailPart.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new Error(`ligne ${i + 1} : « ${trimmed} » n'est pas un email valide`);
    }
    const firstName = rest.join(",").trim();
    out.push({ email, firstName: firstName || null });
  });
  if (out.length === 0) throw new Error(`aucun destinataire lisible dans ${path}`);
  return out;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    count: 1,
    cohort: DEFAULT_COHORT,
    email: null,
    note: null,
    expiresDays: DEFAULT_EXPIRES_DAYS,
    send: false,
    fromFile: null,
    dryRun: false,
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
      case "--send":
        opts.send = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--from-file":
        opts.fromFile = next();
        break;
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
      "  npm run beta:invites -- --send --from-file testeurs.txt   (crée ET envoie)",
      "",
      "Options :",
      "  --dry-run   montre ce qui serait fait, sans rien créer ni envoyer",
      "  --send      envoie l'email d'invitation (exige --from-file ou --email)",
      "  --from-file une ligne par destinataire : « email » ou « email, Prénom »",
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

  // Destinataires : soit un fichier (une invitation nominative par ligne), soit
  // `--email`, soit rien (codes anonymes à distribuer soi-même).
  const recipients: Recipient[] = opts.fromFile
    ? readRecipients(opts.fromFile)
    : opts.email
      ? [{ email: opts.email, firstName: null }]
      : [];
  const total = recipients.length > 0 ? recipients.length : opts.count;

  if (opts.send) {
    if (recipients.length === 0) {
      throw new Error("--send exige des destinataires : utilisez --from-file ou --email");
    }
    if (!isEmailConfigured()) {
      throw new Error("RESEND_API_KEY absente : impossible d'envoyer les invitations");
    }
  }

  // Le forfait offert et son allocation sont annoncés dans l'email : on les lit en
  // base, même source de vérité que la réclamation.
  const plan = opts.send
    ? await prisma.subscriptionPlan.findUnique({ where: { key: BETA_PLAN_KEY } })
    : null;
  if (opts.send && !plan) {
    throw new Error(`forfait "${BETA_PLAN_KEY}" introuvable en base`);
  }

  process.stderr.write(
    `Génération de ${total} invitation(s) · cohorte "${opts.cohort}" · ` +
      `code valable ${opts.expiresDays} j (jusqu'au ${expiresAt.toISOString().slice(0, 10)})` +
      `${opts.send ? " · ENVOI DES EMAILS ACTIVÉ" : ""}\n`,
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

  // Répétition à blanc : on montre exactement ce qui serait fait, sans rien écrire
  // en base ni envoyer le moindre email. À utiliser systématiquement avant un envoi réel.
  if (opts.dryRun) {
    process.stderr.write(
      `\n[RÉPÉTITION À BLANC] rien ne sera créé ni envoyé.\n` +
        `  ${total} invitation(s), cohorte "${opts.cohort}", liens en ${baseUrl}/beta/…\n` +
        (opts.send
          ? `  ${recipients.length} email(s) partiraient à :\n` +
            recipients.map((r) => `    - ${r.email}${r.firstName ? ` (${r.firstName})` : ""}`).join("\n") +
            "\n"
          : "  aucun email (ajoutez --send)\n"),
    );
    return;
  }

  // En-tête CSV sur stdout.
  process.stdout.write("code,url,email\n");

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const recipient = recipients[i] ?? null;
    const email = recipient?.email ?? opts.email;

    // Collision quasi impossible (10^35), mais on retente proprement si le hasard
    // ou une reprise de script produisait un doublon.
    let created: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const code = generateBetaCode();
      try {
        created = await prisma.betaInvite.create({
          data: {
            code,
            email,
            note: recipient?.firstName ?? opts.note,
            cohort: opts.cohort,
            status: "PENDING",
            expiresAt,
          },
          select: { id: true, code: true },
        });
      } catch (e) {
        const isDuplicate =
          typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
        if (!isDuplicate) throw e;
        process.stderr.write("collision de code (improbable) : nouvel essai\n");
      }
    }
    if (!created) throw new Error("impossible de générer un code unique après 5 essais");

    const url = `${baseUrl}/beta/${created.code}`;
    process.stdout.write(`${csv(created.code)},${csv(url)},${csv(email)}\n`);

    if (opts.send && email && plan) {
      try {
        await sendBetaInvitation(email, {
          url,
          firstName: recipient?.firstName ?? null,
          planLabel: plan.label,
          monthlyCredits: plan.monthlyCredits,
          trialDays: BETA_TRIAL_DAYS,
        });
        await prisma.betaInvite.update({
          where: { id: created.id },
          data: { emailSentAt: new Date() },
        });
        sent++;
        process.stderr.write(`  envoyé -> ${email}\n`);
      } catch (e) {
        failed++;
        // On n'interrompt pas la boucle : le code reste valide et figure dans le CSV,
        // donc un envoi raté se rattrape depuis /admin/beta (bouton « Renvoyer »).
        process.stderr.write(
          `  ÉCHEC -> ${email} : ${e instanceof Error ? e.message : String(e)}\n`,
        );
      }
    }
  }

  process.stderr.write(
    `OK : ${total} invitation(s) créée(s)` +
      (opts.send ? ` · ${sent} email(s) envoyé(s), ${failed} en échec` : "") +
      ".\n",
  );
  if (failed > 0) {
    process.stderr.write(
      "Les envois en échec se relancent depuis /admin/beta (bouton « Renvoyer »).\n",
    );
  }
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
