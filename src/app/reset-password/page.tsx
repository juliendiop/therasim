import Link from "next/link";
import { Brain } from "lucide-react";
import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";

// Page de réinitialisation : le token (usage unique, 60 min) vient du lien email.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm animate-in">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md">
          <Brain className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>

      <div className="card-soft mt-8 p-6">
        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="text-sm">
            <p className="text-red-600">Lien invalide : le jeton est manquant.</p>
            <Link
              href="/login"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
            >
              ← Revenir à la connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
