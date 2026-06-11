import type { Metadata } from "next";
import Link from "next/link";
import { Brain, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheraSim — entraînement clinique par compétences",
  description:
    "Apprendre et s'entraîner sur des cas cliniques réalistes, du feedback au fil de l'eau à l'autonomie complète.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html lang="fr">
      <body className="min-h-screen">
        <header className="border-b border-[var(--border)] bg-white">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
            <Link href="/catalogue" className="flex items-center gap-2 font-semibold">
              <Brain className="h-5 w-5 text-[var(--accent)]" />
              <span>TheraSim</span>
            </Link>
            <span className="hidden text-xs text-[var(--muted)] sm:inline">
              entraînement clinique par compétences
            </span>
            {user && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                {user.role === "super_admin" && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 font-medium text-[var(--accent)] hover:bg-indigo-100"
                  >
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </Link>
                )}
                <span className="hidden text-[var(--muted)] sm:inline">{user.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button className="text-[var(--muted)] hover:text-[var(--foreground)]">
                    Déconnexion
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
