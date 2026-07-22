"use client";

// Barre de navigation mobile (bas d'écran), visible uniquement sous `sm`.
// Résout l'absence de navigation sur téléphone : le header entasse ses liens
// derrière `hidden sm:flex`, laissant un apprenant sans moyen de passer de
// l'accueil au catalogue. Rendu pour les utilisateurs connectés uniquement.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Compass, Gift, History, Home } from "lucide-react";

type Item = { href: string; label: string; icon: React.ReactNode };

export default function MobileNav({
  showCredits,
  showAffiliation,
}: {
  showCredits: boolean;
  showAffiliation?: boolean;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/accueil", label: "Accueil", icon: <Home className="h-5 w-5" /> },
    { href: "/catalogue", label: "Domaines", icon: <Compass className="h-5 w-5" /> },
    { href: "/historique", label: "Historique", icon: <History className="h-5 w-5" /> },
  ];
  if (showCredits) {
    items.push({ href: "/credits", label: "Crédits", icon: <Coins className="h-5 w-5" /> });
  }
  if (showAffiliation) {
    items.push({ href: "/affiliation", label: "Ambassadeur", icon: <Gift className="h-5 w-5" /> });
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-5xl">
        {items.map((it) => {
          const active =
            pathname === it.href || (it.href !== "/accueil" && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
