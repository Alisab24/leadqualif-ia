/**
 * ARCHITECTE SaaS - Page Documents Stripe-like
 * 
 * Principes :
 * - Agency-centric: uniquement agency_id
 * - Performance: pagination et filtrage optimisés
 * - UX moderne: interface claire et professionnelle
 * - Conversion: devis → facture intégrée
 * - RLS: respect des politiques de sécurité
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ProfileManager from '../services/profileManager';
import DevisToFactureService from '../services/devisToFactureService';

// ── Avancement automatique du pipeline depuis DocumentsPage ──────────────────
// Ordre des statuts — cohérent avec Dashboard.jsx
const PIPELINE_ORDER_DOCS = ['À traiter', 'Contacté', 'RDV fixé', 'Offre en cours', 'Négociation', 'Gagné', 'Perdu', 'Archivé'];

/**
 * Avance un lead vers targetStatut SEULEMENT si son statut actuel est inférieur
 * et n'est pas dans les statuts "terminaux" (Négociation, Gagné, Perdu, Archivé).
 * Utilise un filtre Supabase .in() pour ne jamais rétrograder.
 * @param {string} leadId
 * @param {string} targetStatut  — ex: 'Offre en cours', 'Gagné'
 * @param {string} [force=false] — si true, avance même depuis Négociation (ex: facture payée)
 */
