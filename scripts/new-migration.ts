/**
 * Crée une nouvelle migration à partir de l'écart entre la BASE RÉELLE et le schéma.
 *
 *   npm run db:migrate:new -- ajout_du_champ_machin
 *
 * Pourquoi pas `prisma migrate dev` : sur Neon, cette commande exige une « base
 * fantôme » (une seconde base jetable) pour rejouer l'historique. Ici on diffe
 * directement la base réelle contre le schéma — même résultat, aucune base en plus.
 *
 * Le fichier est SEULEMENT écrit : rien n'est appliqué. On relit, puis on lance
 * `npm run db:migrate:deploy`.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function main(): void {
  const rawName = process.argv.slice(2).join(" ").trim();
  if (!rawName) {
    console.error(
      'Nom de migration manquant.\n  npm run db:migrate:new -- "ajout du champ machin"',
    );
    process.exit(1);
  }
  const name = slugify(rawName);
  if (!name) {
    console.error("Nom inutilisable après nettoyage.");
    process.exit(1);
  }

  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(
      "Dossier prisma/migrations absent : le baseline n'a pas été fait (voir 00_DEMARRAGE.md).",
    );
    process.exit(1);
  }

  // Écart base réelle -> schéma. Aucune base fantôme nécessaire.
  //
  // On lance le binaire Prisma par `node` plutôt que par `npx` : sous Windows, `npx`
  // est un `.cmd`, que Node 24 refuse de lancer sans `shell: true` (EINVAL) — et
  // `shell: true` ne protège pas les arguments. Passer par le point d'entrée du
  // paquet évite les deux écueils, et fonctionne à l'identique sur tous les systèmes.
  const prismaCli = require.resolve("prisma/build/index.js");
  const sql = execFileSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8" },
  );

  const meaningful = sql
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("--"))
    .join("\n")
    .trim();

  if (!meaningful) {
    console.log("Rien à migrer : la base est déjà conforme au schéma.");
    return;
  }

  const dir = join(MIGRATIONS_DIR, `${timestamp()}_${name}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "migration.sql");
  writeFileSync(file, sql, "utf8");

  console.log(`Migration écrite : ${file}\n`);
  console.log(sql.trim());
  console.log(
    "\n--- Rien n'a été appliqué. ---\n" +
      "1. Relis le SQL ci-dessus (cherche DROP, ALTER COLUMN, RENAME : ce sont les lignes qui détruisent).\n" +
      "2. Applique avec : npm run db:migrate:deploy",
  );
}

main();
