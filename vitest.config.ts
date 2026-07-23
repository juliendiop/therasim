import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Les tests adossés à la base doivent s'exécuter en série (ils partagent des
    // lignes) et disposer d'un délai large : Neon est distant.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // `server-only` lève hors du runtime serveur de Next : neutralisé pour pouvoir
      // tester les modules métier (credits, beta…) qui l'importent légitimement.
      "server-only": resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
