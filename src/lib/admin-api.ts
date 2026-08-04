// Garde d'autorisation pour les routes API réservées au super-admin (pas les
// pages : /admin/* redirige déjà via requireSuperAdmin(), src/lib/auth.ts).
// Convention existante (src/app/api/live/[id]/export/route.ts) : 403 pour un
// rôle insuffisant, 404 pour une ressource introuvable ou un mauvais tenant —
// PAS l'inverse.
import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, type CurrentUser } from "./auth";

export async function requireSuperAdminApi(): Promise<
  { user: CurrentUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return { response: NextResponse.json({ error: "non autorisé" }, { status: 403 }) };
  }
  return { user };
}
