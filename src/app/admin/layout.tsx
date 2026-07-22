import Link from "next/link";
import {
  Activity,
  BookOpen,
  Building2,
  Coins,
  Cpu,
  CreditCard,
  Filter,
  Gift,
  KeyRound,
  LayoutGrid,
  Package,
  ShieldCheck,
  Wand2,
} from "lucide-react";
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
        <AdminLink href="/admin/credits" icon={<Coins className="h-4 w-4" />} label="Crédits & quotas" />
        <AdminLink href="/admin/facturation" icon={<CreditCard className="h-4 w-4" />} label="Facturation" />
        <AdminLink href="/admin/funnel" icon={<Filter className="h-4 w-4" />} label="Acquisition" />
        <AdminLink href="/admin/optimisation" icon={<Wand2 className="h-4 w-4" />} label="Optimisation" />
        <AdminLink href="/admin/affiliation" icon={<Gift className="h-4 w-4" />} label="Affiliation" />
        <AdminLink href="/admin/activity" icon={<Activity className="h-4 w-4" />} label="Journal d'activité" />
        <AdminLink href="/admin/compte" icon={<KeyRound className="h-4 w-4" />} label="Mon compte" />
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
