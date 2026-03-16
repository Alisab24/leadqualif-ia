/**
 * api/documents/send-email.js
 * Envoie un document (devis/facture/contrat...) par email au prospect via Resend.
 * Marque automatiquement le document comme "envoyé" en DB.
 *
 * POST /api/documents/send-email
 * Body: { documentId: string }
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'LeadQualif <contact@leadqualif.com>';

// ── Labels par type ────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  devis:            'Devis',
  facture:          'Facture',
  contrat:          'Contrat de prestation',
  rapport:          'Rapport de performance',
  mandat:           'Mandat immobilier',
  compromis:        'Compromis de vente',
  bon_visite:       'Bon de visite',
  contrat_gestion:  'Contrat de gestion',
};

// ── Wrapper email professionnel autour du HTML du document ─────────────────────
function wrapDocumentHtml({ clientNom, docType, reference, agencyName, agencyEmail, docHtml, totalTtc, devise }) {
  const label   = TYPE_LABELS[docType] || 'Document';
  const montant = totalTtc ? `${Number(totalTtc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${devise || '€'}` : null;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${label} ${reference || ''}</title>
  <style>
    body { margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif; }
    .wrapper { max-width:700px;margin:0 auto;padding:24px 16px; }
    .header { background:#1e3a5f;color:#fff;padding:20px 28px;border-radius:12px 12px 0 0; }
    .header h1 { margin:0;font-size:20px;font-weight:700; }
    .header p  { margin:6px 0 0;font-size:13px;opacity:.75; }
    .intro { background:#fff;padding:20px 28px;border-left:4px solid #2563eb; }
    .intro p { margin:0;font-size:15px;color:#374151;line-height:1.6; }
    .doc-wrapper { background:#fff;padding:24px;margin-top:0;border-top:1px solid #e5e7eb; }
    .footer { padding:16px 28px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;background:#fff;border-radius:0 0 12px 12px; }
    .badge { display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;margin-top:8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📄 ${label}${reference ? ' — ' + reference : ''}</h1>
      <p>De la part de ${agencyName || 'Votre agence'}</p>
    </div>
    <div class="intro">
      <p>Bonjour <strong>${clientNom || 'Madame, Monsieur'}</strong>,</p>
      <p style="margin-top:10px;">Veuillez trouver ci-dessous votre <strong>${label.toLowerCase()}</strong>${reference ? ' (référence&nbsp;: <strong>' + reference + '</strong>)' : ''}${montant ? ' d\'un montant de <strong>' + montant + '</strong>' : ''}.</p>
      ${agencyEmail ? `<p style="margin-top:10px;font-size:13px;color:#6b7280;">Pour toute question, contactez-nous à <a href="mailto:${agencyEmail}">${agencyEmail}</a>.</p>` : ''}
    </div>
    <div class="doc-wrapper">
      ${docHtml || '<p style="color:#9ca3af;text-align:center;">Contenu du document non disponible.</p>'}
    </div>
    <div class="footer">
      Ce document a été généré et envoyé automatiquement par <strong>LeadQualif</strong>.
      <br/>© ${new Date().getFullYear()} ${agencyName || 'LeadQualif'} — Tous droits réservés
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, pdfBase64 } = req.body || {};
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

    // ── 2. Récupérer le profil agence pour le nom + email ─────────────────────
    const { data: agency } = await supabase
      .from('profiles')
      .select('nom_agence, email, telephone')
      .eq('agency_id', doc.agency_id)
      .eq('role', 'owner')
      .maybeSingle();

    const agencyName  = agency?.nom_agence  || 'Votre agence';
    const agencyEmail = agency?.email       || null;

    // ── 3. Construire le corps de l'email ─────────────────────────────────────
    const label   = TYPE_LABELS[doc.type] || 'Document';
    const subject = `${agencyName} — Votre ${label.toLowerCase()}${doc.reference ? ' ' + doc.reference : ''}`;

    let html;
    let attachments = [];

    if (pdfBase64) {
      // ── 3a. PDF fourni par le client → email sobre + PDF en pièce jointe ───
      const montant = doc.total_ttc
        ? Number(doc.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' ' + (doc.devise || '€')
        : null;
      html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;}
  .wrap{max-width:600px;margin:0 auto;padding:24px 16px;}
  .hdr{background:#1e3a5f;color:#fff;padding:20px 28px;border-radius:12px 12px 0 0;}
  .hdr h1{margin:0;font-size:20px;font-weight:700;}
  .hdr p{margin:6px 0 0;font-size:13px;opacity:.75;}
  .body{background:#fff;padding:24px 28px;border-radius:0 0 12px 12px;}
  .body p{margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;}
  .badge{display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;margin-bottom:16px;}
  .footer{padding:16px;font-size:12px;color:#9ca3af;text-align:center;}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>📄 ${label}${doc.reference ? ' — ' + doc.reference : ''}</h1>
    <p>De la part de ${agencyName}</p>
  </div>
  <div class="body">
    <p>Bonjour <strong>${doc.client_nom || 'Madame, Monsieur'}</strong>,</p>
    <p>Veuillez trouver en pièce jointe votre <strong>${label.toLowerCase()}</strong>${doc.reference ? ' (réf.&nbsp;<strong>' + doc.reference + '</strong>)' : ''}${montant ? ', d\'un montant de <strong>' + montant + '</strong>' : ''}.</p>
    ${agencyEmail ? `<p style="font-size:13px;color:#6b7280;">Pour toute question, contactez-nous à <a href="mailto:${agencyEmail}">${agencyEmail}</a>.</p>` : ''}
    <span class="badge">📎 ${label}${doc.reference ? ' ' + doc.reference : ''}.pdf</span>
  </div>
  <div class="footer">Envoyé automatiquement par <strong>LeadQualif</strong> · © ${new Date().getFullYear()} ${agencyName}</div>
</div>
</body></html>`;
      attachments = [{
        filename: `${label}${doc.reference ? '-' + doc.reference : ''}.pdf`,
        content:  pdfBase64,
      }];
    } else {
      // ── 3b. Fallback : HTML inline (si pas de PDF disponible) ──────────────
      let docHtml = '';
      if (doc.preview_html) {
        docHtml = doc.preview_html;
      } else if (doc.content_json) {
        const cj = typeof doc.content_json === 'string' ? JSON.parse(doc.content_json) : doc.content_json;
        docHtml = `<pre style="font-size:12px;white-space:pre-wrap;">${JSON.stringify(cj, null, 2)}</pre>`;
      }
      html = wrapDocumentHtml({
        clientNom:  doc.client_nom,
        docType:    doc.type,
        reference:  doc.reference,
        agencyName,
        agencyEmail,
        docHtml,
        totalTtc:   doc.total_ttc,
        devise:     doc.devise || '€',
      });
    }

    // ── 4. Envoyer l'email ────────────────────────────────────────────────────
    const emailPayload = { from: FROM, to: doc.client_email, subject, html };
    if (attachments.length > 0) emailPayload.attachments = attachments;

    const { error: sendErr } = await resend.emails.send(emailPayload);

    if (sendErr) {
      console.error('[send-email] Resend error:', sendErr);
      return res.status(500).json({ error: 'Échec envoi email', detail: sendErr.message });
    }

    // ── 5. Marquer le document comme "envoyé" ─────────────────────────────────
    await supabase
      .from('documents')
      .update({ statut: 'envoyé', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // ── 6. Logger en CRM si lead connu ───────────────────────────────────────
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

    return res.status(200).json({ ok: true, sentTo: doc.client_email });

  } catch (err) {
    console.error('[send-email] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
}
