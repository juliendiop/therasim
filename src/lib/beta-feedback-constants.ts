// Constantes PURES du questionnaire « impression à chaud » — sans `server-only`,
// pour être importables aussi bien côté serveur que par le formulaire client
// (feedback-form.tsx). La logique serveur (stockage, lecture) vit dans beta-feedback.ts.

/** Longueur maximale d'une réponse (garde-fou anti-abus, généreuse). */
export const FEEDBACK_ANSWER_MAX = 4000;

/** Les trois questions, dans l'ordre. Partagées par le formulaire et le backoffice. */
export const FEEDBACK_QUESTIONS = [
  "Qu'est-ce qui vous a le plus surpris, en bien ou en mal ?",
  "À quel moment avez-vous hésité, décroché ou eu envie d'abandonner ?",
  "Le feedback vous a-t-il semblé suffisamment précis et crédible ?",
] as const;
