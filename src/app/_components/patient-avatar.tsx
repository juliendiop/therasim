// Composant partagé, purement présentationnel (pas de "use client" nécessaire) :
// utilisable depuis des Server ou Client Components. Le portrait est généré
// côté serveur (voir /api/patient-avatar) — jamais de dépendance lourde côté client.

const SIZE_CLS = {
  sm: "h-6 w-6",
  md: "h-9 w-9",
  lg: "h-14 w-14",
} as const;

export default function PatientAvatar({
  name,
  seed,
  size = "md",
}: {
  name: string;
  seed: string;
  size?: keyof typeof SIZE_CLS;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/patient-avatar?seed=${encodeURIComponent(seed)}`}
      alt={name}
      className={`inline-block shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-tint)] object-cover ${SIZE_CLS[size]}`}
    />
  );
}
