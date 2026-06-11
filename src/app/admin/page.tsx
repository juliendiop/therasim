import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [tenants, packs, frameworks, users, attempts] = await Promise.all([
    prisma.tenant.count(),
    prisma.pack.count(),
    prisma.framework.count({ where: { statut: "publie" } }),
    prisma.user.count(),
    prisma.attempt.count(),
  ]);

  const cards = [
    { label: "Plateformes clientes", value: tenants, href: "/admin/tenants" },
    { label: "Packs", value: packs, href: "/admin/packs" },
    { label: "Référentiels publiés", value: frameworks, href: "/admin/packs" },
    { label: "Utilisateurs", value: users, href: "/admin/tenants" },
    { label: "Essais réalisés", value: attempts, href: "/admin/tenants" },
  ];

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        Pilotage central de tes plateformes clientes : catalogue, packs, attribution des droits
        et supervision de l&apos;usage.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-[var(--border)] bg-white p-5 hover:border-[var(--accent)]"
          >
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="text-xs text-[var(--muted)]">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
