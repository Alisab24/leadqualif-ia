import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentManager({ lead, agencyId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('IMMO'); // Onglet par défaut

  // 1. CHARGEMENT DATA
  useEffect(() => {
    const fetchData = async () => {
      if (agencyId) {
        const { data } = await supabase.from('profiles').select('*').eq('agency_id', agencyId).single();
        setAgencyProfile(data);
      }
      fetchDocuments();
    };
    fetchData();
  }, [agencyId, lead.id]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  // 2. CONFIGURATION DES MODÈLES (TEMPLATES)
  const templates = {
    IMMO: [
      { name: 'Bon de Visite', icon: '👀', type: 'juridique' },
      { name: 'Mandat de Vente', icon: '⚖️', type: 'juridique' },
      { name: 'Offre d\'Achat', icon: '💰', type: 'transaction' },
      { name: 'Fiche Client', icon: '📋', type: 'recap' },
      { name: 'Compte-rendu', icon: '📝', type: 'suivi' }
    ],
    SMMA: [
      { name: 'Devis Prestation', icon: '💶', type: 'vente' },
      { name: 'Contrat Service', icon: '🤝', type: 'juridique' },
      { name: 'Facture', icon: '🧾', type: 'compta' },
      { name: 'Brief Onboarding', icon: '🚀', type: 'projet' }
    ]
  };

  // 3. GÉNÉRATEUR PDF INTELLIGENT
  const generatePDF = async (docName) => {
    setLoading(true);
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    // -- HEADER (Logo & Branding) --
    doc.setFontSize(20);
    doc.setTextColor(41, 98, 255); // Bleu Agence
    doc.text(agencyProfile?.agency_name?.toUpperCase() || "AGENCE PARTENAIRE", 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Email: ${agencyProfile?.email || 'contact@agence.com'}`, 15, 26);
    doc.text(`Tel: ${agencyProfile?.telephone || 'Non renseigné'}`, 15, 31);

    doc.setDrawColor(200);
    doc.line(15, 35, 195, 35); // Ligne de séparation

    // -- TITRE --
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text(docName.toUpperCase(), 105, 50, { align: 'center' });

    // -- INFO CLIENT --
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 60, 180, 25, 'F'); // Fond gris léger
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENT / PROSPECT :", 20, 68);
    doc.setFont("helvetica", "normal");
    doc.text(`Nom : ${lead.nom}`, 20, 75);
    doc.text(`Email : ${lead.email}`, 100, 75);
    doc.text(`Tel : ${lead.telephone}`, 20, 82);
    doc.text(`Projet : ${lead.type_bien}`, 100, 82);
    let cursorY = 100;

    // -- CONTENU DYNAMIQUE --
    doc.setFontSize(11);
    if (docName === 'Bon de Visite') {
      doc.text("Je soussigné(e), reconnais avoir visité ce jour les biens présentés par l'agence.", 15, cursorY);
      doc.text(`Bien : ${lead.type_bien} - Budget env. ${lead.budget} €`, 15, cursorY + 10);
      doc.text("Je m'engage à ne traiter que par l'intermédiaire de l'agence.", 15, cursorY + 20);
      doc.text("Signature Client :", 130, cursorY + 50);
    } 
    else if (docName === 'Mandat de Vente') {
      doc.text("LE MANDANT charge le MANDATAIRE de vendre le bien désigné ci-après.", 15, cursorY);
      doc.text(`Type de bien : ${lead.type_bien}`, 15, cursorY + 10);
      doc.text(`Prix net vendeur souhaité : ${lead.budget} €`, 15, cursorY + 20);
      doc.text("Durée du mandat : 3 mois irrévocables.", 15, cursorY + 30);
      doc.text("Bon pour Mandat (Signature) :", 120, cursorY + 60);
    }
    else if (docName === 'Devis Prestation') {
       doc.autoTable({
        startY: cursorY,
        head: [['Désignation', 'Qté', 'Prix Unitaire', 'Total']],
        body: [
          ['Frais de dossier / Onboarding', '1', '150 €', '150 €'],
          ['Accompagnement Mensuel', '1', '500 €', '500 €'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 98, 255] }
      });
      doc.text("TOTAL HT : 650 €", 140, doc.lastAutoTable.finalY + 20);
    }
    else {
      doc.text("Document généré automatiquement pour le suivi du dossier.", 15, cursorY);
      doc.text(`Date : ${today}`, 15, cursorY + 10);
    }

    // -- FOOTER --
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Généré par LeadQualif IA - CRM Intelligent", 105, pageHeight - 10, { align: 'center' });

    doc.save(`${docName}_${lead.nom}.pdf`);

    // -- SAUVEGARDE HISTORIQUE --
    try {
      await supabase.from('documents').insert([{
        lead_id: lead.id,
        agency_id: agencyId,
        type: docName,
        status: 'Généré',
        created_at: new Date()
      }]);
      fetchDocuments();
    } catch (err) { 
      console.error(err); 
    }
    setLoading(false);
  };

  return (
    <div>
      {/* ONGLETS DE SÉLECTION PAR MÉTIER */}
      <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('IMMO')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'IMMO' 
              ? 'bg-white text-blue-600 shadow-md border border-blue-100' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          IMMOBILIER
        </button>
        <button
          onClick={() => setActiveTab('SMMA')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'SMMA' 
              ? 'bg-white text-blue-600 shadow-md border border-blue-100' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          MARKETING DIGITAL
        </button>
      </div>

      {/* GRILLE DOCUMENTS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {templates[activeTab].map((tpl) => (
          <button
            key={tpl.name}
            onClick={() => generatePDF(tpl.name)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition group bg-slate-50/30"
          >
            <span className="text-2xl mb-2 group-hover:scale-110 transition">{tpl.icon}</span>
            <span className="text-xs font-bold text-slate-700 text-center">{tpl.name}</span>
          </button>
        ))}
      </div>

      {/* HISTORIQUE */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
          HISTORIQUE DU DOSSIER
        </h4>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {documents.length > 0 ? documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center text-xs font-bold">PDF</div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{doc.type}</p>
                  <p className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString()} • {new Date(doc.created_at).toLocaleTimeString().slice(0,5)}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100">
                {doc.status}
              </span>
            </div>
          )) : (
            <div className="text-center py-4 text-slate-400 text-xs italic">Aucun document généré pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
}
