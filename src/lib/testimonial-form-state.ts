// État partagé du formulaire de témoignage/avis (module neutre, sans directive),
// pour que le composant client et les deux actions serveur (relance bêta + avis
// spontané) s'accordent sur le même type.
export type TestimonialFormState = { ok: boolean; message?: string } | null;
