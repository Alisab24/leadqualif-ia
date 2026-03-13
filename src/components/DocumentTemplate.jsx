/**
 * DocumentTemplate — Template unifié pour TOUS les documents
 * IMMO : Devis, Facture, Mandat, Bon de Visite, Offre d'Achat
 * SMMA : Devis, Facture, Rapport
 *
 * Fonctionnalités :
 * - Branding agence (logo, couleurs primaires)
 * - TVA optionnelle (ON/OFF selon pays/régime)
 * - Devise adaptative (EUR, FCFA, USD…)
 * - Filigrane automatique selon statut
 * - Mentions ALUR / Hoguet / Carte Pro si IMMO
 * - Montant en lettres (légalement requis dans certains pays)
 * - Numérotation complète : FAC, DEV, MAN, BDV, OFF, RAP
 * - Export PDF via html2pdf.js (pixel-perfect, pas d'impression navigateur)
 */

import React, { forwardRef } from 'react';
import { DocumentCounterService } from '../services/documentCounterService';

/* ─── Constantes ───────────────────────────────────────────── */

const TYPE_CONFIG = {
  devis:        { label: 'DEVIS',             prefix: 'DEV', icon: '💰', color: '#2563eb' },
  facture:      { label: 'FACTURE',           prefix: 'FAC', icon: '🧾', color: '#16a34a' },
  mandat:       { label: 'MANDAT',            prefix: 'MAN', icon: '✍️',  color: '#7c3aed' },
  bon_de_visite:{ label: 'BON DE VISITE',     prefix: 'BDV', icon: '🏠', color: '#0891b2' },
  offre_achat:  { label: "OFFRE D'ACHAT",     prefix: 'OFF', icon: '🤝', color: '#ea580c' },
  rapport:      { label: 'RAPPORT',           prefix: 'RAP', icon: '📊', color: '#8b5cf6' },
  contrat:      { label: 'CONTRAT',           prefix: 'CTR', icon: '📋', color: '#475569' },
};

const STATUT_WATERMARK = {
  brouillon: { label: 'BROUILLON', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  annulé:    { label: 'ANNULÉ',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  payé:      { label: 'PAYÉ',      color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
};

/* ─── Utilitaires ──────────────────────────────────────────── */

function fmt(amount, symbole = '€', devise = 'EUR') {
  if (!amount && amount !== 0) return `— ${symbole}`;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + symbole;
}

function fmtDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function addDays(d, n) {
  const r = new Date(d || Date.now());
  r.setDate(r.getDate() + n);
  return r;
}

/* ─── Filigrane ───────────────────────────────────────────── */
const Watermark = ({ statut }) => {
  const wm = STATUT_WATERMARK[statut];
  if (!wm) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 80, fontWeight: 900, letterSpacing: 8,
        color: wm.color, opacity: 0.18,
        transform: 'rotate(-35deg)',
        userSelect: 'none', whiteSpace: 'nowrap',
      }}>
        {wm.label}
      </div>
    </div>
  );
};

/* ─── En-tête document ────────────────────────────────────── */
const DocHeader = ({ agency, docType, documentNumber, dateCreation, couleur }) => {
  const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.devis;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${couleur}` }}>
      {/* Logo + infos agence */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {agency?.logo_url ? (
          <img src={agency.logo_url} alt="Logo" style={{ height: 56, width: 'auto', objectFit: 'contain', borderRadius: 8 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 10, background: couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
            {(agency?.nom_agence || agency?.nom_legal || 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', lineHeight: 1.2 }}>
            {agency?.nom_legal || agency?.nom_agence || 'Mon Agence'}
          </div>
          {agency?.adresse_legale || agency?.adresse ? (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
              {(agency.adresse_legale || agency.adresse).split(',').map((l, i) => <span key={i}>{l.trim()}<br /></span>)}
            </div>
          ) : null}
          {agency?.telephone && <div style={{ fontSize: 11, color: '#64748b' }}>{agency.telephone}</div>}
          {agency?.email && <div style={{ fontSize: 11, color: couleur }}>{agency.email}</div>}
        </div>
      </div>

      {/* Type + numéro */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-block', background: couleur, color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 2, padding: '4px 14px', borderRadius: 20, marginBottom: 8 }}>
          {cfg.label}
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, color: '#0f172a', lineHeight: 1 }}>
          {documentNumber || `${cfg.prefix}-APERÇU`}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          Émis le {fmtDate(dateCreation || new Date())}
        </div>
      </div>
    </div>
  );
};

/* ─── Bloc adresse (agence ↔ client) ─────────────────────── */
const AddressBlock = ({ agency, lead, docType, dateValidite, dateEcheance, couleur }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
      {/* Émetteur */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${couleur}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>De</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{agency?.nom_legal || agency?.nom_agence}</div>
        {agency?.numero_enregistrement && <div style={{ fontSize: 11, color: '#64748b' }}>SIRET / IFU : {agency.numero_enregistrement}</div>}
        {agency?.numero_tva && <div style={{ fontSize: 11, color: '#64748b' }}>N° TVA : {agency.numero_tva}</div>}
        {agency?.statut_juridique && <div style={{ fontSize: 11, color: '#64748b' }}>{agency.statut_juridique}</div>}
      </div>

      {/* Destinataire */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid #e2e8f0` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          {docType === 'mandat' ? 'Mandant' : docType === 'bon_de_visite' ? 'Acquéreur potentiel' : docType === 'offre_achat' ? 'Acquéreur' : 'Destinataire'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{lead?.nom || '—'}</div>
        {lead?.email && <div style={{ fontSize: 11, color: '#64748b' }}>{lead.email}</div>}
        {lead?.telephone && <div style={{ fontSize: 11, color: '#64748b' }}>{lead.telephone}</div>}
        {lead?.adresse && <div style={{ fontSize: 11, color: '#64748b' }}>{lead.adresse}</div>}

        {/* Dates selon type */}
        {docType === 'devis' && dateValidite && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6, fontWeight: 600 }}>
            Valide jusqu'au {fmtDate(dateValidite)}
          </div>
        )}
        {docType === 'facture' && dateEcheance && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 600 }}>
            Échéance : {fmtDate(dateEcheance)}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Tableau des lignes ─────────────────────────────────── */
