import Link from "next/link";
import { BookOpen, Building2, Cpu, LayoutGrid, Package, ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Console super-admin</h1>
      </div>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <AdminLink href="/admin" icon={<LayoutGrid className="h-4 w-4" />} label="Vue d'ensemble" />
        <AdminLink href="/admin/tenants" icon={<Building2 className="h-4 w-4" />} label="Plateformes clientes" />
        <AdminLink href="/admin/referentiels" icon={<BookOpen className="h-4 w-4" />} label="Référentiels (contenu)" />
        <AdminLink href="/admin/packs" icon={<Package className="h-4 w-4" />} label="Packs & catalogue" />
        <AdminLink href="/admin/modeles" icon={<Cpu className="h-4 w-4" />} label="Modèles IA" />
      </nav>
      {children}
    </div>
  );
}

function AdminLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {icon} {label}
    </Link>
  );
}
