// Autorisation des routes d'export admin : 403 pour un rôle insuffisant (convention
// existante, src/app/api/live/[id]/export/route.ts), jamais 404. Pas de base requise :
// la garde coupe avant toute requête Prisma.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSessionUser = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSessionUser: () => getSessionUser(),
}));

describe("export contacts — autorisation", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
  });

  it("renvoie 403 pour un rôle insuffisant (pas 404)", async () => {
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "formateur@example.invalid",
      role: "tenant_admin",
      tenantId: "t1",
      firstName: null,
      impersonating: false,
    });
    const { GET } = await import("../src/app/api/admin/export/contacts/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/export/contacts"));
    expect(res.status).toBe(403);
  });

  it("renvoie 403 si non connecté", async () => {
    getSessionUser.mockResolvedValue(null);
    const { GET } = await import("../src/app/api/admin/export/contacts/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/export/contacts"));
    expect(res.status).toBe(403);
  });
});

describe("export journal — autorisation", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
  });

  it("renvoie 403 pour un rôle insuffisant (pas 404)", async () => {
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "learner@example.invalid",
      role: "learner",
      tenantId: "t1",
      firstName: null,
      impersonating: false,
    });
    const { GET } = await import("../src/app/api/admin/export/journal/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/export/journal"));
    expect(res.status).toBe(403);
  });
});
