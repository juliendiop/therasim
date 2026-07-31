# Migrations archivées le 2026-07-31

Baseline du 23-24 juillet + 5 migrations, remplacés par un nouveau baseline `0_init`
régénéré depuis `schema.prisma` (option a). Motif : les changements de schéma des
modules 43-46 (credit_packs, frameworks.nature/tier/slug…, stripe_price_id_yearly)
avaient été appliqués en `db:push` et manquaient à l'historique.
Conservés ici pour référence uniquement — ne sont plus lus par Prisma.
