-- Origine d'un témoignage : 'beta' (promoteur sollicité) ou 'spontaneous' (avis
-- laissé librement depuis le site). Ajout additif, valeur par défaut pour l'existant.
ALTER TABLE "testimonials" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'beta';