const LignesTable = ({ items, tvaEnabled, tvaRate, symbole, couleur }) => {
  const sousTotal = items.reduce((s, i) => s + (parseFloat(i.prix_unitaire || i.price || 0) * parseFloat(i.quantite || i.quantity || 1)), 0);
  const montantTva = tvaEnabled ? sousTotal * (tvaRate / 100) : 0;
  const total = sousTotal + montantTva;

  return (
    <div style={{ marginBottom: 20 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: couleur, color: '#fff' }}>
            <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: 0.5 }}>DÉSIGNATION</th>
            <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, width: '30%' }}>DESCRIPTION</th>
            <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, fontSize: 10, width: 60 }}>QTÉ</th>
            <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: 10, width: 100 }}>PRIX U.</th>
            <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: 10, width: 110 }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const qte = parseFloat(item.quantite || item.quantity || 1);
            const pu = parseFloat(item.prix_unitaire || item.price || 0);
            const ligneTotal = qte * pu;
            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.designation || item.nom || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{item.description || ''}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{qte}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{fmt(pu, symbole)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(ligneTotal, symbole)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bloc totaux */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <div style={{ width: 260 }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#64748b' }}>
              <span>Sous-total {tvaEnabled ? 'HT' : ''}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(sousTotal, symbole)}</span>
            </div>
            {tvaEnabled ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#64748b' }}>
                  <span>TVA ({tvaRate}%)</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(montantTva, symbole)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>TOTAL TTC</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: couleur }}>{fmt(total, symbole)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>TOTAL</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: couleur }}>{fmt(total, symbole)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Montant en lettres ─────────────────────────────────── */
const MontantEnLettres = ({ items, tvaEnabled, tvaRate, symbole, devise }) => {
  const sousTotal = items.reduce((s, i) => s + (parseFloat(i.prix_unitaire || i.price || 0) * parseFloat(i.quantite || i.quantity || 1)), 0);
  const total = tvaEnabled ? sousTotal * (1 + tvaRate / 100) : sousTotal;
  const enLettres = DocumentCounterService.formatAmountInWords(total);
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: 11, color: '#92400e' }}>
      <strong>Montant en lettres :</strong> {enLettres} {devise !== 'EUR' ? `(${devise})` : ''}
    </div>
  );
};

