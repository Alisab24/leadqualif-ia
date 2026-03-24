/**
 * api/emails/send.js
 * Helper centralisé Resend — envoie les emails transactionnels LeadQualif.
 *
 * Emails déclenchés :
 *   welcome         → après checkout.session.completed (trial démarré)
 *   trial_ending    → après customer.subscription.trial_will_end (J-3)
 *   payment_failed  → après invoice.payment_failed
 *   payment_ok      → après invoice.payment_succeeded (renouvellement)
 *
 * Variable d'env requise dans Vercel :
 *   RESEND_API_KEY        — clé API Resend
 *   RESEND_FROM_EMAIL     — ex: "LeadQualif <contact@leadqualif.com>"
 */

import { Resend } from 'resend';

// ── Expéditeurs ────────────────────────────────────────────────────────────────
// Ces emails sont automatiques (Stripe events, alertes, relances) → noreply
// Variables Vercel : SENDER_EMAIL_AUTO  (ex: noreply@send.leadqualif.com)
//                   RESEND_FROM_EMAIL   (fallback legacy)
const FROM = process.env.SENDER_EMAIL_AUTO
  ? `LeadQualif <${process.env.SENDER_EMAIL_AUTO}>`
  : (process.env.RESEND_FROM_EMAIL || 'LeadQualif <noreply@send.leadqualif.com>');

// ── Styles communs ─────────────────────────────────────────────────────────────
const BASE = `
  body { margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif; }
  a { color:#2563EB; }
`;

function shell({ preview = '', body = '' }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>LeadQualif</title>
  <style>${BASE}</style>
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${preview}</span>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#1e40af;padding:28px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="background:#2563EB;border-radius:8px;padding:6px 12px;font-weight:900;color:#fff;font-size:16px;letter-spacing:-0.5px;">LQ</div>
              <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">LeadQualif</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              LeadQualif · <a href="https://www.leadqualif.com" style="color:#94a3b8;">leadqualif.com</a>
              · <a href="mailto:contact@leadqualif.com" style="color:#94a3b8;">contact@leadqualif.com</a>
            </p>
            <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">
              Édité par ALIDJOLAN, LLC · Wilmington, DE, United States
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href, label) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;">
      ${label}
    </a>
  </div>`;
}

function info(label, value) {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:14px;font-weight:600;width:40%;">${label}</td>
    <td style="padding:6px 0;color:#1e293b;font-size:14px;">${value}</td>
  </tr>`;
}

// ── Templates ──────────────────────────────────────────────────────────────────

const PLAN_NAMES = { starter: 'Solo', growth: 'Agence', enterprise: 'Expert' };

function templateWelcome({ email, plan }) {
  const planName = PLAN_NAMES[plan] || 'Agence';
  return {
    subject: '🎉 Bienvenue sur LeadQualif — votre essai de 7 jours commence !',
    html: shell({
      preview: 'Votre essai gratuit de 7 jours est activé. Qualifiez vos leads avec l\'IA dès maintenant.',
      body: `
        <h1 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:800;">Bienvenue sur LeadQualif 🚀</h1>
        <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
          Votre essai gratuit de <strong>7 jours</strong> du plan <strong>${planName}</strong> est actif.
          Aucun prélèvement aujourd'hui — vous serez prélevé uniquement à l'issue de l'essai si vous continuez.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
          <tr><td>
            <p style="margin:0 0 12px;color:#0369a1;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Ce que vous avez maintenant</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${info('Plan actif', planName)}
              ${info('Durée de l\'essai', '7 jours gratuits')}
              ${info('Import leads', 'CSV / Excel')}
              ${info('Scoring IA', 'Activé')}
              ${info('Documents', 'Devis & Factures')}
            </table>
          </td></tr>
        </table>

        ${btn('https://www.leadqualif.com/dashboard', 'Accéder à mon espace →')}

        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
          Une question ? Répondez directement à cet email.
        </p>
      `,
    }),
  };
}

