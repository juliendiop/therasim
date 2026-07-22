import { NextRequest, NextResponse } from "next/server";
import {
  ANONYMOUS_EVENTS,
  getOrSetVisitorId,
  recordFunnel,
  type FunnelEventName,
} from "@/lib/funnel";

export const dynamic = "force-dynamic";

// POST /api/track — beacon d'entonnoir (haut d'entonnoir anonyme uniquement).
// body { event, path? }. N'accepte QUE les événements marqués anonymes
// (landing_view / demo_start / signup_start) : les conversions (signup_complete,
// activation, checkout_start, purchase) sont écrites côté serveur et ne peuvent
// donc pas être gonflées depuis le navigateur.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const event = String(body.event ?? "");
  const path = body.path ? String(body.path).slice(0, 200) : undefined;

  if (!ANONYMOUS_EVENTS.has(event)) {
    return NextResponse.json({ error: "événement non autorisé" }, { status: 400 });
  }

  const visitorId = await getOrSetVisitorId();
  await recordFunnel(event as FunnelEventName, { visitorId, path });

  return new NextResponse(null, { status: 204 });
}