/* ─── Section spécifique Mandat IMMO ─────────────────────── */
const MandatSection = ({ lead, agency, notes }) => (
  <div style={{ marginBottom: 20, fontSize: 12 }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
      Objet du mandat
    </div>
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', lineHeight: 1.7, color: '#334155' }}>
      <p>Le mandant confie au mandataire — {agency?.nom_legal || agency?.nom_agence} — titulaire de la carte professionnelle
      {agency?.carte_pro_t ? ` T n° ${agency.carte_pro_t}` : ''}{agency?.carte_pro_s ? ` et S n° ${agency.carte_pro_s}` : ''},
      la mission de {lead?.role === 'propriétaire' ? 'vendre' : 'rechercher'} le bien décrit ci-dessous.</p>
      {lead?.type_bien && <p><strong>Type de bien :</strong> {lead.type_bien}</p>}
      {lead?.adresse_bien && <p><strong>Adresse du bien :</strong> {lead.adresse_bien}</p>}
      {lead?.surface && <p><strong>Surface :</strong> {lead.surface} m²</p>}
      {lead?.prix_vente && <p><strong>Prix de vente :</strong> {parseFloat(lead.prix_vente).toLocaleString('fr-FR')} €</p>}
    </div>
    {notes && (
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b', fontSize: 11 }}>
        {notes}
      </div>
    )}
  </div>
);

/* ─── Mentions légales IMMO ─────────────────────────────── */
const MentionsImmo = ({ agency }) => (
  <div style={{ marginTop: 4, fontSize: 9.5, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
    {agency?.carte_pro_t && (
      <p>Carte professionnelle Transaction n° {agency.carte_pro_t} — délivrée par la CCI.</p>
    )}
    {agency?.carte_pro_s && (
      <p>Carte professionnelle Syndic n° {agency.carte_pro_s} — délivrée par la CCI.</p>
    )}
    <p>Activité exercée conformément à la loi n° 70-9 du 2 janvier 1970 (loi Hoguet) et son décret d'application.</p>
    {agency?.mention_legale && <p>{agency.mention_legale}</p>}
  </div>
);

/* ─── Mentions légales SMMA ─────────────────────────────── */
const MentionsSmma = ({ agency }) => (
  <div style={{ marginTop: 4, fontSize: 9.5, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
    {agency?.activite_principale && <p>Activité : {agency.activite_principale}</p>}
    {agency?.numero_tva && <p>N° TVA intracommunautaire : {agency.numero_tva}</p>}
    {agency?.mention_legale && <p>{agency.mention_legale}</p>}
    {!agency?.numero_tva && <p>TVA non applicable — Art. 293B du CGI (ou régime exonéré selon législation locale).</p>}
  </div>
);

/* ─── Zone de signature ──────────────────────────────────── */
const SignatureZone = ({ docType, agency, lead }) => {
  const needsBothSig = ['mandat', 'offre_achat', 'contrat'].includes(docType);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: needsBothSig ? '1fr 1fr' : '1fr 2fr', gap: 24, marginTop: 24, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Fait à ________, le {new Date().toLocaleDateString('fr-FR')}</div>
        {agency?.conditions_paiement && (
          <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.6 }}>
            <strong>Conditions :</strong> {agency.conditions_paiement}
          </div>
        )}
      </div>
      {needsBothSig ? (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 32 }}>Signature mandataire / agence</div>
            <div style={{ borderBottom: '1px solid #cbd5e1', marginTop: 8, width: '70%', margin: '0 auto' }} />
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{agency?.nom_legal || agency?.nom_agence}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 32 }}>Signature mandant / client</div>
            <div style={{ borderBottom: '1px solid #cbd5e1', marginTop: 8, width: '70%', margin: '0 auto' }} />
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{lead?.nom || 'Client'}</div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 32 }}>Signature et cachet</div>
          <div style={{ display: 'inline-block', borderBottom: '1px solid #cbd5e1', minWidth: 160 }} />
        </div>
      )}
    </div>
  );
};

