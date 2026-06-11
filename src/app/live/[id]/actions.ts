"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isLiveOpen } from "@/lib/live";

// Rejoindre une session live (participant anonyme : prénom + nom).
export async function joinLive(formData: FormData) {
  const id = String(formData.get("sessionId"));
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!prenom || !nom) redirect(`/live/${id}?erreur=nom`);

  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session || !isLiveOpen(session)) redirect(`/live/${id}`);

  const participant = await prisma.liveParticipant.create({
    data: { sessionId: id, prenom, nom },
  });

  (await cookies()).set(`lp_${id}`, participant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  });

  redirect(`/live/${id}`);
}
