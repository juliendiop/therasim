import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

// --- Sessions (lien magique) ----------------------------------------------
// Session sans mot de passe : un JWT signé (jose) stocké dans un cookie httpOnly.
// Rôles : 'super_admin' (toi, plateforme) | 'tenant_admin' | 'learner'.

const SESSION_COOKIE = "ts_session";
const SESSION_TTL = "30d";
const TOKEN_TTL_MIN = 15; // durée de vie d'un lien magique

export type Role = "super_admin" | "tenant_admin" | "learner";
// `tenantId` = tenant ACTIF (= tenant de l'utilisateur, ou tenant impersonné par le super-admin).
// `imp` = true quand le super-admin accède à la plateforme d'un client.
export type SessionPayload = {
  userId: string;
  tenantId: string;
  role: Role;
  imp?: boolean;
};

// Identité applicative : tenantId est le tenant ACTIF (issu de la session).
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  impersonating: boolean;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(p: SessionPayload): Promise<string> {
  return new SignJWT({ tenantId: p.tenantId, role: p.role, imp: p.imp ?? false })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.sub),
      tenantId: String(payload.tenantId),
      role: payload.role as Role,
      imp: Boolean(payload.imp),
    };
  } catch {
    return null;
  }
}

/**
 * Identité applicative. `tenantId` est le tenant ACTIF (issu de la session) :
 * pour un utilisateur normal = son tenant ; pour un super-admin en impersonation
 * = le tenant du client consulté.
 */
export async function getSessionUser(): Promise<CurrentUser | null> {
  const s = await getSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: s.role,
    tenantId: s.tenantId,
    impersonating: Boolean(s.imp),
  };
}

/** Pour les Server Components : redirige vers /login si non connecté. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Réservé au super-admin (console plateforme). */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/catalogue");
  return user;
}

// --- Liens magiques --------------------------------------------------------

export async function createMagicToken(email: string, tenantId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
  await prisma.authToken.create({ data: { token, email, tenantId, expiresAt } });
  return token;
}

/** Valide un token magique (usage unique, non expiré) et renvoie email+tenant. */
export async function consumeMagicToken(token: string) {
  const row = await prisma.authToken.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { token }, data: { usedAt: new Date() } });
  return { email: row.email, tenantId: row.tenantId };
}
