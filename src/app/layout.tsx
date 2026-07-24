import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Brain, ClipboardList, Coins, Eye, Gift, GraduationCap, LogOut, Radio, ShieldCheck, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canManageLive, canSupervise } from "@/lib/roles";
import { creditSettings, syncWallet, syncSubscriptionCredits, getWalletView } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { stopImpersonation } from "./admin/impersonate-actions";
import MobileNav from "./_components/mobile-nav";
import LowCreditsBanner from "./_components/low-credits-banner";
import SupportWidget from "./_components/support-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "MELETA — entraînement clinique par compétences",
  description:
    "Apprendre et s'entraîner sur des cas cliniques réalistes, du feedback au fil de l'eau à l'autonomie complète.",
};

// Viewport mobile explicite : garantit l'échelle 1:1 (évite l'effet « page
// dézoomée » sur téléphone). `userScalable` laissé actif pour l'accessibilité.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  const tenant = user
    ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
    : null;
  // Crédits du forfait (abonnement OU essai) d'abord : `syncWallet` ne complète
  // ensuite que si le solde est sous le plancher freemium, donc l'ordre compte.
  if (user?.role === "learner") await syncSubscriptionCredits(user.id);
  // Solde de crédits pour les apprenants (initialise le pack de bienvenue au 1er accès).
  // `syncWallet` renvoie le TOTAL (portefeuille + allocation de forfait).
  const credits = user && user.role === "learner" ? await syncWallet(user.id) : null;
  const wallet = user && user.role === "learner" ? await getWalletView(user.id) : null;
  const settings = credits !== null ? await creditSettings() : null;
  // Seuil du bandeau bas-solde : 20 % du pack de bienvenue.
  const lowThreshold = settings ? Math.ceil(settings.welcome * 0.2) : 0;
  const creditsTooltip = settings
    ? `${credits} crédits\n${
        wallet && wallet.plan > 0
          ? `dont ${wallet.plan} de forfait (non reportés au mois suivant)\n`
          : ""
      }Mini-scène : ${settings.costMiniscene} crédit${settings.costMiniscene > 1 ? "s" : ""} · Entretien simulé : ${settings.costSimulation} crédits\nExercices : gratuits`
    : undefined;

  const isPublic = !tenant || tenant.type === "public";
  // Programme ambassadeur : pertinent pour les apprenants du site public, ou
  // les membres B2B dont la plateforme a activé l'opt-in "offres individuelles"
  // (même logique que canBuyIndividualOffers, src/lib/entitlements.ts).
  const affiliationEligible =
    Boolean(user) &&
    user!.role === "learner" &&
    (isPublic || Boolean(tenant?.allowIndividualOffers));
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
                {affiliationEligible && (
                  <Link
                    href="/affiliation"
                    className="rounded-lg px-2.5 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)]"
                  >
                    Ambassadeur
                  </Link>
                )}
              </nav>
            )}

            {!user && (
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/tarifs"
                  className="hidden items-center rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:inline-flex"
                >
                  Tarifs
                </Link>
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
              <div className="ml-auto flex items-center gap-1.5 text-sm sm:gap-2.5">
                {credits !== null && (
                  <Link
                    href="/credits"
                    title={creditsTooltip}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-semibold text-[var(--accent)] transition hover:brightness-95"
                  >
                    <Coins className="h-4 w-4" /> {credits}
                  </Link>
                )}
                {/* Liens outils (admin/formateur) : icône seule sur mobile pour
                    éviter que le header ne déborde ; libellé visible dès `sm`. */}
                {(user.role === "tenant_admin" ||
                  (user.role === "super_admin" && user.impersonating)) && (
                  <Link
                    href="/gestion"
                    title="Gestion"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:px-3"
                  >
                    <Users className="h-4 w-4" /> <span className="hidden sm:inline">Gestion</span>
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
                    title="Sessions live"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:px-3"
                  >
                    <Radio className="h-4 w-4" /> <span className="hidden sm:inline">Sessions live</span>
                  </Link>
                )}
                {user.role === "super_admin" && (
                  <Link
                    href="/admin"
                    title="Admin"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-2 py-1.5 font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)] sm:px-3"
                  >
                    <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                {/* Ouverture d'un ticket depuis n'importe quelle page (modale). */}
                <SupportWidget />
                <span className="hidden text-[var(--muted)] lg:inline">{user.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button
                    title="Déconnexion"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[var(--muted)] transition hover:bg-gray-100 hover:text-[var(--foreground)] sm:px-2.5"
                  >
                    <LogOut className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Déconnexion</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        {/* Bandeau discret bas-solde (apprenants uniquement, 1× par session navigateur). */}
        {credits !== null && <LowCreditsBanner credits={credits} threshold={lowThreshold} />}

        {/* pb-20 sur mobile : réserve la place de la barre de navigation basse. */}
        <main className="mx-auto max-w-5xl px-5 py-8 pb-24 sm:pb-8">{children}</main>

        <footer className="mx-auto max-w-5xl px-5 pb-24 pt-4 text-center text-xs text-[var(--muted)] sm:pb-10">
          {isPublic ? (
            <>
              MELETA — outil formatif, non certifiant. ·{" "}
              <Link href="/tarifs" className="underline hover:text-[var(--foreground)]">
                Tarifs
              </Link>{" "}
              ·{" "}
              <Link href="/blog" className="underline hover:text-[var(--foreground)]">
                Blog
              </Link>{" "}
              ·{" "}
              <Link href="/ambassadeurs" className="underline hover:text-[var(--foreground)]">
                Ambassadeurs
              </Link>
              {user && (
                <>
                  {" "}
                  ·{" "}
                  <Link href="/avis" className="underline hover:text-[var(--foreground)]">
                    Laisser un avis
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              {brandName} · <span className="opacity-70">propulsé par MELETA</span>
            </>
          )}
        </footer>

        {/* Navigation mobile (connectés) : le header cache ses liens sous `sm`. */}
        {user && <MobileNav showCredits={credits !== null} showAffiliation={affiliationEligible} />}
      </body>
    </html>
  );
}