/* ─── Pied de page ───────────────────────────────────────── */
const DocFooter = ({ agency, documentNumber, couleur }) => (
  <div style={{ marginTop: 20, paddingTop: 10, borderTop: `1px solid ${couleur}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ fontSize: 9, color: '#cbd5e1' }}>
      <strong style={{ color: '#94a3b8' }}>{agency?.nom_legal || agency?.nom_agence}</strong>
      {agency?.numero_enregistrement && ` — SIRET/IFU ${agency.numero_enregistrement}`}
    </div>
    <div style={{ fontSize: 9, color: '#cbd5e1' }}>
      Réf. {documentNumber || '—'} · Généré via LeadQualif IA
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL — DocumentTemplate
   ════════════════════════════════════════════════════════════ */
const DocumentTemplate = forwardRef(function DocumentTemplate({
  /* Document */
  type = 'devis',           // devis | facture | mandat | bon_de_visite | offre_achat | rapport | contrat
  documentNumber,
  statut = 'brouillon',     // brouillon | généré | envoyé | signé | payé | annulé
  dateCreation,
  dateValidite,             // pour devis (validité 30j par défaut)
  dateEcheance,             // pour facture (échéance 30j par défaut)

  /* Parties */
  agency = {},              // profil agence depuis Supabase profiles
  lead = {},                // lead depuis Supabase leads
  agencyType,              // type d'agence depuis Dashboard ('immobilier' | 'smma')

  /* Lignes */
  items = [],               // [{ designation, description, quantite, prix_unitaire }]

  /* TVA */
  tvaEnabled = true,        // false pour pays sans TVA (Afrique zone OHADA partiel, etc.)
  tvaRate = 20,             // 20 (France), 18 (Bénin), 0 (exonéré)

  /* Devise — auto depuis profil agence */
  symbole,                  // ex: '€', 'FCFA', '$'
  devise,                   // ex: 'EUR', 'XOF', 'USD'

  /* Options */
  notes = '',
  showAmountInWords = true, // légalement requis dans certains pays
}, ref) {

  const couleur = agency?.couleur_primaire || '#2563eb';
  const sym = symbole || agency?.symbole_devise || '€';
  const dev = devise || agency?.devise || 'EUR';
  // 🎯 PRIORITÉ : agencyType transmis > agency.type_agence > fallback 'immobilier'
  const isImmo = agencyType === 'immobilier' || agency?.type_agence === 'immobilier';
  const isMandatType = ['mandat', 'bon_de_visite', 'offre_achat'].includes(type);

  // Dates automatiques si non fournies
  const now = new Date();
  const validite = dateValidite || addDays(dateCreation || now, 30);
  const echeance = dateEcheance || addDays(dateCreation || now, 30);

  // Items par défaut si aucun fourni
  const defaultItems = isImmo ? [
    { designation: 'Honoraires d\'agence', description: 'Commission sur transaction immobilière', quantite: 1, prix_unitaire: lead?.budget ? Math.round(lead.budget * 0.05) : 5000 },
  ] : [
    { designation: 'Gestion des réseaux sociaux', description: 'Création de contenu, planning éditorial', quantite: 1, prix_unitaire: 1500 },
    { designation: 'Publicité Meta / Google', description: 'Budget campagne + frais de gestion', quantite: 1, prix_unitaire: 800 },
  ];
  const lignes = items.length > 0 ? items : defaultItems;
  const hasItems = !isMandatType || lignes.length > 0;

  return (
    <div
      ref={ref}
      id="document-template-print"
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        background: '#ffffff',
        width: '794px',          /* ~A4 en px 96dpi */
        minHeight: '1122px',
        padding: '40px 48px',
        boxSizing: 'border-box',
        position: 'relative',
        color: '#1e293b',
        lineHeight: 1.5,
      }}
    >
      {/* Filigrane statut */}
      <Watermark statut={statut} />

      {/* Bande couleur en haut */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(to right, ${couleur}, ${agency?.couleur_secondaire || couleur}88)` }} />

      {/* En-tête */}
      <DocHeader
        agency={agency}
        docType={type}
        documentNumber={documentNumber}
        dateCreation={dateCreation}
        couleur={couleur}
      />

      {/* Blocs adresses + dates */}
      <AddressBlock
        agency={agency}
        lead={lead}
        docType={type}
        dateValidite={validite}
        dateEcheance={echeance}
        couleur={couleur}
      />

      {/* Section spécifique Mandat */}
      {isMandatType && isImmo && (
        <MandatSection lead={lead} agency={agency} notes={notes} />
      )}

      {/* Tableau des lignes (devis, facture, rapport) */}
      {hasItems && !isMandatType && (
        <>
          <LignesTable
            items={lignes}
            tvaEnabled={tvaEnabled}
            tvaRate={tvaRate}
            symbole={sym}
            couleur={couleur}
          />
          {showAmountInWords && (
            <MontantEnLettres
              items={lignes}
              tvaEnabled={tvaEnabled}
              tvaRate={tvaRate}
              symbole={sym}
              devise={dev}
            />
          )}
        </>
      )}

      {/* Notes libres */}
      {notes && !isMandatType && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderLeft: `3px solid ${couleur}`, borderRadius: '0 8px 8px 0', fontSize: 11.5, color: '#475569' }}>
          <strong style={{ color: '#0f172a' }}>Notes :</strong> {notes}
        </div>
      )}

      {/* Zone de signature */}
      <SignatureZone docType={type} agency={agency} lead={lead} />

      {/* Mentions légales */}
      <div style={{ marginTop: 8 }}>
        {isImmo ? <MentionsImmo agency={agency} /> : <MentionsSmma agency={agency} />}
      </div>

      {/* Pied de page */}
      <DocFooter agency={agency} documentNumber={documentNumber} couleur={couleur} />

    </div>
  );
});

export default DocumentTemplate;

/* ─── Utilitaire export PDF ──────────────────────────────── */
/**
 * Télécharge le document en PDF pixel-perfect via html2pdf.js
 * @param {string} elementId - ID du conteneur du template (défaut: 'document-template-print')
 * @param {string} filename   - Nom du fichier PDF
 */
export async function downloadDocumentAsPdf(elementId = 'document-template-print', filename = 'Document.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('DocumentTemplate: élément introuvable:', elementId);
    return;
  }

  // Import dynamique pour ne pas alourdir le bundle si non utilisé
  const html2pdf = (await import('html2pdf.js')).default;

  const options = {
    margin:       [8, 8, 8, 8],     // mm
    filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
  };

  return html2pdf().set(options).from(element).save();
}
