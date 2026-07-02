// Erreur commune aux fournisseurs LLM (module séparé pour éviter les cycles d'import).
// Le nom historique « EvaluatorNotConfiguredError » est conservé : toutes les routes
// et actions l'attrapent déjà pour renvoyer un 503 clair.

export class EvaluatorNotConfiguredError extends Error {
  constructor(
    message = "Aucun fournisseur IA configuré : ajoutez la clé API du fournisseur choisi (MISTRAL_API_KEY ou ANTHROPIC_API_KEY).",
  ) {
    super(message);
    this.name = "EvaluatorNotConfiguredError";
  }
}
