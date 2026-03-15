/**
 * Vercel Serverless Function — /api/send-invitation
 *
 * Envoie un email d'invitation à rejoindre une agence sur LeadQualif IA.
 * Utilise Resend (resend.com) pour l'envoi.
 *
 * Variables d'environnement requises dans Vercel Dashboard :
 *   RESEND_API_KEY  — clé API Resend (https://resend.com/api-keys)
 *
 * Payload attendu (POST JSON) :
 *   { email, nom, lienInvitation }
 */

import { Resend } from 'resend';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Méthode non autorisée' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-invitation] RESEND_API_KEY non configurée dans les variables Vercel');
    // On retourne quand même 200 pour que l'invitation DB soit sauvegardée
    return res.status(200).json({
      sent: false,
      message: 'Email non envoyé — RESEND_API_KEY non configurée. Configurez-la dans Vercel Dashboard > Settings > Environment Variables.'
    });
  }

  const { email, nom, lienInvitation } = req.body || {};

  if (!email || !lienInvitation) {
    return res.status(400).json({ error: true, message: 'email et lienInvitation sont requis' });
  }

  const agencyName = nom || 'LeadQualif';

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      // Utilise le domaine Resend par défaut si pas de domaine custom vérifié
      // Pour utiliser votre propre domaine, vérifiez-le sur resend.com/domains
      from: process.env.RESEND_FROM_EMAIL || 'LeadQualif IA <onboarding@resend.dev>',
      to: [email],
      subject: `Invitation à rejoindre ${agencyName} sur LeadQualif IA`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invitation LeadQualif IA</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:28px;">🚀</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">LeadQualif IA</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Plateforme de qualification de leads</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">
              Vous êtes invité(e) ! 🎉
            </h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              <strong>${agencyName}</strong> vous invite à rejoindre leur espace de travail sur <strong>LeadQualif IA</strong> — la plateforme de gestion et qualification de leads.
            </p>

            <div style="background:#f1f5f9;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
              <p style="margin:0;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Ce que vous pourrez faire</p>
              <ul style="margin:12px 0 0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.8;">
                <li>Accéder aux leads qualifiés de l'agence</li>
                <li>Utiliser l'analyse IA pour prioriser vos prospects</li>
                <li>Générer devis et factures en quelques clics</li>
                <li>Suivre les statistiques en temps réel</li>
              </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${lienInvitation}"
                style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
                ✅ Accepter l'invitation
              </a>
            </div>

            <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-align:center;">
              Ou copiez ce lien dans votre navigateur :
            </p>
            <p style="margin:0;word-break:break-all;color:#6366f1;font-size:12px;text-align:center;font-family:monospace;">
              ${lienInvitation}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Ce lien est valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez simplement cet email.
            </p>
            <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">
              LeadQualif IA · leadqualif.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('[send-invitation] Resend error:', error);
      return res.status(500).json({ error: true, message: error.message });
    }

    console.log('[send-invitation] Email envoyé à', email, '| id:', data?.id);
    return res.status(200).json({ sent: true, id: data?.id });

  } catch (err) {
    console.error('[send-invitation] Exception:', err.message);
    return res.status(500).json({ error: true, message: err.message });
  }
}
