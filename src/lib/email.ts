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
  // Par défaut : domaine de test Resend (n'autorise l'envoi qu'à l'email du compte Resend).
  // Pour envoyer à tout le monde : vérifier un domaine et régler EMAIL_FROM.
  return process.env.EMAIL_FROM || "MELETA <onboarding@resend.dev>";
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend erreur ${res.status}: ${await res.text()}`);
  }
}
