"use server";

import { isEmailConfigured, sendDemoRequest } from "@/lib/email";

const CONTACT_EMAIL = "contact@meleta.app";
const isDev = process.env.NODE_ENV !== "production";

export type DemoRequestState = { ok: boolean; message: string };

export async function submitDemoRequest(
  _prev: DemoRequestState | null,
  formData: FormData,
): Promise<DemoRequestState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const organisme = String(formData.get("organisme") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const parrainage = String(formData.get("parrainage") ?? "").trim();

  if (!nom || !email || !email.includes("@")) {
    return { ok: false, message: "Merci de renseigner votre nom et un email valide." };
  }

  // eslint-disable-next-line no-console
  console.log(
    `[demande-demo] ${nom} <${email}> · ${organisme || "—"} : ${message || "—"}${parrainage ? ` (recommandé par ${parrainage})` : ""}`,
  );

  if (!isEmailConfigured()) {
    // Dev / email non configuré : on ne bloque pas le visiteur, mais rien n'est envoyé.
    if (isDev) {
      return {
        ok: true,
        message:
          "Demande enregistrée (mode dev — email non envoyé, voir la console serveur).",
      };
    }
    return {
      ok: false,
      message: `L'envoi a échoué. Écrivez-nous directement à ${CONTACT_EMAIL}.`,
    };
  }

  try {
    await sendDemoRequest(CONTACT_EMAIL, { nom, email, organisme, message, parrainage });
    return {
      ok: true,
      message: `Merci ${nom.split(" ")[0]} — nous avons bien reçu votre demande à l'adresse ${email}.`,
    };
  } catch (e) {
    console.error("[demande-demo] envoi échoué", e);
    return {
      ok: false,
      message: `L'envoi a échoué. Écrivez-nous directement à ${CONTACT_EMAIL}.`,
    };
  }
}
