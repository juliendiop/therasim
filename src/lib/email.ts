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

// --- Bêta fermée -----------------------------------------------------------

const CONTACT_EMAIL = "contact@meleta.app";

/** Base publique pour les liens des emails (contexte sans requête HTTP : cron, webhook). */
function emailBaseUrl(): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, "");
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit && !explicit.includes("localhost")) return clean(explicit);
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${clean(prod)}`;
  return clean(explicit || "http://localhost:3000");
}

function frDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })
    : "la fin de la période";
}

/** Email de bienvenue, envoyé à la réclamation réussie d'une invitation. */
export async function sendBetaWelcome(
  to: string,
  input: {
    firstName: string | null;
    planLabel: string;
    monthlyCredits: number | null;
    endsAt: Date | null;
  },
): Promise<void> {
  const base = emailBaseUrl();
  const hello = input.firstName ? `Bonjour ${escapeHtml(input.firstName)},` : "Bonjour,";
  const credits =
    input.monthlyCredits !== null
      ? ` Vous disposez de <b>${input.monthlyCredits} crédits</b>, rechargés chaque mois de l'essai.`
      : "";

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1d23;line-height:1.6">
    <h2 style="color:#0e5a54">Votre accès bêta est ouvert</h2>
    <p>${hello}</p>
    <p>Le forfait <b>${escapeHtml(input.planLabel)}</b> vous est offert jusqu'au
       <b>${frDate(input.endsAt)}</b>.${credits}</p>
    <p><b>Aucune carte bancaire n'a été demandée.</b> À la fin de la période, l'accès s'arrête
       et rien ne vous est prélevé — vous n'avez aucune démarche à faire.</p>

    <p style="margin-top:24px"><b>Par où commencer</b></p>
    <ol style="padding-left:18px">
      <li>Ouvrez un domaine clinique et faites <b>un exercice</b> — c'est immédiat et gratuit en crédits.</li>
      <li>Lancez une <b>mise en situation</b> avec le patient simulé : c'est là que l'outil prend son sens.</li>
      <li>Regardez votre <b>carte de progression</b> : elle se remplit dès le premier essai.</li>
    </ol>
    <p style="margin:24px 0">
      <a href="${base}/accueil" style="background:#0e5a54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
        Commencer
      </a>
    </p>

    <p>Ce qui m'intéresse le plus, c'est <b>ce qui coince</b> : un exercice mal calibré, une réponse
       du patient qui sonne faux, un moment où vous décrochez. Répondez directement à cet email,
       il arrive dans ma boîte.</p>
    <p>Merci de participer à cette bêta.</p>
  </div>`;

  await send(to, "Votre accès bêta MELETA est ouvert", html, { replyTo: CONTACT_EMAIL });
}

/** Email de mi-parcours (J+45) : trois questions, envoyé par le cron quotidien. */
export async function sendBetaMidTrial(
  to: string,
  input: { firstName: string | null; endsAt: Date | null },
): Promise<void> {
  const hello = input.firstName ? `Bonjour ${escapeHtml(input.firstName)},` : "Bonjour,";

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1d23;line-height:1.6">
    <h2 style="color:#0e5a54">On est à la moitié — trois questions</h2>
    <p>${hello}</p>
    <p>Vous avez accès à MELETA depuis environ un mois et demi (l'essai court jusqu'au
       <b>${frDate(input.endsAt)}</b>). J'aimerais votre avis, même bref.</p>
    <ol style="padding-left:18px">
      <li>Qu'est-ce que vous avez utilisé le plus, et pourquoi ?</li>
      <li>Qu'est-ce qui vous a fait décrocher, ou que vous n'avez jamais ouvert ?</li>
      <li>Le nombre de crédits mensuels vous a-t-il semblé trop juste, correct, ou large ?</li>
    </ol>
    <p>La troisième compte particulièrement : c'est exactement ce que cette bêta doit mesurer.</p>
    <p>Répondez directement à cet email — deux lignes suffisent.</p>
  </div>`;

  await send(to, "MELETA — trois questions à mi-parcours", html, { replyTo: CONTACT_EMAIL });
}

/** Email de fin d'essai bêta (déclenché par Stripe 3 jours avant le terme). */
export async function sendBetaTrialEnd(
  to: string,
  input: {
    firstName: string | null;
    planLabel: string;
    endsAt: Date | null;
    couponCode: string | null;
  },
): Promise<void> {
  const hello = input.firstName ? `Bonjour ${escapeHtml(input.firstName)},` : "Bonjour,";
  const coupon = input.couponCode
    ? `<p>Si vous souhaitez continuer, le code <b>${escapeHtml(input.couponCode)}</b> vous est réservé
       en tant que bêta-testeur — à saisir au moment du paiement.</p>`
    : "";

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1d23;line-height:1.6">
    <h2 style="color:#0e5a54">Votre accès bêta se termine bientôt</h2>
    <p>${hello}</p>
    <p>Votre accès au forfait <b>${escapeHtml(input.planLabel)}</b> prend fin le
       <b>${frDate(input.endsAt)}</b>.</p>
    <p><b>Rien ne vous sera prélevé</b> : aucune carte bancaire n'a été enregistrée, et
       l'abonnement s'arrête tout seul. Vous n'avez aucune démarche à faire.</p>
    ${coupon}
    <p>Une dernière chose : si MELETA vous a été utile, quelques lignes sur ce que ça vous a
       apporté m'aideraient beaucoup. Répondez simplement à cet email.</p>
    <p>Merci d'avoir participé à cette bêta.</p>
  </div>`;

  await send(to, "Votre accès bêta MELETA se termine bientôt", html, { replyTo: CONTACT_EMAIL });
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
