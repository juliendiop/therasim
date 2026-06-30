import { Coins } from "lucide-react";
import { creditSettings } from "@/lib/credits";
import { saveCreditSettings } from "./actions";
import GrantForm from "./grant-form";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const s = await creditSettings();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Crédits & quotas IA</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Les exercices QCM restent gratuits. Seules les mini-scènes et les entretiens simulés
        consomment des crédits.
      </p>

      {/* Réglages */}
      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Réglages
      </h3>
      <form
        action={saveCreditSettings}
        className="mt-3 grid gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2"
      >
        <Field
          name="welcome"
          label="Pack de bienvenue"
          hint="Crédits offerts à la création du compte."
          value={s.welcome}
        />
        <Field
          name="monthly"
          label="Recharge mensuelle"
          hint="Plancher de crédits gratuits rechargé chaque mois."
          value={s.monthly}
        />
        <Field
          name="costMiniscene"
          label="Coût d'une mini-scène"
          hint="Crédits débités au lancement."
          value={s.costMiniscene}
        />
        <Field
          name="costSimulation"
          label="Coût d'un entretien simulé"
          hint="Crédits débités au lancement."
          value={s.costSimulation}
        />
        <div className="sm:col-span-2">
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Enregistrer
          </button>
        </div>
      </form>

      {/* Octroi manuel */}
      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Offrir des crédits
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pratique en attendant le paiement en ligne : créditez directement le compte d&apos;un
        utilisateur.
      </p>
      <div className="mt-3">
        <GrantForm />
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  value,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
      />
      <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>
    </div>
  );
}
