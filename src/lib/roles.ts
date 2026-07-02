// Rôles et permissions (centralisé).
import type { Role } from "./auth";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super-admin",
  tenant_admin: "Admin de plateforme",
  formateur: "Formateur",
  learner: "Apprenant",
};

/** Peut créer/animer des sessions live (études de cas). */
export function canManageLive(role: Role): boolean {
  return role === "super_admin" || role === "tenant_admin" || role === "formateur";
}

/** Peut consulter la progression et les débriefs des apprenants de sa plateforme. */
export function canSupervise(role: Role): boolean {
  return role === "super_admin" || role === "tenant_admin" || role === "formateur";
}

/** Peut gérer les membres de sa plateforme (déclarer formateurs / apprenants). */
export function canManageMembers(role: Role): boolean {
  return role === "super_admin" || role === "tenant_admin";
}

/** Rôles qu'un gestionnaire peut attribuer aux membres de sa plateforme. */
export const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: "learner", label: "Apprenant" },
  { value: "formateur", label: "Formateur" },
  { value: "tenant_admin", label: "Admin de plateforme" },
];
