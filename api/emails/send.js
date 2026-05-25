/**
 * api/emails/send.js
 * Envoi d'emails transactionnels via Resend
 *
 * Templates gérés :
 *   welcome        → bienvenue / essai démarré
 *   trial_ending   → J-3 avant fin de l'essai gratuit
 *   payment_ok     → renouvellement / paiement confirmé
 *   payment_failed → paiement échoué, accès suspendu
 *
 * Variables d'env requises :
 *   RESEND_API_KEY    → clé Resend (obligatoire)
 *   SENDER_EMAIL_AUTO → expéditeur (défaut : noreply@send.leadqualif.com)
 */

const RESEND_API = 'https://api.resend.com/emails'

const PLAN_NAMES = {
  starter:    'Solo',
  growth:     'Agence',
  enterprise: 'Expert',
  trialing:   'Agence (essai)',
}

// ── Templates ─────────────────────────────────────────────────────────────────

function buildWelcome({ email, plan }) {
  const planName = PLAN_NAMES[plan] || plan
  return {
    subject: `🎉 Bienvenue sur LeadQualif — votre essai ${planName} démarre !`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b">
        <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Bienvenue sur LeadQualif 🚀</h1>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;border-radius:0 0 12px 12px">
          <p style="font-size:16px">Bonjour,</p>
          <p>Votre période d'essai <strong>${planName}</strong> de <strong>14 jours</strong> vient de démarrer. Toutes les fonctionnalités sont débloquées, profitez-en !</p>
          <ul style="line-height:2">
            <li>🤖 Agent IA Auto-Contact</li>
            <li>📅 Booking automatique</li>
            <li>📊 Stats & Analytics</li>
            <li>📄 Factures & devis illimités</li>
            <li>👥 Gestion d'équipe</li>
          </ul>
          <div style="text-align:center;margin:24px 0">
            <a href="https://www.leadqualif.com/dashboard"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
              Accéder à mon espace →
            </a>
          </div>
          <p style="font-size:13px;color:#64748b">
            Des questions ? Répondez simplement à cet email — notre équipe vous répond sous 24h.
          </p>
          <p style="font-size:13px;color:#94a3b8;margin-top:24px">
            — L'équipe LeadQualif · <a href="https://www.leadqualif.com" style="color:#94a3b8">leadqualif.com</a>
          </p>
        </div>
      </div>
    `,
  }
}

function buildTrialEnding({ email, plan, daysLeft }) {
  const planName = PLAN_NAMES[plan] || plan
  const urgency  = daysLeft <= 1 ? '🚨' : '⏰'
  const dayLabel = daysLeft === 0
    ? "se termine aujourd'hui"
    : daysLeft === 1
    ? 'se termine demain'
    : `se termine dans ${daysLeft} jours`

  return {
    subject: `${urgency} Votre essai LeadQualif ${dayLabel} — choisissez votre plan`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b">
        <div style="background:${daysLeft <= 1 ? '#dc2626' : '#d97706'};padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">${urgency} Votre essai ${dayLabel}</h1>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;border-radius:0 0 12px 12px">
          <p>Bonjour,</p>
          <p>Votre période d'essai <strong>${planName}</strong> ${dayLabel}. Pour continuer à utiliser toutes les fonctionnalités sans interruption, choisissez votre plan maintenant.</p>
          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;font-size:14px">
            ⚠️ Sans abonnement actif, votre accès sera limité au plan Gratuit (10 leads/mois, sans IA ni documents).
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="https://www.leadqualif.com/settings?tab=facturation"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
              Choisir mon plan →
            </a>
          </div>
          <p style="font-size:13px;color:#94a3b8;margin-top:24px">— L'équipe LeadQualif</p>
        </div>
      </div>
    `,
  }
}

