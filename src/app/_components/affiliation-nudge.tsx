import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";

// Encart discret invitant un utilisateur satisfait à rejoindre le programme
// ambassadeur. Ton sobre (MELETA reste un outil clinique) : « recommandez un
// outil que vous appréciez », pas « gagnez de l'argent ». Réutilisé sur
// /accueil, /credits et /tarifs. `rateTier1` vient d'AppConfig (jamais en dur).
export default function AffiliationNudge({
  rateTier1,
  href = "/affiliation",
  className = "",
}: {
  rateTier1: number;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 transition hover:brightness-[0.98] ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--accent)] shadow-sm">
        <Gift className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Recommandez MELETA, touchez une commission</div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Vous appréciez MELETA ? Devenez ambassadeur et gagnez {rateTier1} % sur chaque
          abonnement que vous parrainez — versé tant que la personne reste abonnée.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--accent)] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