function templateTrialEnding({ email, daysLeft, plan }) {
  const planName = PLAN_NAMES[plan] || 'Agence';
  const urgentColor = daysLeft <= 1 ? '#dc2626' : '#ea580c';
  return {
    subject: `⏰ Votre essai LeadQualif se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
    html: shell({
      preview: `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai gratuit. Choisissez votre plan pour continuer.`,
      body: `
        <div style="background:${urgentColor};border-radius:10px;padding:14px 20px;margin:0 0 24px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:16px;font-weight:800;">
            ⏰ ${daysLeft === 0 ? 'Votre essai se termine aujourd\'hui' : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''} sur votre essai`}
          </p>
        </div>

        <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Continuez sans interruption</h2>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
          Votre essai du plan <strong>${planName}</strong> se termine bientôt.
          Pour éviter toute interruption d'accès à vos leads, choisissez votre plan maintenant.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px;border:1px solid #e2e8f0;">
          <tr><td>
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Tarifs</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${info('Solo', '49 €/mois — 1 utilisateur · 100 leads')}
              ${info('Agence ⭐', '149 €/mois — 5 utilisateurs · Leads illimités · IA')}
              ${info('Expert', '399 €/mois — Illimité · Multi-agences')}
            </table>
          </td></tr>
        </table>

        ${btn('https://www.leadqualif.com/settings?tab=facturation', 'Choisir mon plan →')}

        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
          Sans engagement · Annulation en 1 clic depuis les paramètres
        </p>
      `,
    }),
  };
}

function templatePaymentFailed({ email, plan }) {
  const planName = PLAN_NAMES[plan] || 'Agence';
  return {
    subject: '⚠️ Paiement échoué — mettez à jour votre carte LeadQualif',
    html: shell({
      preview: 'Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver votre accès.',
      body: `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 20px;margin:0 0 24px;">
          <p style="margin:0;color:#dc2626;font-size:15px;font-weight:700;">⚠️ Votre paiement a échoué</p>
        </div>

        <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Action requise</h2>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
          Le prélèvement pour votre plan <strong>${planName}</strong> n'a pas pu être effectué.
          Mettez à jour votre carte pour éviter la suspension de votre compte.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:12px;padding:20px 24px;margin:0 0 24px;border:1px solid #fed7aa;">
          <tr><td>
            <p style="margin:0;color:#92400e;font-size:14px;line-height:1.6;">
              <strong>Que se passe-t-il si je ne fais rien ?</strong><br/>
              Stripe effectue automatiquement 3 nouvelles tentatives sur 7 jours.
              Sans mise à jour, votre accès sera suspendu à l'issue de cette période.
            </p>
          </td></tr>
        </table>

        ${btn('https://www.leadqualif.com/settings?tab=facturation', 'Mettre à jour ma carte →')}

        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
          Besoin d'aide ? Répondez à cet email, nous vous aidons.
        </p>
      `,
    }),
  };
}

function templatePaymentOk({ email, plan, periodEnd }) {
  const planName = PLAN_NAMES[plan] || 'Agence';
  const nextDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  return {
    subject: `✅ Paiement confirmé — abonnement ${planName} renouvelé`,
    html: shell({
      preview: `Votre abonnement LeadQualif ${planName} est renouvelé. Prochain prélèvement le ${nextDate}.`,
      body: `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 20px;margin:0 0 24px;text-align:center;">
          <p style="margin:0;color:#16a34a;font-size:16px;font-weight:800;">✅ Paiement confirmé</p>
        </div>

        <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Votre abonnement est actif</h2>
        <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
          Merci ! Votre abonnement <strong>${planName}</strong> a été renouvelé avec succès.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px;border:1px solid #e2e8f0;">
          <tr><td>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${info('Plan', planName)}
              ${info('Prochain renouvellement', nextDate)}
              ${info('Gestion', 'Paramètres > Facturation')}
            </table>
          </td></tr>
        </table>

        ${btn('https://www.leadqualif.com/dashboard', 'Accéder à mon espace →')}
      `,
    }),
  };
}

// ── Envoi ──────────────────────────────────────────────────────────────────────

/**
 * Envoie un email transactionnel.
 * @param {'welcome'|'trial_ending'|'payment_failed'|'payment_ok'} type
 * @param {{ email: string, plan?: string, daysLeft?: number, periodEnd?: string }} params
 */
export async function sendTransactional(type, params) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY absent — email "${type}" non envoyé`);
    return;
  }
  if (!params.email) {
    console.warn(`[email] email manquant pour type "${type}"`);
    return;
  }

  let tpl;
  try {
    switch (type) {
      case 'welcome':        tpl = templateWelcome(params);        break;
      case 'trial_ending':   tpl = templateTrialEnding(params);    break;
      case 'payment_failed': tpl = templatePaymentFailed(params);  break;
      case 'payment_ok':     tpl = templatePaymentOk(params);      break;
      default:
        console.warn(`[email] Type inconnu : ${type}`);
        return;
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [params.email],
      subject: tpl.subject,
      html: tpl.html,
    });

    if (error) console.error(`[email] Resend error (${type}):`, error);
    else console.log(`[email] ✅ "${type}" envoyé à ${params.email} | id: ${data?.id}`);
  } catch (err) {
    console.error(`[email] Exception (${type}):`, err.message);
  }
}