function buildPaymentOk({ email, plan, periodEnd }) {
  const planName   = PLAN_NAMES[plan] || plan
  const renewalStr = periodEnd
    ? `Prochain renouvellement : <strong>${new Date(periodEnd).toLocaleDateString('fr-FR')}</strong>`
    : ''

  return {
    subject: `✅ Paiement confirmé — LeadQualif ${planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b">
        <div style="background:#16a34a;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">✅ Paiement confirmé</h1>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;border-radius:0 0 12px 12px">
          <p>Bonjour,</p>
          <p>Votre abonnement <strong>LeadQualif ${planName}</strong> a été renouvelé avec succès.</p>
          ${renewalStr ? `<p style="font-size:14px;color:#475569">${renewalStr}</p>` : ''}
          <div style="text-align:center;margin:24px 0">
            <a href="https://www.leadqualif.com/settings?tab=facturation"
               style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
              Voir mes factures →
            </a>
          </div>
          <p style="font-size:13px;color:#94a3b8;margin-top:24px">— L'équipe LeadQualif</p>
        </div>
      </div>
    `,
  }
}

function buildPaymentFailed({ email, plan }) {
  const planName = PLAN_NAMES[plan] || plan

  return {
    subject: `🚨 Échec de paiement — Votre accès LeadQualif est suspendu`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b">
        <div style="background:#dc2626;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🚨 Paiement en échec</h1>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;border-radius:0 0 12px 12px">
          <p>Bonjour,</p>
          <p>Nous n'avons pas pu traiter votre paiement pour l'abonnement <strong>LeadQualif ${planName}</strong>.</p>
          <p style="background:#fef2f2;border:1px solid #fca5a5;padding:12px 16px;border-radius:8px;font-size:14px;color:#991b1b">
            ⚠️ Votre accès sera suspendu sous 72h si le paiement n'est pas régularisé.
          </p>
          <p>Pour éviter toute interruption :</p>
          <ol style="line-height:1.8;font-size:14px">
            <li>Vérifiez que votre carte bancaire est à jour</li>
            <li>Vérifiez que les fonds sont suffisants</li>
            <li>Contactez votre banque si besoin</li>
          </ol>
          <div style="text-align:center;margin:24px 0">
            <a href="https://www.leadqualif.com/settings?tab=facturation"
               style="background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
              Mettre à jour mon paiement →
            </a>
          </div>
          <p style="font-size:13px;color:#64748b">
            Si vous rencontrez des difficultés, répondez à cet email — notre équipe vous aide immédiatement.
          </p>
          <p style="font-size:13px;color:#94a3b8;margin-top:24px">— L'équipe LeadQualif</p>
        </div>
      </div>
    `,
  }
}

// ── Builders map ──────────────────────────────────────────────────────────────

const TEMPLATES = {
  welcome:       buildWelcome,
  trial_ending:  buildTrialEnding,
  payment_ok:    buildPaymentOk,
  payment_failed: buildPaymentFailed,
}

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Envoie un email transactionnel via Resend.
 * Ne lève jamais d'erreur bloquante : les erreurs sont loguées mais ne font pas planter le webhook.
 *
 * @param {string} template  - Clé du template (welcome, trial_ending, payment_ok, payment_failed)
 * @param {object} data      - { email, plan, ...rest }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendTransactional(template, data = {}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn(`[emails] RESEND_API_KEY absent — email "${template}" non envoyé`)
    return { ok: false, error: 'RESEND_API_KEY absent' }
  }

  const builder = TEMPLATES[template]
  if (!builder) {
    console.warn(`[emails] Template inconnu : "${template}"`)
    return { ok: false, error: `Template inconnu : ${template}` }
  }

  const { subject, html } = builder(data)
  const from = process.env.SENDER_EMAIL_AUTO || 'noreply@send.leadqualif.com'

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [data.email],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[emails] Resend erreur ${res.status} pour "${template}":`, err)
      return { ok: false, error: err }
    }

    console.log(`[emails] Email "${template}" envoyé à ${data.email}`)
    return { ok: true }
  } catch (err) {
    // Ne pas faire planter le webhook pour un email non envoyé
    console.error(`[emails] Exception lors de l'envoi "${template}":`, err.message)
    return { ok: false, error: err.message }
  }
}
