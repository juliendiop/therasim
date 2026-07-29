"use client";

// Bouton de soumission avec état « en cours » : dès le clic, il se désactive et affiche
// un spinner (via useFormStatus). Résout le manque de feedback sur les actions lentes
// (checkout, lancement de séance…) ET empêche le double-clic / la double soumission.
// À placer DANS un <form action={serverAction}>.
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export default function SubmitButton({
  children,
  className,
  disabled,
  pendingText,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Texte affiché pendant la soumission (sinon on garde `children` à côté du spinner). */
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${className ?? ""}`}
    >
      {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
      {pending ? pendingText ?? children : children}
    </button>
  );
}
