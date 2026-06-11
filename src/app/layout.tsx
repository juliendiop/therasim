import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Brain, Eye, Radio, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stopImpersonation } from "./admin/impersonate-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheraSim — entraînement clinique par compétences",
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

  const isPublic = !tenant || tenant.type === "public";
  const brandName = isPublic ? "TheraSim" : tenant!.brandName || tenant!.nom;
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
            <Link href="/catalogue" className="flex items-center gap-2.5">
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
            {isPublic && (
              <span className="hidden text-xs text-[var(--muted)] sm:inline">
                entraînement clinique par compétences
              </span>
            )}

            {user && (
              <div className="ml-auto flex items-center gap-2.5 text-sm">
                {(user.role === "super_admin" || user.role === "tenant_admin") && (
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

        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>

        <footer className="mx-auto max-w-5xl px-5 pb-10 pt-4 text-center text-xs text-[var(--muted)]">
          {isPublic ? (
            <>TheraSim — outil formatif, non certifiant.</>
          ) : (
            <>
              {brandName} · <span className="opacity-70">propulsé par TheraSim</span>
            </>
          )}
        </footer>
      </body>
    </html>
  );
}