async function advanceLeadPipeline(leadId, targetStatut, force = false) {
  if (!leadId) return;
  try {
    const targetIdx = PIPELINE_ORDER_DOCS.indexOf(targetStatut);
    // Statuts depuis lesquels on autorise l'avancement
    const eligibleStatuts = force
      ? PIPELINE_ORDER_DOCS.slice(0, targetIdx)          // tout ce qui est avant la cible
      : PIPELINE_ORDER_DOCS.slice(0, Math.min(targetIdx, PIPELINE_ORDER_DOCS.indexOf('Négociation')));
    if (eligibleStatuts.length === 0) return;
    await supabase
      .from('leads')
      .update({ statut: targetStatut, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .in('statut', eligibleStatuts);
  } catch (err) {
    console.warn('[advanceLeadPipeline] erreur silencieuse:', err?.message);
  }
}

const DocumentsPage = () => {
  const [searchParams] = useSearchParams();
  const leadIdFilter = searchParams.get('lead') || null;

  // États principaux
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // États de filtrage
  const [filters, setFilters] = useState({
    type: 'tous',
    statut: 'tous',
    dateRange: 'tous',
    searchTerm: ''
  });
  
  // États de pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    offset: 0
  });
  
  // États UI
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null); // docId en cours de mise à jour
  const [sendingEmail, setSendingEmail]     = useState(null); // docId en cours d'envoi email
  const [caStats, setCaStats] = useState({ total: 0, countEnvoye: 0, countPaye: 0 });

  // Récupération du profil agence
  useEffect(() => {
    fetchAgencyProfile();
  }, []);

  // Récupération des documents
  useEffect(() => {
    if (agencyProfile) {
      fetchDocuments();
    }
  }, [agencyProfile, filters, pagination.page]);

  const fetchAgencyProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🛡️ PROTECTION ROBUSTE: Utiliser ProfileManager
      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: true,  // Créer automatiquement si non trouvé
        useFallback: true,      // Utiliser fallback si échec
        required: ['agency_id'], // agency_id est obligatoire
        verbose: true
      });

      if (!profileResult.success) {
        console.error('❌ Impossible de récupérer le profil:', profileResult.error);
        setAgencyProfile(null);
        return;
      }

      const profile = profileResult.profile;
      console.log('✅ Profil chargé:', {
        action: profileResult.action,
        agencyId: ProfileManager.getSafeAgencyId(profile),
        isFallback: ProfileManager.isFallbackProfile(profile)
      });

      setAgencyProfile(profile);
    } catch (error) {
      console.error('❌ Erreur chargement profil:', error);
      setAgencyProfile(null);
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!agencyProfile?.agency_id) {
      console.warn('⚠️ fetchDocuments: agencyProfile ou agency_id manquant');
      return;
    }

    setLoading(true);
    try {
      // 🛡️ PROTECTION: Utiliser getSafeAgencyId pour éviter les erreurs
      const agencyId = ProfileManager.getSafeAgencyId(agencyProfile);
      
      if (!agencyId) {
        console.error('❌ fetchDocuments: Agency ID non disponible');
        return;
      }

      // 🎯 AGENCY-CENTRIC: Utiliser agency_id pour les documents
      // L'agence est l'unité de vérité - Multi-user compatible
      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('agency_id', agencyId); // ✅ JAMAIS user_id

      // Filtrage par type
      if (filters.type !== 'tous') {
        query = query.eq('type', filters.type);
      }

      // Filtrage par statut
      if (filters.statut !== 'tous') {
        query = query.eq('statut', filters.statut);
      }

      // Filtrage par date
      if (filters.dateRange !== 'tous') {
        const dateFilter = getDateFilter(filters.dateRange);
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
      }

      // Filtrage par lead (provient de /documents-center?lead=xxx)
      if (leadIdFilter) {
        query = query.eq('lead_id', leadIdFilter);
      }

      // Recherche textuelle
      if (filters.searchTerm) {
        query = query.or(
          `reference.ilike.%${filters.searchTerm}%,titre.ilike.%${filters.searchTerm}%,client_nom.ilike.%${filters.searchTerm}%`
        );
      }

      // Pagination
      const offset = (pagination.page - 1) * pagination.limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      setDocuments(data || []);
      setTotalCount(count || 0);

      // 💰 Calcul du CA : factures envoyées + payées + émises
      const caDocuments = (data || []).filter(d =>
        d.type === 'facture' &&
        ['envoyé', 'envoyée', 'payé', 'payée', 'émise', 'émis'].includes(d.statut?.toLowerCase())
      );
      setCaStats({
        total: caDocuments.reduce((sum, d) => sum + (parseFloat(d.total_ttc) || 0), 0),
        countEnvoye: caDocuments.filter(d => ['envoyé','envoyée','émise','émis'].includes(d.statut?.toLowerCase())).length,
        countPaye:   caDocuments.filter(d => ['payé','payée'].includes(d.statut?.toLowerCase())).length,
      });
    } catch (error) {
      console.error('❌ Erreur chargement documents:', error);
    } finally {
      setLoading(false);
    }
  }, [agencyProfile, filters, pagination, leadIdFilter]);

  const getDateFilter = (range) => {
    const now = new Date();
    switch (range) {
      case '7jours':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30jours':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90jours':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset page
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleConvertToInvoice = async (document) => {
    if (document.type !== 'devis') return;

    setConvertingId(document.id);
    try {
      const result = await DevisToFactureService.convertDevisToFacture(document.id, {
        dateFacturation: new Date(),
        notes: 'Conversion depuis page Documents'
      });

      if (result.success) {
        // 🎯 Logger la conversion dans crm_events (historique CRM + CA en cours)
        if (document.lead_id) {
          await supabase.from('crm_events').insert({
            lead_id: document.lead_id,
            agency_id: document.agency_id,
            type: 'document',
            title: `🔄 Devis converti en facture`,
            description: `${result.metadata.devisReference} → ${result.metadata.factureReference} — Montant : ${result.metadata.montantTTC ? result.metadata.montantTTC.toLocaleString('fr-FR') + ' €' : '—'} — Client : ${document.client_nom}`,
            statut: 'complété',
            created_at: new Date().toISOString(),
          });
        }
        await fetchDocuments();
        setShowConversionModal(false);
        setSelectedDocument(null);
        alert(`✅ Facture créée !\nRéférence : ${result.metadata.factureReference}`);
      } else {
        alert(`❌ Erreur lors de la conversion: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Erreur conversion:', error);
      alert(`❌ Erreur lors de la conversion: ${error.message}`);
    } finally {
      setConvertingId(null);
    }
  };

  // 💰 Mise à jour du statut d'une facture + log CA dans crm_events
  const handleStatusChange = async (doc, newStatus) => {
    setUpdatingStatus(doc.id);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ statut: newStatus, updated_at: new Date().toISOString() })
        .eq('id', doc.id);
      if (error) throw error;

      // Logguer en CRM si la facture passe à "envoyé" ou "payé" → c'est du CA
      if (['envoyé', 'payé'].includes(newStatus) && doc.lead_id) {
        const isCA = newStatus === 'payé';
        await supabase.from('crm_events').insert({
          lead_id: doc.lead_id,
          agency_id: doc.agency_id,
          type: isCA ? 'ca_realise' : 'document',
          title: isCA
            ? `💰 Facture payée — CA réalisé`
            : `📤 Facture envoyée — CA en cours`,
          description: `Facture ${doc.reference} — ${(doc.total_ttc || 0).toLocaleString('fr-FR')} € — Client : ${doc.client_nom}`,
          statut: 'complété',
          created_at: new Date().toISOString(),
        });
        // 📊 Avancement pipeline automatique :
        // Facture envoyée → "Offre en cours"  |  Facture payée → "Gagné" (force=true)
        if (isCA) {
          await advanceLeadPipeline(doc.lead_id, 'Gagné', true); // force : même depuis Négociation
        } else {
          await advanceLeadPipeline(doc.lead_id, 'Offre en cours');
        }
      }
      await fetchDocuments();
    } catch (err) {
      console.error('❌ Erreur mise à jour statut:', err);
      alert('Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePreview = (document) => {
    setPreviewDocument(document);
    setShowPreviewModal(true);
  };

  // ── Helper normalisation numéro WhatsApp ──────────────────────────────────────
  const toWhatsAppPhone = (raw = '') => {
    const digits = (raw || '').replace(/\D/g, '');
    if (!digits) return '';
    // Numéros FR commençant par 0 (10 chiffres) → préfixe 33
    if (digits.startsWith('0') && digits.length === 10) return '33' + digits.substring(1);
    return digits;
  };

  // ── Partage WhatsApp (web.whatsapp.com — fonctionne sur PC navigateur ET mobile) ──
  const handleShareWhatsApp = (doc) => {
    const rawPhone = doc.client_telephone
      || doc.content_json?.telephone
      || doc.content_json?.client_telephone
      || '';
    const phone = toWhatsAppPhone(rawPhone);
    if (!phone) {
      alert('❌ Aucun numéro de téléphone pour ce prospect.');
      return;
    }
    const typeLabel  = { devis: 'Devis', facture: 'Facture', contrat: 'Contrat', rapport: 'Rapport', mandat: 'Mandat' }[doc.type] || 'Document';
    const agence     = agencyProfile?.nom_agence || 'Notre agence';
    const ligneRef   = doc.reference ? `\n📋 Référence : ${doc.reference}` : '';
    const ligneMont  = doc.total_ttc ? `\n💰 Montant TTC : ${Number(doc.total_ttc).toLocaleString('fr-FR')} €` : '';
    const ligneEmail = doc.client_email ? `\n\n📧 Le document complet vous a également été envoyé par email à ${doc.client_email}.` : '';
    const message = `Bonjour ${doc.client_nom || ''},\n\n${agence} vous fait parvenir votre *${typeLabel}*.${ligneRef}${ligneMont}${ligneEmail}\n\nPour toute question, n'hésitez pas à nous contacter.\n\nCordialement,\n${agence}`;
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
    // 📊 Avancement pipeline : partage WhatsApp d'un doc (hors facture) → "Offre en cours"
    if (doc.type !== 'facture') {
      await advanceLeadPipeline(doc.lead_id, 'Offre en cours');
    }
  };

  // ── Génère un PDF base64 depuis le preview_html stocké en DB ─────────────────
  const generatePdfBase64FromHtml = async (htmlContent) => {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');

    // Créer un wrapper avec le CSS inline (html2canvas ne charge pas les fichiers CSS externes)
    const wrapper = window.document.createElement('div');
    wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:white;';

    // Injecter un <style> avec les classes nécessaires au rendu du document
    const styleEl = window.document.createElement('style');
    styleEl.textContent = `
      *{box-sizing:border-box;}
      body,div{font-family:Arial,Helvetica,sans-serif;}
      .signature-section{margin-top:32px;display:flex;justify-content:space-between;gap:32px;padding-top:16px;border-top:1px solid #e5e7eb;}
      .signature-block{flex:1;padding:14px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;}
      .signature-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;display:block;margin-bottom:4px;}
      .signature-line{border-bottom:1px solid #9ca3af;height:40px;margin:8px 0 6px;}
      .signature-label{font-size:11px;color:#374151;font-weight:600;display:block;}
      .signature-date{font-size:10px;color:#9ca3af;margin-top:4px;display:block;}
      .financial-table{width:100%;border-collapse:collapse;font-size:11px;margin:16px 0;}
      .financial-table th,.financial-table td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee;}
      .financial-table th{background:#f5f5f5;font-weight:600;color:#374151;}
      .financial-table td:last-child{text-align:right;font-weight:600;}
      .total-ttc{background:#f0f9ff;border-top:2px solid #3b82f6;}
      .total-ttc td{font-weight:bold;color:#1d4ed8;font-size:13px;}
      .client-section{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:14px;margin:16px 0;}
      .header-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
      .metadata-section{background:#fffbeb;border:1px solid #fbbf24;border-radius:6px;padding:12px;margin:16px 0;}
    `;
    wrapper.appendChild(styleEl);

    const content = window.document.createElement('div');
    content.innerHTML = htmlContent;
    wrapper.appendChild(content);
    window.document.body.appendChild(wrapper);

    try {
      // scale:1.5 = bon compromis qualité/taille (scale:2 génère un PDF trop lourd)
      const canvas = await html2canvas(wrapper, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
      });
      // JPEG 85% = qualité correcte, ~3× plus léger que 95%
      const imgData  = canvas.toDataURL('image/jpeg', 0.85);
      const pdf      = new jsPDF('portrait', 'mm', 'a4');
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const imgH     = (canvas.height * pageW) / canvas.width;
      let left       = imgH;
      let pos        = 0;
      pdf.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
      left -= pageH;
      while (left > 0) {
        pos = left - imgH;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
        left -= pageH;
      }
      return pdf.output('datauristring').split(',')[1];
    } finally {
      window.document.body.removeChild(wrapper);
    }
  };

  // ── Envoi email via Resend (HTML inline — pas de PDF pour éviter les limites de taille) ──
  const handleSendEmail = async (doc) => {
    if (!doc.client_email) {
      alert('❌ Aucun email pour ce prospect.');
      return;
    }
    if (!window.confirm(`Envoyer le document à ${doc.client_email} ?`)) return;
    setSendingEmail(doc.id);
    try {
      const res = await fetch('/api/documents/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`✅ Document envoyé à ${data.sentTo}`);
        await fetchDocuments(); // rafraîchit le statut "envoyé"
        // 📊 Avancement pipeline : envoi d'un doc (hors facture) → "Offre en cours"
        if (doc.type !== 'facture') {
          await advanceLeadPipeline(doc.lead_id, 'Offre en cours');
        }
      } else {
        alert(`❌ Erreur : ${data.error || 'Échec de l\'envoi'}`);
      }
    } catch (err) {
      alert(`❌ Erreur réseau : ${err.message}`);
    } finally {
      setSendingEmail(null);
    }
  };

  // ── Rendu professionnel du document (remplace dangerouslySetInnerHTML) ──
  const renderDocumentPreview = (doc) => {
    if (!doc) return null;

    const fmtEur = (v) =>
      (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const agency  = agencyProfile || {};
    const cj      = doc.content_json || {};
    const typeLabel = (doc.type || 'Document').toUpperCase().replace('_', ' ');
    const isFacture = /factur/i.test(doc.type || '');
    const isDevis   = /devis/i.test(doc.type || '');
    const isContrat = /contrat/i.test(doc.type || '');
    const totalTTC  = parseFloat(doc.total_ttc) || 0;
    const totalHT   = parseFloat(doc.total_ht)  || 0;
    const tva       = parseFloat(doc.tva_amount) || 0;
    const devise    = doc.devise || '€';

    // Description de la prestation (depuis content_json)
    const description = cj.services_inclus || cj.description_travaux || cj.description || null;
    const periode     = cj.periode_facturation || cj.periodeFacturation || null;
    const budgetM     = cj.budget_mensuel || null;
    const duree       = cj.duree_contrat || null;
    const conditions  = cj.conditions_paiement || cj.conditionsPaiement || 'À réception de facture';
    const notes       = cj.notes || cj.metadata?.notes || null;

    return (
      <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 720, margin: '0 auto', background: '#fff', padding: 0 }}>

        {/* Header agence + type document */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 40px 24px', borderBottom: '2px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
              {agency.nom_agence || agency.name || 'Agence'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              {agency.adresse_legale || agency.adresse || agency.address || ''}
              {(agency.adresse_legale || agency.adresse || agency.address) && <br />}
              {agency.email || ''}{agency.email && agency.telephone ? ' · ' : ''}{agency.telephone || ''}
              {(agency.siret || agency.registrationNumber) && (
                <><br /><span style={{ fontSize: 11, color: '#94a3b8' }}>
                  SIRET : {agency.siret || agency.registrationNumber}
                </span></>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', letterSpacing: 1 }}>
              {typeLabel}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.8 }}>
              <div><strong>Réf :</strong> {doc.reference || doc.numero_document || '—'}</div>
              <div><strong>Date :</strong> {fmtDate(doc.created_at)}</div>
              {(isFacture || isDevis) && (
                <div><strong>Échéance :</strong> 30 jours</div>
              )}
            </div>
          </div>
        </div>

        {/* CLIENT */}
        <div style={{ padding: '20px 40px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Client
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
            {doc.client_nom || cj.client_nom || '—'}
          </div>
          {(doc.client_email || cj.client_email) && (
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {doc.client_email || cj.client_email}
            </div>
          )}
          {cj.client_telephone && (
            <div style={{ fontSize: 13, color: '#64748b' }}>{cj.client_telephone}</div>
          )}
        </div>

        {/* DÉTAIL PRESTATION */}
        <div style={{ padding: '24px 40px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Description
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 80 }}>
                  Qté
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 130 }}>
                  Montant HT
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '14px', fontSize: 14, color: '#1e293b' }}>
                  {description || (isContrat ? 'Contrat de prestation de services' : isDevis ? 'Prestation selon devis' : 'Prestation de services')}
                  {periode && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Période : {periode}</div>}
                  {budgetM && duree && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {budgetM} {devise} × {duree} mois
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px', fontSize: 14, color: '#475569', textAlign: 'center' }}>1</td>
                <td style={{ padding: '14px', fontSize: 14, fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>
                  {totalHT > 0 ? fmtEur(totalHT) : totalTTC > 0 ? fmtEur(totalTTC) : '—'}
                </td>
              </tr>
            </tbody>
            <tfoot>
              {totalHT > 0 && (
                <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td colSpan={2} style={{ padding: '10px 14px', fontSize: 13, color: '#64748b', textAlign: 'right' }}>Total HT</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#1e293b', textAlign: 'right' }}>{fmtEur(totalHT)}</td>
                </tr>
              )}
              {tva > 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '6px 14px', fontSize: 13, color: '#64748b', textAlign: 'right' }}>TVA (20%)</td>
                  <td style={{ padding: '6px 14px', fontSize: 13, color: '#1e293b', textAlign: 'right' }}>{fmtEur(tva)}</td>
                </tr>
              )}
              <tr style={{ background: '#eff6ff', borderTop: '2px solid #bfdbfe' }}>
                <td colSpan={2} style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#1d4ed8', textAlign: 'right' }}>
                  TOTAL TTC
                </td>
                <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#1d4ed8', textAlign: 'right' }}>
                  {totalTTC > 0 ? fmtEur(totalTTC) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* CONDITIONS & NOTES */}
        <div style={{ padding: '0 40px 24px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                Conditions de paiement
              </div>
              <div style={{ fontSize: 13, color: '#475569' }}>{conditions}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                Statut
              </div>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: doc.statut === 'payé' ? '#dcfce7' : doc.statut === 'envoyé' ? '#dbeafe' : '#f1f5f9',
                color:      doc.statut === 'payé' ? '#15803d' : doc.statut === 'envoyé' ? '#1d4ed8' : '#475569',
              }}>
                {doc.statut || 'brouillon'}
              </span>
            </div>
          </div>
          {notes && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13, color: '#78350f' }}>{notes}</div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '16px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Document généré par <strong>{agency.nom_agence || agency.name || 'LeadQualif IA'}</strong> — {fmtDate(doc.created_at)}
          </div>
          {(agency.siret || agency.registrationNumber) && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              SIRET {agency.siret || agency.registrationNumber}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Génère un HTML complet pour devis/facture depuis les données du doc ──────
  // Miroir client du buildDocumentHtmlForPdf serveur — utilisé pour le téléchargement
  const buildCompleteDocumentHtml = (doc) => {
    const TYPE_LABELS = { devis: 'Devis', facture: 'Facture', contrat: 'Contrat de prestation', rapport: 'Rapport de performance', mandat: 'Mandat immobilier', compromis: 'Compromis de vente', bon_visite: 'Bon de visite', contrat_gestion: 'Contrat de gestion' };
    const label  = TYPE_LABELS[doc.type] || 'Document';
    const cj     = typeof doc.content_json === 'string' ? JSON.parse(doc.content_json) : (doc.content_json || {});
    const items  = Array.isArray(cj.items)  ? cj.items  : [];
    const totals = Array.isArray(cj.totals) ? cj.totals : [];
    const devise = doc.devise || cj.devise || '€';
    const fmt    = (v) => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
    const date   = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const ap     = agencyProfile || {};
    const agencyName  = ap.nom_agence  || ap.name  || 'Votre agence';
    const agencyEmail = ap.email       || '';
    const agencyTel   = ap.telephone   || ap.phone || '';
    const agencyAddr  = ap.adresse_legale || ap.adresse || ap.address || '';
    const agencySiret = ap.siret || ap.numero_enregistrement || ap.registrationNumber || '';
    const agencyLegal = ap.mention_legale || ap.legalMention || '';
    const conditions  = ap.conditions_paiement || ap.paymentConditions || '';
    const cartePT     = ap.carte_pro_t || '';
    const cartePS     = ap.carte_pro_s || '';

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
<html lang="fr"><head><meta charset="UTF-8"/><title>${label} ${doc.reference || ''}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111827;background:#fff;line-height:1.5;}.page{max-width:800px;margin:0 auto;padding:40px 36px;}table{border-collapse:collapse;width:100%;}</style>
</head><body><div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:24px;margin-bottom:28px;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#1e3a5f;">${agencyName}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;line-height:1.6;">
        ${agencyAddr  ? `<div>${agencyAddr}</div>`              : ''}
        ${agencyEmail ? `<div>Email : ${agencyEmail}</div>`    : ''}
        ${agencyTel   ? `<div>Tél : ${agencyTel}</div>`        : ''}
        ${agencySiret ? `<div>N° ${agencySiret}</div>`         : ''}
      </div>
      ${carteBadges ? `<div style="margin-top:8px;">${carteBadges}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:700;color:#1e3a5f;">${label}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:4px;">${doc.reference ? `Réf : ${doc.reference}` : ''}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:2px;">Date : ${date}</div>
    </div>
  </div>
  <div style="background:#f9fafb;border-left:4px solid #3b82f6;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:8px;">Client</div>
    <div style="font-size:16px;font-weight:700;color:#111827;">${doc.client_nom || '—'}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;line-height:1.6;">
      ${doc.client_email     ? `<div>Email : ${doc.client_email}</div>`     : ''}
      ${doc.client_telephone ? `<div>Tél : ${doc.client_telephone}</div>` : ''}
    </div>
  </div>
  ${items.length > 0 ? `
  <div style="margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Détail des prestations</div>
    <table><thead><tr style="background:#f3f4f6;">
      <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Description</th>
      <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:80px;">Qté</th>
      <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:140px;">Montant</th>
    </tr></thead><tbody>${itemsHtml}</tbody><tfoot>${totalsHtml}</tfoot></table>
  </div>` : ''}
  <div style="display:flex;gap:32px;margin-top:48px;padding-top:20px;border-top:1px solid #e5e7eb;">
    <div style="flex:1;text-align:center;"><div style="font-size:11px;color:#6b7280;margin-bottom:40px;">Signature de l'agence</div><div style="border-top:1px solid #9ca3af;padding-top:6px;font-size:12px;font-weight:600;color:#374151;">${agencyName}</div></div>
    <div style="flex:1;text-align:center;"><div style="font-size:11px;color:#6b7280;margin-bottom:40px;">Signature du client</div><div style="border-top:1px solid #9ca3af;padding-top:6px;font-size:12px;font-weight:600;color:#374151;">${doc.client_nom || ''}</div></div>
  </div>
  <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
    ${agencyLegal ? `<div>${agencyLegal}</div>` : ''}
    ${conditions  ? `<div>${conditions}</div>`  : ''}
    <div style="margin-top:4px;">Document généré par <strong>NexaPro</strong></div>
  </div>
</div></body></html>`;
  };

  /**
   * 🛡️ FONCTION DE TÉLÉCHARGEMENT HTML - DOM Natif
   */
  // CSS embarqué (utilisé seulement pour les docs preview_html anciens)
  const INLINE_DOC_CSS = `
    body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#fff;color:#111827;}
    .signature-section{margin-top:40px;display:flex;justify-content:space-between;gap:40px;padding-top:20px;border-top:1px solid #e5e7eb;}
    .signature-block{flex:1;text-align:left;padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;}
    .signature-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px;display:block;}
    .signature-line{border-bottom:1px solid #9ca3af;height:44px;margin:8px 0 6px 0;position:relative;}
    .signature-label{font-size:11px;color:#374151;font-weight:600;display:block;}
    .signature-date{font-size:10px;color:#9ca3af;margin-top:4px;display:block;}
    .financial-table{width:100%;border-collapse:collapse;font-size:11px;margin:16px 0;}
    .financial-table th,.financial-table td{padding:10px;text-align:left;border-bottom:1px solid #eee;}
    .financial-table th{background:#f5f5f5;font-weight:600;color:#374151;}
    .financial-table td:last-child{text-align:right;font-weight:600;}
    .total-ttc{background:#f0f9ff;border-top:2px solid #3b82f6;}
    .total-ttc td{font-weight:bold;color:#1d4ed8;font-size:14px;}
    .client-section{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:15px;margin:20px 0;}
    .header-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
    .agency-info h2{font-size:18px;font-weight:bold;margin:0 0 5px;color:#111827;}
    .agency-info p{font-size:11px;color:#6b7280;margin:2px 0;}
    .document-title{font-size:24px;font-weight:bold;margin-bottom:10px;color:#111827;text-align:right;}
    .document-meta{font-size:11px;color:#6b7280;line-height:1.4;text-align:right;}
    .metadata-section{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:15px;margin:20px 0;}
    .amount{font-family:'Courier New',monospace;white-space:nowrap;}
  `;

  const downloadDocument = (document) => {
    try {
      // 🎯 Vérification des données requises
      if (!document) {
        console.error('❌ downloadDocument: document est null ou undefined');
        alert('❌ Document non disponible pour le téléchargement');
        return;
      }

      if (!document.preview_html && !document.content_json) {
        console.error('❌ downloadDocument: aucun contenu HTML trouvé');
        alert('❌ Aucun contenu à télécharger');
        return;
      }

      // Pour devis/facture : HTML régénéré depuis content_json (complet + info agence)
      // Pour les autres types : preview_html avec CSS inline
      const FINANCIAL_TYPES = ['devis', 'facture'];
      let htmlContent;
      if (FINANCIAL_TYPES.includes(document.type) && document.content_json) {
        htmlContent = buildCompleteDocumentHtml(document);
      } else {
        const rawHtml = document.preview_html ||
                        (document.content_json?.html_content) ||
                        `<div><h1>${document.reference || 'Document'}</h1></div>`;
        htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${document.reference || 'Document'}</title>
  <style>${INLINE_DOC_CSS}</style>
</head>
<body>
${rawHtml}
</body>
</html>`;
      }

      // 🎯 Créer un Blob à partir du HTML
      const blob = new Blob([htmlContent], {
        type: 'text/html;charset=utf-8'
      });

      // 🎯 Créer une URL temporaire
      const url = window.URL.createObjectURL(blob);

      // 🎯 Créer un élément <a> natif (pas React)
      const link = window.document.createElement('a');
      
      // 🎯 Configurer le lien de téléchargement
      link.href = url;
      link.download = `${document.reference || 'document'}.html`;
      link.style.display = 'none'; // Cacher le lien
      
      // 🎯 Ajouter au DOM, cliquer, puis nettoyer
      window.document.body.appendChild(link);
      
      // 🎯 Déclencher le téléchargement
      link.click();
      
      // 🎯 Nettoyer le DOM
      window.document.body.removeChild(link);
      
      // 🎯 Libérer l'URL (important pour la mémoire)
      window.URL.revokeObjectURL(url);

      console.log('✅ Document téléchargé:', document.reference);
      
    } catch (error) {
      console.error('❌ Erreur téléchargement document:', error);
      alert('❌ Erreur lors du téléchargement du document');
    }
  };

  /**
   * 🔄 FONCTION DÉPRÉCIÉE - Maintenue pour compatibilité
   * @deprecated Utiliser downloadDocument() à la place
   */
  const handleDownload = async (document) => {
    console.warn('⚠️ handleDownload est déprécié, utilisez downloadDocument()');
    downloadDocument(document);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    if (!amount) return '0,00 €';
    
    // 🎯 CORRECTION: Convertir le symbole € en code ISO 4217
    // Intl.NumberFormat n'accepte que les codes ISO, pas les symboles
    const normalizedCurrency = currency === '€' ? 'EUR' : currency;
    
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: normalizedCurrency
      }).format(amount);
    } catch (error) {
      console.warn('⚠️ Erreur formatCurrency avec devise:', currency, error);
      // Fallback en cas d'erreur
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
  };

  // Normaliser les statuts mixtes (anglais hérité ou français)
  const normalizeStatut = (s) => {
    if (!s) return 'généré';
    const map = {
      'generated': 'généré', 'draft': 'généré', 'brouillon': 'généré',
      'sent': 'envoyé', 'emitted': 'envoyé', 'émis': 'envoyé', 'émise': 'envoyé',
      'paid': 'payé', 'payée': 'payé',
      'signed': 'signé', 'validated': 'validé',
    };
    return map[s.toLowerCase()] || s.toLowerCase();
  };

  const getStatusColor = (statut) => {
    statut = normalizeStatut(statut);
    const colors = {
      'généré':  'bg-blue-100 text-blue-800',
      'émise':   'bg-indigo-100 text-indigo-800',
      'émis':    'bg-indigo-100 text-indigo-800',
      'envoyé':  'bg-amber-100 text-amber-800',
      'envoyée': 'bg-amber-100 text-amber-800',
      'signé':   'bg-teal-100 text-teal-800',
      'validé':  'bg-green-100 text-green-800',
      'facturé': 'bg-purple-100 text-purple-800',
      'converti':'bg-purple-100 text-purple-800',
      'payé':    'bg-emerald-100 text-emerald-800',
      'payée':   'bg-emerald-100 text-emerald-800',
      'annulé':  'bg-red-100 text-red-800',
    };
    return colors[statut] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'devis':            '💰',
      'facture':          '🧾',
      'mandat':           '📋',
      'rapport':          '📊',
      'contrat':          '📝',
      'compromis':        '🤝',
      'bon_visite':       '🏠',
      'bon_de_visite':    '🏠',
      'contrat_gestion':  '📑',
      'offre_achat':      '🏷️',
      'attestation':      '✅',
      'convention':       '🤝',
    };
    return icons[type] || '📄';
  };

  const totalPages = Math.ceil(totalCount / pagination.limit);

  if (!agencyProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
        <p className="text-sm">Chargement du profil…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* ── En-tête de page (slim, intégré à la sidebar Layout) ── */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-xl">📂</span>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Documents</h1>
              <p className="text-xs text-slate-500">
                {totalCount} document{totalCount > 1 ? 's' : ''} · {agencyProfile.nom_agence}
                {agencyProfile.type_agence === 'immobilier' ? ' · 🏠 Immo' : ' · 📱 SMMA'}
              </p>
            </div>
          </div>
          {leadIdFilter && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                🔍 Lead filtré
              </span>
              <a href="/documents" className="text-xs text-slate-500 hover:text-slate-700 underline">
                Voir tout
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex-none bg-white border-b border-slate-100 px-6 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Recherche */}
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Référence, titre ou client…"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none bg-slate-50"
            />
          </div>

          {/* Type */}
          <div>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            >
              <option value="tous">Tous les types</option>
              <option value="devis">💰 Devis</option>
              <option value="facture">🧾 Factures</option>
              {agencyProfile?.type_agence === 'immobilier' && <>
                <option value="mandat">📋 Mandats</option>
                <option value="compromis">🤝 Compromis</option>
                <option value="bon_visite">🏠 Bons de visite</option>
                <option value="contrat_gestion">📑 Contrats gestion</option>
              </>}
              {agencyProfile?.type_agence === 'smma' && <>
                <option value="rapport">📊 Rapports</option>
                <option value="contrat">📝 Contrats</option>
              </>}
            </select>
          </div>

          {/* Statut */}
          <div>
            <select
              value={filters.statut}
              onChange={(e) => handleFilterChange('statut', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            >
              <option value="tous">Tous les statuts</option>
              <option value="généré">📝 Généré</option>
              <option value="validé">✅ Validé</option>
              <option value="facturé">🧾 Facturé</option>
              <option value="émis">📤 Émis</option>
              <option value="payé">💰 Payé</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            >
              <option value="tous">Toutes les dates</option>
              <option value="7jours">7 derniers jours</option>
              <option value="30jours">30 derniers jours</option>
              <option value="90jours">90 derniers jours</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Bandeau CA ── */}
      {(caStats.total > 0 || caStats.countEnvoye > 0 || caStats.countPaye > 0) ? (
        <div className="flex-none bg-white border-b border-slate-100 px-6 py-3">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-emerald-700">
                💰 CA total : {caStats.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </span>
            </div>
            {caStats.countEnvoye > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                📤 {caStats.countEnvoye} facture{caStats.countEnvoye > 1 ? 's' : ''} envoyée{caStats.countEnvoye > 1 ? 's' : ''} (en attente)
              </span>
            )}
            {caStats.countPaye > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                ✅ {caStats.countPaye} facture{caStats.countPaye > 1 ? 's' : ''} payée{caStats.countPaye > 1 ? 's' : ''} (CA réalisé)
              </span>
            )}
          </div>
        </div>
      ) : documents.length > 0 && !documents.some(d => d.type === 'facture') && (
        <div className="flex-none bg-amber-50 border-b border-amber-100 px-6 py-2.5">
          <p className="text-xs text-amber-700">
            💡 <strong>Suivi CA</strong> — Convertissez un devis en facture (bouton 🔄) puis marquez-la envoyée 📤 ou payée 💰 pour activer le suivi du chiffre d'affaires.
          </p>
        </div>
      )}

      {/* ── Contenu principal scrollable ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-sm">Chargement des documents…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-5xl mb-4">📄</span>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Aucun document trouvé</h3>
            <p className="text-sm">
              {filters.searchTerm || filters.type !== 'tous' || filters.statut !== 'tous'
                ? 'Essayez de modifier vos filtres'
                : 'Créez votre premier document depuis un lead'}
            </p>
          </div>
        ) : (
          <>
            {/* Liste des documents */}
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      // Carte de conversion : devis_id → référence facture
                      const conversionMap = {};
                      documents.forEach(d => {
                        if (d.parent_document_id) conversionMap[d.parent_document_id] = d.reference;
                      });
                      return documents.map((doc) => {
                        const convertedTo   = conversionMap[doc.id];           // devis déjà converti → ref facture
                        const convertedFrom = doc.parent_document_id
                          ? documents.find(d => d.id === doc.parent_document_id)?.reference
                          : doc.content_json?.conversion_info?.devis_reference; // facture venant d'un devis
                        const isFacture = doc.type === 'facture';
                        const statutNorm = normalizeStatut(doc.statut);
                        const canMarkEnvoye = isFacture && !['envoyé','payé'].includes(statutNorm);
                        const canMarkPaye   = isFacture && statutNorm !== 'payé';
                        return (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xl shrink-0">{getTypeIcon(doc.type)}</span>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{doc.reference}</div>
                              <div className="text-xs text-slate-400 truncate max-w-[160px]">{doc.titre}</div>
                              {convertedTo && (
                                <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700 font-medium">
                                  🔄 → {convertedTo}
                                </span>
                              )}
                              {convertedFrom && (
                                <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium">
                                  ← {convertedFrom}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-sm text-slate-700">{doc.client_nom || '—'}</div>
                          {doc.client_email && (
                            <div className="text-xs text-slate-400">{doc.client_email}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-800">
                            {/contrat|rapport/i.test(doc.type || '')
                              ? <span className="text-slate-300 font-normal">—</span>
                              : formatCurrency(doc.total_ttc, doc.devise)
                            }
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                            {normalizeStatut(doc.statut)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400 hidden sm:table-cell">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <button
                              onClick={() => handlePreview(doc)}
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Aperçu"
                            >👁️</button>
                            <button
                              onClick={() => downloadDocument(doc)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Télécharger"
                            >⬇️</button>
                            {/* Envoyer par email */}
                            {doc.client_email && (
                              <button
                                onClick={() => handleSendEmail(doc)}
                                disabled={sendingEmail === doc.id}
                                className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                                title={`Envoyer par email à ${doc.client_email}`}
                              >{sendingEmail === doc.id ? '⏳' : '📧'}</button>
                            )}
                            {/* Partager par WhatsApp */}
                            {(doc.client_telephone || doc.content_json?.telephone || doc.content_json?.client_telephone) && (
                              <button
                                onClick={() => handleShareWhatsApp(doc)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors"
                                title={`WhatsApp · ${doc.client_telephone || doc.content_json?.telephone || doc.content_json?.client_telephone}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </button>
                            )}
                            {doc.type === 'devis' && !convertedTo && (
                              <button
                                onClick={() => { setSelectedDocument(doc); setShowConversionModal(true); }}
                                className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Convertir en facture"
                              >🔄</button>
                            )}
                            {canMarkEnvoye && (
                              <button
                                onClick={() => handleStatusChange(doc, 'envoyé')}
                                disabled={updatingStatus === doc.id}
                                className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Marquer comme envoyée manuellement"
                              >{updatingStatus === doc.id ? '⏳' : '📤'}</button>
                            )}
                            {canMarkPaye && (
                              <button
                                onClick={() => handleStatusChange(doc, 'payé')}
                                disabled={updatingStatus === doc.id}
                                className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Marquer comme payée → CA réalisé"
                              >{updatingStatus === doc.id ? '⏳' : '💰'}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, totalCount)} sur {totalCount} documents
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Précédent
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    {pagination.page} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de conversion devis → facture */}
      {showConversionModal && selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Convertir le devis en facture
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Vous allez convertir le document suivant :
                </p>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Référence :</span>
                    <span>{selectedDocument.reference}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Client :</span>
                    <span>{selectedDocument.client_nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Montant :</span>
                    <span>{formatCurrency(selectedDocument.total_ttc, selectedDocument.devise)}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConversionModal(false);
                    setSelectedDocument(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleConvertToInvoice(selectedDocument)}
                  disabled={convertingId === selectedDocument.id}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {convertingId === selectedDocument.id ? 'Conversion...' : 'Convertir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de preview — rendu propre avec vraies données */}
      {showPreviewModal && previewDocument && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto z-50 flex items-start justify-center py-8 px-4">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-none">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Aperçu : {previewDocument.reference}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(previewDocument.type || '').toUpperCase()} · {previewDocument.client_nom || '—'} ·{' '}
                  <span className={`font-semibold ${
                    previewDocument.statut === 'payé' ? 'text-green-600'
                    : previewDocument.statut === 'envoyé' ? 'text-blue-600'
                    : 'text-slate-500'
                  }`}>
                    {previewDocument.statut || 'brouillon'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => { setShowPreviewModal(false); setPreviewDocument(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 text-xl transition"
              >
                ×
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                {renderDocumentPreview(previewDocument)}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
