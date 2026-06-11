import { KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const user = await getSessionUser();
  const dbUser = user
    ? await prisma.user.findUnique({ where: { id: user.id } })
    : null;
  const hasPassword = Boolean(dbUser?.passwordHash);

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Mon compte
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Connecté en tant que <b>{user?.email}</b>.{" "}
        {hasPassword
          ? "Un mot de passe est défini — vous pouvez vous connecter avec."
          : "Aucun mot de passe défini : vous utilisez le lien magique. Définissez-en un ci-dessous pour une connexion directe."}
      </p>

      <h3 className="mt-6 text-sm font-semibold">
        {hasPassword ? "Changer mon mot de passe" : "Définir un mot de passe"}
      </h3>
      <PasswordForm />
    </div>
  );
}
