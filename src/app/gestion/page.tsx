import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ASSIGNABLE_ROLES, ROLE_LABELS, canManageMembers } from "@/lib/roles";
import { createMember, removeMember, updateMemberRole } from "./actions";

export const dynamic = "force-dynamic";

export default async function GestionPage() {
  const user = await requireUser();
  if (!canManageMembers(user.role)) redirect("/catalogue");

  const [tenant, members] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Gestion de la plateforme</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Plateforme : <b>{tenant?.brandName || tenant?.nom}</b>. Déclarez vos formateurs et
        apprenants. Ils se connecteront avec leur email (lien magique ou mot de passe).
      </p>

      {/* Ajouter un membre */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Ajouter un membre
      </h2>
      <form
        action={createMember}
        className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-white p-4"
      >
        <div className="flex-1">
          <label className="text-xs font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="personne@exemple.fr"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Rôle</label>
          <select
            name="role"
            defaultValue="formateur"
            className="mt-1 rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Ajouter
        </button>
      </form>

      {/* Liste des membres */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Membres ({members.length})
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Rôle</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {members.map((m) => {
              const isSelf = m.id === user.id;
              const locked = m.role === "super_admin" || isSelf;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium">
                    {m.email}
                    {isSelf && <span className="ml-2 text-[11px] text-[var(--muted)]">(vous)</span>}
                  </td>
                  <td className="px-4 py-2">
                    {locked ? (
                      <span className="text-[var(--muted)]">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</span>
                    ) : (
                      <form action={updateMemberRole} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={m.id} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--accent)]">
                          OK
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!locked && (
                      <form action={removeMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs text-[var(--muted)] hover:text-red-600">
                          Retirer
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
