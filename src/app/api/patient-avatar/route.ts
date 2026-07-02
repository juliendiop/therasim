import { NextRequest } from "next/server";
import { renderPatientAvatarSvg } from "@/lib/patient-avatar-svg";

// GET /api/patient-avatar?seed=... — portrait illustré déterministe (cas fictif).
// Contenu purement dérivé du seed : cache long (immuable pour un seed donné).
export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed") || "patient";
  const svg = renderPatientAvatarSvg(seed);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
