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
    bodyParser: { sizeLimit: '1mb' },
  },
};

// ⚠️ NE PAS initialiser supabase/resend au niveau module — les env vars
// ne sont pas toutes disponibles à l'import sur Vercel Edge.
// On les crée à l'intérieur du handler.

const FROM = process.env.RESEND_FROM_EMAIL || 'LeadQualif <contact@leadqualif.com>';

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

// ── Génère un HTML complet du document depuis les données DB ──────────────────
// Utilisé pour les devis/factures : preview_html peut être stale ou incomplet.
// On reconstruit le document depuis content_json + champs du doc + profil agence.
function buildDocumentHtmlForPdf(doc, agency) {
  const label   = TYPE_LABELS[doc.type] || 'Document';
  const cj      = typeof doc.content_json === 'string'
    ? JSON.parse(doc.content_json) : (doc.content_json || {});
  const items   = Array.isArray(cj.items)  ? cj.items  : [];
  const totals  = Array.isArray(cj.totals) ? cj.totals : [];
  const devise  = doc.devise || cj.devise || '€';
  const fmt     = (v) => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  const date    = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const agencyName  = agency?.nom_agence  || 'Votre agence';
  const agencyEmail = agency?.email       || '';
  const agencyTel   = agency?.telephone   || '';
  const agencyAddr  = agency?.adresse_legale || agency?.adresse || '';
  const agencySiret = agency?.siret || agency?.numero_enregistrement || '';
  const agencyLegal = agency?.mention_legale || '';
  const conditions  = agency?.conditions_paiement || '';
  const cartePT     = agency?.carte_pro_t || '';
  const cartePS     = agency?.carte_pro_s || '';

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${item.description || ''}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;text-align:right;">${fmt(item.amount ?? item.unitPrice ?? item.total)} ${devise}</td>
    </tr>`).join('');

  const totalsHtml = totals.map(t => {
    const isTtc = (t.label || '').toUpperCase().includes('TOTAL TTC');
    return `<tr style="${isTtc ? 'background:#eff6ff;' : ''}">
      <td colspan="2" style="padding:8px 14px;font-size:${isTtc ? '15' : '13'}px;font-weight:${isTtc ? '700' : '400'};color:${isTtc ? '#1d4ed8' : '#6b7280'};text-align:right;border-top:1px solid #e5e7eb;">${t.label}</td>
      <td style="padding:8px 14px;font-size:${isTtc ? '15' : '13'}px;font-weight:${isTtc ? '700' : '600'};color:${isTtc ? '#1d4ed8' : '#374151'};text-align:right;border-top:1px solid #e5e7eb;">${fmt(t.amount)} ${devise}</td>
    </tr>`;
  }).join('');

  const carteBadges = [
    cartePT ? `<span style="display:inline-block;padding:2px 8px;border:1.5px solid #3b82f6;border-radius:4px;color:#3b82f6;font-size:10px;font-weight:600;margin-right:4px;">Carte Pro Transaction n° ${cartePT}</span>` : '',
    cartePS ? `<span style="display:inline-block;padding:2px 8px;border:1.5px solid #3b82f6;border-radius:4px;color:#3b82f6;font-size:10px;font-weight:600;">Carte Pro Syndic n° ${cartePS}</span>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${label} ${doc.reference || ''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111827;background:#fff;line-height:1.5;}
    .page{max-width:800px;margin:0 auto;padding:40px 36px;}
    table{border-collapse:collapse;}
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER agence + infos document -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:24px;margin-bottom:28px;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#1e3a5f;">${agencyName}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;line-height:1.6;">
        ${agencyAddr ? `<div>${agencyAddr}</div>` : ''}
        ${agencyEmail ? `<div>Email : ${agencyEmail}</div>` : ''}
        ${agencyTel   ? `<div>Tél : ${agencyTel}</div>`      : ''}
        ${agencySiret ? `<div>N° ${agencySiret}</div>`       : ''}
      </div>
      ${carteBadges ? `<div style="margin-top:8px;">${carteBadges}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:700;color:#1e3a5f;">${label}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:4px;">${doc.reference ? `Réf : ${doc.reference}` : ''}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:2px;">Date : ${date}</div>
    </div>
  </div>

  <!-- CLIENT -->
  <div style="background:#f9fafb;border-left:4px solid #3b82f6;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:8px;">Client</div>
    <div style="font-size:16px;font-weight:700;color:#111827;">${doc.client_nom || '—'}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;line-height:1.6;">
      ${doc.client_email     ? `<div>Email : ${doc.client_email}</div>`     : ''}
      ${doc.client_telephone ? `<div>Tél : ${doc.client_telephone}</div>` : ''}
    </div>
  </div>

  <!-- TABLEAU PRESTATIONS -->
  ${items.length > 0 ? `
  <div style="margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:0;">Détail des prestations</div>
    <table style="width:100%;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Description</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:80px;">Qté</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:140px;">Montant</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>${totalsHtml}</tfoot>
    </table>
  </div>` : ''}

  <!-- SIGNATURES -->
  <div style="display:flex;gap:32px;margin-top:48px;padding-top:20px;border-top:1px solid #e5e7eb;">
    <div style="flex:1;text-align:center;">
      <div style="font-size:11px;color:#6b7280;margin-bottom:40px;">Signature de l'agence</div>
      <div style="border-top:1px solid #9ca3af;padding-top:6px;font-size:12px;font-weight:600;color:#374151;">${agencyName}</div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:11px;color:#6b7280;margin-bottom:40px;">Signature du client</div>
      <div style="border-top:1px solid #9ca3af;padding-top:6px;font-size:12px;font-weight:600;color:#374151;">${doc.client_nom || ''}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
    ${agencyLegal  ? `<div>${agencyLegal}</div>`   : ''}
    ${conditions   ? `<div>${conditions}</div>`     : ''}
    <div style="margin-top:4px;">Document généré par <strong>NexaPro</strong></div>
  </div>

</div>
</body>
</html>`;
}

// ── Génère un PDF base64 via l'API pdfshift.io ────────────────────────────────
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
      source:    htmlContent,
      format:    'A4',
      margin:    { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`pdfshift ${response.status}: ${errText}`);
  }

  // Convertir en base64 string (format attendu par Resend v6)
  const arrayBuffer = await response.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  return Buffer.from(uint8).toString('base64');
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

  // ── Init clients ici (pas au niveau module) ───────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log de diagnostic (visible dans Vercel Logs)
  console.log('[send-email] ENV check:', {
    SUPABASE_URL:            !!process.env.SUPABASE_URL,
    VITE_SUPABASE_URL:       !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_KEY:    !!process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_ANON_KEY:       !!process.env.SUPABASE_ANON_KEY,
    VITE_SUPABASE_ANON_KEY:  !!process.env.VITE_SUPABASE_ANON_KEY,
    RESEND_API_KEY:          !!process.env.RESEND_API_KEY,
    PDFSHIFT_API_KEY:        !!process.env.PDFSHIFT_API_KEY,
  });

  if (!supabaseUrl || !supabaseKey) {
    console.error('[send-email] ❌ Variables Supabase manquantes sur Vercel');
    return res.status(500).json({
      error: 'Configuration serveur manquante',
      hint: 'Ajouter SUPABASE_URL et SUPABASE_ANON_KEY dans Vercel → Settings → Environment Variables'
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const resend   = new Resend(process.env.RESEND_API_KEY);

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
      .select('nom_agence, email, telephone, adresse_legale, adresse, siret, numero_enregistrement, mention_legale, conditions_paiement, carte_pro_t, carte_pro_s')
      .eq('agency_id', doc.agency_id)
      .eq('role', 'owner')
      .maybeSingle();

    const agencyName  = agency?.nom_agence || 'Votre agence';
    const agencyEmail = agency?.email      || null;
    const label       = TYPE_LABELS[doc.type] || 'Document';
    const subject     = `${agencyName} — Votre ${label.toLowerCase()}${doc.reference ? ' ' + doc.reference : ''}`;

    // ── 3. Essayer de générer le PDF côté serveur via pdfshift.io ─────────────
    let pdfBase64  = null;
    let attachments = [];

    // Pour devis/facture : toujours regénérer le HTML depuis les données DB
    // (preview_html peut être stale ou incomplet pour les anciens documents)
    const FINANCIAL_TYPES = ['devis', 'facture'];
    const htmlForPdf = FINANCIAL_TYPES.includes(doc.type)
      ? buildDocumentHtmlForPdf(doc, agency)
      : (doc.preview_html || null);

    if (htmlForPdf && process.env.PDFSHIFT_API_KEY) {
      try {
        console.log('[send-email] Génération PDF via pdfshift (type:', doc.type, ')...');
        pdfBase64 = await generatePdfWithPdfshift(htmlForPdf);
        console.log(`[send-email] PDF généré : ${Math.round(pdfBase64.length * 0.75 / 1024)} Ko`);
      } catch (pdfErr) {
        console.warn('[send-email] pdfshift échoué, fallback HTML inline:', pdfErr.message);
        pdfBase64 = null;
      }
    } else if (!process.env.PDFSHIFT_API_KEY) {
      console.log('[send-email] PDFSHIFT_API_KEY absent → email HTML inline');
    }

    // ── 4. Construire le corps de l'email ─────────────────────────────────────
    let html;

    if (pdfBase64) {
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
        content:  pdfBase64,   // base64 string — format attendu par Resend v4+
      }];
    } else {
      // Fallback : document HTML inline dans l'email
      // Pour devis/facture : HTML regénéré depuis DB ; pour les autres : preview_html
      let docHtml = htmlForPdf || '';
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

    console.log('[send-email] Envoi Resend à:', doc.client_email, '| from:', FROM, '| pieces jointes:', attachments.length);
    const { data: sendData, error: sendErr } = await resend.emails.send(emailPayload);

    if (sendErr) {
      console.error('[send-email] Resend error:', JSON.stringify(sendErr));
      return res.status(500).json({ error: 'Échec envoi email', detail: sendErr.message || JSON.stringify(sendErr) });
    }
    console.log('[send-email] Resend OK, id:', sendData?.id);

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

    const mode = pdfBase64 ? 'PDF en pièce jointe' : 'HTML inline';
    console.log(`[send-email] ✅ Envoyé à ${doc.client_email} (${mode})`);
    return res.status(200).json({ ok: true, sentTo: doc.client_email, mode });

  } catch (err) {
    console.error('[send-email] Unexpected error:', err?.message, err?.stack);
    return res.status(500).json({ error: err?.message || 'Erreur serveur inconnue', stack: err?.stack?.split('\n')[0] });
  }
}
