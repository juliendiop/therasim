// eslint-config-next 16 expose directement des « flat configs » (tableaux).
// Les passer par FlatCompat les faisait valider comme des configs .eslintrc
// legacy : la validation échouait, et le formateur d'erreurs plantait en
// sérialisant les plugins (références circulaires) — d'où un message
// « Converting circular structure to JSON » qui masquait la vraie cause.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default eslintConfig;
