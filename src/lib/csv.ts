// Utilitaire CSV partagé — UNE seule convention dans l'application (celle de
// l'export live d'origine, src/app/api/live/[id]/export/route.ts) : séparateur
// point-virgule, BOM UTF-8 (accents lisibles à l'ouverture directe dans Excel),
// retours ligne CRLF. Ne s'applique PAS au script scripts/generate-beta-invites.ts
// (sortie machine/stdout, jamais ouverte directement dans Excel — comma-separated,
// sans BOM, usage différent, volontairement laissé tel quel).

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Sérialise des lignes en CSV Excel-FR : BOM + ';' + CRLF. `rows[0]` = en-têtes. */
export function toCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/** Réponse HTTP prête à l'emploi pour un téléchargement CSV. */
export function csvResponse(rows: (string | number)[][], filename: string): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
