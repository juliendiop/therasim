// Composant partagé, purement présentationnel (pas de "use client" nécessaire) :
// utilisable depuis des Server ou Client Components.
import { patientAvatarStyle, patientInitials } from "@/lib/patient";

const SIZE_CLS = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-lg",
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
  const style = patientAvatarStyle(seed);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${SIZE_CLS[size]}`}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {patientInitials(name)}
    </span>
  );
}
