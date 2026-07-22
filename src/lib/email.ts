// Envoi d'emails via Resend (lien magique de connexion).
// Sans RESEND_API_KEY : non configuré (en dev on retombe sur le lien affiché à l'écran).

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY non configurée.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  // Domaine meleta.app vérifié sur Resend -> envoi possible vers n'importe qui.
  // Surchargeable via EMAIL_FROM (ex. pour changer l'adresse d'expéditeur).
  return process.env.EMAIL_FROM || "MELETA <noreply@meleta.app>";
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23">
    <h2 style="color:#0e5a54">MELETA</h2>
    <p>Voici votre lien de connexion. Il est valable 15 minutes et à usage unique.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#0e5a54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
        Se connecter
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280">Si le bouton ne marche pas, copiez ce lien :<br>${link}</p>
    <p style="font-size:13px;color:#6b7280">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  </div>`;

  await send(email, "Votre lien de connexion MELETA", html);
}

export async function sendPasswordReset(email: string, link: string): Promise<void> {
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23">
    <h2 style="color:#0e5a54">MELETA</h2>
    <p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 60 minutes
      et à usage unique.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#0e5a54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
        Choisir un nouveau mot de passe
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280">Si le bouton ne marche pas, copiez ce lien :<br>${link}</p>
    <p style="font-size:13px;color:#6b7280">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email —
      votre mot de passe actuel reste valable.</p>
  </div>`;
  await send(email, "Réinitialiser votre mot de passe MELETA", html);
}

export async function sendInvitation(
  email: string,
  link: string,
  brandName: string,
  roleLabel: string,
): Promise<void> {
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23">
    <h2 style="color:#0e5a54">${escapeHtml(brandName)}</h2>
    <p>Vous avez été ajouté·e à la plateforme <b>${escapeHtml(brandName)}</b> en tant que
      <b>${escapeHtml(roleLabel)}</b>.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#0e5a54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
        Accéder à la plateforme
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280">Si le bouton ne marche pas, copiez ce lien :<br>${link}</p>
    <p style="font-size:13px;color:#6b7280">Ce lien d'invitation est valable 7 jours.</p>
  </div>`;
  await send(email, `Invitation à rejoindre ${brandName}`, html);
}

/** Email libre (offres/relances) : texte échappé, retours à la ligne conservés,
 *  avec un bouton d'action optionnel (CTA) vers la plateforme. */
export async function sendCustomEmail(
  to: string,
  subject: string,
  bodyText: string,
  cta?: { url: string; label: string },
): Promise<void> {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#0e5a54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23;line-height:1.5">
    <div style="white-space:pre-line">${escapeHtml(bodyText)}</div>
    ${button}
  </div>`;
  await send(to, subject, html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

async function send(
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      html,
      ...(opts?.replyTo ? { reply_to: [opts.replyTo] } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend erreur ${res.status}: ${await res.text()}`);
  }
}

/**
 * Notifie l'équipe MELETA d'une demande de démo (landing publique — formulaire
 * « Écoles & organismes »). Envoyée à `to` (l'équipe), avec reply-to = le visiteur
 * pour pouvoir répondre directement sans ressaisir son adresse.
 */
export async function sendDemoRequest(
  to: string,
  input: {
    nom: string;
    email: string;
    organisme: string;
    message: string;
    parrainage?: string;
  },
): Promise<void> {
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1d23;line-height:1.6">
    <h2 style="color:#0e5a54">Nouvelle demande de démo</h2>
    <p><b>Nom :</b> ${escapeHtml(input.nom)}<br>
       <b>Email :</b> ${escapeHtml(input.email)}<br>
       ${input.organisme ? `<b>Établissement :</b> ${escapeHtml(input.organisme)}<br>` : ""}
       ${input.parrainage ? `<b>Recommandé par (ambassadeur) :</b> ${escapeHtml(input.parrainage)}<br>` : ""}
    </p>
    ${input.message ? `<p style="white-space:pre-line">${escapeHtml(input.message)}</p>` : ""}
    <p style="font-size:13px;color:#6b7280">Envoyé depuis la page d'accueil publique MELETA.</p>
  </div>`;
  await send(to, `Demande de démo — ${input.organisme || input.nom}`, html, {
    replyTo: input.email,
  });
}
