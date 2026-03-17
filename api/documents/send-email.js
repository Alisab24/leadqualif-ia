/**
 * api/documents/send-email.js
 * Envoie un document (devis/facture/contrat...) par email au prospect via Resend.
 * Génère un vrai PDF côté serveur via pdfshift.io (gratuit 250 req/mois).
 * Fallback HTML inline si pdfshift n'est pas configuré.
 *
 * POST /api/documents/send-email
 * Body: { documentId: string }
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY, RESEND_FROM_EMAIL
 *   PDFSHIFT_API_KEY  (optionnel — https://pdfshift.io, gratuit 250/mois)
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' }, // Body léger : juste { documentId }
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL || 'NexaPro <contact@nexapro.tech>';

// ── Labels par type de document ────────────────────────────────────────────────
const TYPE_LABELS = {
  devis:           'Devis',
  facture:         'Facture',
  contrat:         'Contrat de prestation',
  rapport:         'Rapport de performance',
  mandat:          'Mandat immobilier',
  compromis:       'Compromis de vente',
  bon_visite:      'Bon de visite',
  contrat_gestion: 'Contrat de gestion',
};

// ── Génère un PDF en binaire (Buffer) via l'API pdfshift.io ───────────────────
async function generatePdfWithPdfshift(htmlContent) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) throw new Error('PDFSHIFT_API_KEY non configuré');

  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method:  'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api_key:${apiKey}`).toString('base64'),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      source:     htmlContent,
      format:     'A4',
      margin:     { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      use_print:  false,
      javascript: false,  // Pas besoin de JS pour des documents statiques
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`pdfshift ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer); // Retourne un Buffer binaire
}

// ── Email sobre (avec PDF en pièce jointe) ────────────────────────────────────
function buildEmailWithPdf({ clientNom, label, reference, agencyName, agencyEmail, totalTtc, devise }) {
  const montant = totalTtc
    ? `${Number(totalTtc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${devise || '€'}`
    : null;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif; }
    .wrap { max-width:600px;margin:0 auto;padding:24px 16px; }
    .hdr  { background:#1e3a5f;color:#fff;padding:22px 28px;border-radius:12px 12px 0 0; }
    .hdr h1 { margin:0;font-size:20px;font-weight:700; }
    .hdr p  { margin:6px 0 0;font-size:13px;opacity:.75; }
    .body { background:#fff;padding:28px;border-radius:0 0 12px 12px; }
    .body p { margin:0 0 14px;font-size:15px;color:#374151;line-height:1.65; }
    .attachment-badge {
      display:inline-flex;align-items:center;gap:8px;
      background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;
      padding:10px 16px;margin-top:6px;font-size:13px;color:#1d4ed8;font-weight:600;
    }
    .footer { padding:16px;font-size:12px;color:#9ca3af;text-align:center; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>📄 ${label}${reference ? ' — ' + reference : ''}</h1>
    <p>De la part de ${agencyName}</p>
  </div>
  <div class="body">
    <p>Bonjour <strong>${clientNom || 'Madame, Monsieur'}</strong>,</p>
    <p>
      Veuillez trouver <strong>en pièce jointe</strong> votre
      <strong>${label.toLowerCase()}</strong>${reference ? ' (réf.&nbsp;<strong>' + reference + '</strong>)' : ''}
      ${montant ? ', d\'un montant de <strong>' + montant + '</strong>' : ''}.
    </p>
    ${agencyEmail ? `<p style="font-size:13px;color:#6b7280;">Pour toute question, contactez-nous à <a href="mailto:${agencyEmail}" style="color:#2563eb;">${agencyEmail}</a>.</p>` : ''}
    <div class="attachment-badge">
      📎 ${label}${reference ? ' ' + reference : ''}.pdf
    </div>
  </div>
  <div class="footer">
    Envoyé automatiquement par <strong>NexaPro</strong> · © ${new Date().getFullYear()} ${agencyName}
  </div>
</div>
</body>
</html>`;
}

// ── Email avec document HTML inline (fallback si pas de PDF) ──────────────────
function buildEmailHtmlInline({ clientNom, label, reference, agencyName, agencyEmail, docHtml, totalTtc, devise }) {
  const montant = totalTtc
    ? `${Number(totalTtc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${devise || '€'}`
    : null;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif; }
    .wrap { max-width:700px;margin:0 auto;padding:24px 16px; }
    .hdr  { background:#1e3a5f;color:#fff;padding:22px 28px;border-radius:12px 12px 0 0; }
    .hdr h1 { margin:0;font-size:20px;font-weight:700; }
    .hdr p  { margin:6px 0 0;font-size:13px;opacity:.75; }
    .intro { background:#fff;padding:20px 28px;border-left:4px solid #2563eb; }
    .intro p { margin:0 0 12px;font-size:15px;color:#374151;line-height:1.65; }
    .doc-wrapper { background:#fff;padding:24px;border-top:1px solid #e5e7eb; }
    .footer { padding:16px 28px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;background:#fff;border-radius:0 0 12px 12px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>📄 ${label}${reference ? ' — ' + reference : ''}</h1>
    <p>De la part de ${agencyName || 'Votre agence'}</p>
  </div>
  <div class="intro">
    <p>Bonjour <strong>${clientNom || 'Madame, Monsieur'}</strong>,</p>
    <p>
      Veuillez trouver ci-dessous votre <strong>${label.toLowerCase()}</strong>
      ${reference ? ' (référence&nbsp;: <strong>' + reference + '</strong>)' : ''}
      ${montant ? ' d\'un montant de <strong>' + montant + '</strong>' : ''}.
    </p>
    ${agencyEmail ? `<p style="font-size:13px;color:#6b7280;">Pour toute question, contactez-nous à <a href="mailto:${agencyEmail}" style="color:#2563eb;">${agencyEmail}</a>.</p>` : ''}
  </div>
  <div class="doc-wrapper">
    ${docHtml || '<p style="color:#9ca3af;text-align:center;padding:20px;">Contenu du document non disponible.</p>'}
  </div>
  <div class="footer">
    Ce document a été généré automatiquement par <strong>NexaPro</strong>.
    <br/>© ${new Date().getFullYear()} ${agencyName || 'NexaPro'} — Tous droits réservés
  </div>
</div>
</body>
</html>`;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId } = req.body || {};
  if (!documentId) {
    return res.status(400).json({ error: 'documentId manquant' });
  }

  try {
    // ── 1. Récupérer le document ──────────────────────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      return res.status(404).json({ error: 'Document introuvable' });
    }
    if (!doc.client_email) {
      return res.status(400).json({ error: 'Aucun email client sur ce document' });
    }

    // ── 2. Récupérer le profil agence ─────────────────────────────────────────
    const { data: agency } = await supabase
      .from('profiles')
      .select('nom_agence, email')
      .eq('agency_id', doc.agency_id)
      .eq('role', 'owner')
      .maybeSingle();

    const agencyName  = agency?.nom_agence || 'Votre agence';
    const agencyEmail = agency?.email      || null;
    const label       = TYPE_LABELS[doc.type] || 'Document';
    const subject     = `${agencyName} — Votre ${label.toLowerCase()}${doc.reference ? ' ' + doc.reference : ''}`;

    // ── 3. Essayer de générer le PDF côté serveur via pdfshift.io ─────────────
    let pdfBuffer  = null;
    let attachments = [];

    if (doc.preview_html && process.env.PDFSHIFT_API_KEY) {
      try {
        console.log('[send-email] Génération PDF via pdfshift...');
        pdfBuffer = await generatePdfWithPdfshift(doc.preview_html);
        console.log(`[send-email] PDF généré : ${Math.round(pdfBuffer.length / 1024)} Ko`);
      } catch (pdfErr) {
        console.warn('[send-email] pdfshift échoué, fallback HTML inline:', pdfErr.message);
        pdfBuffer = null;
      }
    } else if (!process.env.PDFSHIFT_API_KEY) {
      console.log('[send-email] PDFSHIFT_API_KEY absent → email HTML inline');
    }

    // ── 4. Construire le corps de l'email ─────────────────────────────────────
    let html;

    if (pdfBuffer) {
      // PDF disponible → email sobre + pièce jointe
      html = buildEmailWithPdf({
        clientNom:  doc.client_nom,
        label,
        reference:  doc.reference,
        agencyName,
        agencyEmail,
        totalTtc:   doc.total_ttc,
        devise:     doc.devise || '€',
      });
      attachments = [{
        filename: `${label}${doc.reference ? '-' + doc.reference : ''}.pdf`,
        content:  pdfBuffer,
      }];
    } else {
      // Fallback : document HTML inline dans l'email
      let docHtml = doc.preview_html || '';
      if (!docHtml && doc.content_json) {
        const cj = typeof doc.content_json === 'string'
          ? JSON.parse(doc.content_json)
          : doc.content_json;
        docHtml = `<pre style="font-size:12px;white-space:pre-wrap;">${JSON.stringify(cj, null, 2)}</pre>`;
      }
      html = buildEmailHtmlInline({
        clientNom:  doc.client_nom,
        label,
        reference:  doc.reference,
        agencyName,
        agencyEmail,
        docHtml,
        totalTtc:   doc.total_ttc,
        devise:     doc.devise || '€',
      });
    }

    // ── 5. Envoyer l'email via Resend ─────────────────────────────────────────
    const emailPayload = { from: FROM, to: doc.client_email, subject, html };
    if (attachments.length > 0) emailPayload.attachments = attachments;

    const { error: sendErr } = await resend.emails.send(emailPayload);

    if (sendErr) {
      console.error('[send-email] Resend error:', sendErr);
      return res.status(500).json({ error: 'Échec envoi email', detail: sendErr.message });
    }

    // ── 6. Marquer le document comme "envoyé" ─────────────────────────────────
    await supabase
      .from('documents')
      .update({ statut: 'envoyé', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // ── 7. Logger en CRM si lead connu ────────────────────────────────────────
    if (doc.lead_id) {
      await supabase.from('crm_events').insert({
        lead_id:    doc.lead_id,
        agency_id:  doc.agency_id,
        type:       'document',
        title:      `📧 ${label} envoyé par email`,
        description:`${doc.reference || label} — ${(doc.total_ttc || 0).toLocaleString('fr-FR')} € — Envoyé à ${doc.client_email}`,
        statut:     'complété',
        created_at: new Date().toISOString(),
      });
    }

    const mode = pdfBuffer ? 'PDF en pièce jointe' : 'HTML inline';
    console.log(`[send-email] ✅ Envoyé à ${doc.client_email} (${mode})`);
    return res.status(200).json({ ok: true, sentTo: doc.client_email, mode });

  } catch (err) {
    console.error('[send-email] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
}
