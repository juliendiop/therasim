import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Brain, ClipboardList, Coins, Eye, GraduationCap, Radio, ShieldCheck, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageLive, canSupervise } from "@/lib/roles";
import { syncWallet } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { stopImpersonation } from "./admin/impersonate-actions";
import MobileNav from "./_components/mobile-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MELETA — entraînement clinique par compétences",
  description:
    "Apprendre et s'entraîner sur des cas cliniques réalistes, du feedback au fil de l'eau à l'autonomie complète.",
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  const tenant = user
    ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
    : null;
  // Solde de crédits pour les apprenants (initialise le pack de bienvenue au 1er accès).
  const credits = user && user.role === "learner" ? await syncWallet(user.id) : null;

  const isPublic = !tenant || tenant.type === "public";
  const brandName = isPublic ? "MELETA" : tenant!.brandName || tenant!.nom;
  const logoUrl = !isPublic ? tenant!.logoUrl : null;
  const color =
    !isPublic && tenant!.colorPrimary && HEX.test(tenant!.colorPrimary)
      ? tenant!.colorPrimary
      : null;
  const impersonating = Boolean(user?.impersonating && tenant);

  const bodyStyle = color ? ({ "--accent": color } as CSSProperties) : undefined;

  return (
    <html lang="fr">
      <body className="min-h-screen" style={bodyStyle}>
        {impersonating && (
          <div className="bg-[var(--accent)] text-white">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-2 text-sm">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                Vous consultez la plateforme : <b>{tenant!.nom}</b>
              </span>
              <form action={stopImpersonation} className="ml-auto">
                <button className="rounded-md bg-white/20 px-3 py-1 font-medium transition hover:bg-white/30">
                  Quitter
                </button>
              </form>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3.5">
            <Link href={user ? "/accueil" : "/"} className="flex items-center gap-2.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandName} className="h-7 w-auto object-contain" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white shadow-sm">
                  <Brain className="h-[18px] w-[18px]" />
                </span>
              )}
              <span className="text-[15px] font-semibold tracking-tight">{brandName}</span>
            </Link>
            {isPublic && !user && (
              <span className="hidden text-xs text-[var(--muted)] sm:inline">
                entraînement clinique par compétences
              </span>
            )}
            {user && (
              <nav className="ml-2 hidden items-center gap-1 text-sm sm:flex">
                <Link
                  href="/accueil"
                  className="rounded-lg px-2.5 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                >
                  Accueil
                </Link>
                <Link
                  href="/catalogue"
                  className="rounded-lg px-2.5 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                >
                  Domaines
                </Link>
                <Link
                  href="/historique"
                  className="rounded-lg px-2.5 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                >
                  Historique
                </Link>
              </nav>
            )}

            {!user && (
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                >
                  Se connecter
                </Link>
                <Link
                  href="/inscription"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
                >
                  Créer un compte
                </Link>
              </div>
            )}
            {user && (
              <div className="ml-auto flex items-center gap-2.5 text-sm">
                {credits !== null && (
                  <Link
                    href="/credits"
                    title="Vos crédits de pratique IA"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-semibold text-[var(--accent)] transition hover:brightness-95"
                  >
                    <Coins className="h-4 w-4" /> {credits}
                  </Link>
                )}
                {(user.role === "tenant_admin" ||
                  (user.role === "super_admin" && user.impersonating)) && (
                  <Link
                    href="/gestion"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                  >
                    <Users className="h-4 w-4" /> Gestion
                  </Link>
                )}
                {canManageLive(user.role) && (
                  <Link
                    href="/formations"
                    className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:inline-flex"
                  >
                    <GraduationCap className="h-4 w-4" /> Formations
                  </Link>
                )}
                {canSupervise(user.role) && (
                  <Link
                    href="/supervision"
                    className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:inline-flex"
                  >
                    <ClipboardList className="h-4 w-4" /> Supervision
                  </Link>
                )}
                {canManageLive(user.role) && (
                  <Link
                    href="/sessions"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                  >
                    <Radio className="h-4 w-4" /> Sessions live
                  </Link>
                )}
                {user.role === "super_admin" && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
                  >
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </Link>
                )}
                <span className="hidden text-[var(--muted)] sm:inline">{user.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button className="rounded-lg px-2.5 py-1.5 text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]">
                    Déconnexion
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        {/* pb-20 sur mobile : réserve la place de la barre de navigation basse. */}
        <main className="mx-auto max-w-5xl px-5 py-8 pb-24 sm:pb-8">{children}</main>

        <footer className="mx-auto max-w-5xl px-5 pb-24 pt-4 text-center text-xs text-[var(--muted)] sm:pb-10">
          {isPublic ? (
            <>MELETA — outil formatif, non certifiant.</>
          ) : (
            <>
              {brandName} · <span className="opacity-70">propulsé par MELETA</span>
            </>
          )}
        </footer>

        {/* Navigation mobile (connectés) : le header cache ses liens sous `sm`. */}
        {user && <MobileNav showCredits={credits !== null} />}
      </body>
    </html>
  );
}
