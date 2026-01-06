import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentManager({ lead, agencyId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('IMMO'); // 'IMMO' ou 'SMMA'

  // 1. Chargement Profil Agence & Historique
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

  // 2. Définition des Modèles (Templates)
  const templates = {
    IMMO: [
      { name: 'Bon de Visite', icon: '', type: 'juridique' },
      { name: 'Mandat de Vente', icon: '', type: 'juridique' },
      { name: 'Offre d\'Achat', icon: '', type: 'transaction' },
      { name: 'Fiche Client', icon: '', type: 'recap' },
      { name: 'Compte-rendu Visite', icon: '', type: 'suivi' }
    ],
    SMMA: [
      { name: 'Devis Prestation', icon: '', type: 'vente' },
      { name: 'Contrat Service', icon: '', type: 'juridique' },
      { name: 'Facture', icon: '', type: 'compta' },
      { name: 'Brief Client', icon: '', type: 'projet' }
    ]
  };

  // 3. Moteur de Génération PDF
  const generatePDF = async (docName) => {
    setLoading(true);
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    // --- HEADER BRANDING ---
    doc.setFontSize(20);
    doc.setTextColor(41, 98, 255); // Bleu Agence
    doc.text(agencyProfile?.agency_name?.toUpperCase() || "AGENCE PARTENAIRE", 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Email: ${agencyProfile?.email || 'contact@agence.com'}`, 15, 26);
    doc.text(`Tel: ${agencyProfile?.telephone || 'Non renseigné'}`, 15, 31);

    // Ligne séparatrice
    doc.setDrawColor(200);
    doc.line(15, 36, 195, 36);

    // --- TITRE DOCUMENT ---
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text(docName.toUpperCase(), 105, 50, { align: 'center' });

    // --- CORPS DU TEXTE (Logique conditionnelle) ---
    doc.setFontSize(11);
    let cursorY = 70;

    // Bloc Info Client
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 60, 180, 25, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("CLIENT / PROSPECT :", 20, 68);
    doc.setFont("helvetica", "normal");
    doc.text(`Nom : ${lead.nom}`, 20, 75);
    doc.text(`Email : ${lead.email}`, 100, 75);
    doc.text(`Tel : ${lead.telephone}`, 20, 82);
    doc.text(`Projet : ${lead.type_bien}`, 100, 82);
    cursorY = 100;

    // Contenu Spécifique
    if (docName === 'Bon de Visite') {
      doc.text("Je soussigné(e), reconnais avoir visité ce jour les biens présentés par l'agence.", 15, cursorY);
      cursorY += 10;
      doc.text(`Bien concerné : Projet ${lead.type_bien} - Budget ${lead.budget} €`, 15, cursorY);
      cursorY += 20;
      doc.text("En cas d'acquisition, je m'engage à ne traiter que par l'intermédiaire de l'agence.", 15, cursorY);
      cursorY += 30;
      doc.text("Signature du visiteur :", 130, cursorY);
      doc.text("Tampon de l'agence :", 20, cursorY);
    } 
    else if (docName === 'Mandat de Vente') {
      doc.text("ENTRE LES SOUSSIGNÉS :", 15, cursorY);
      cursorY += 10;
      doc.text("Le Mandant (Client) désigné ci-dessus, et Le Mandataire (L'Agence).", 15, cursorY);
      cursorY += 15;
      doc.text("IL A ÉTÉ CONVENU CE QUI SUIT :", 15, cursorY);
      cursorY += 10;
      doc.text("Le Mandant charge le Mandataire de vendre le bien désigné ci-après.", 15, cursorY);
      doc.text(`Désignation : ${lead.type_bien} d'environ ${lead.surface || '...'} m2.`, 15, cursorY + 6);
      doc.text(`Prix net vendeur : ${lead.budget} € (Honoraires agence en sus).`, 15, cursorY + 12);
      cursorY += 40;
      doc.text("Lu et approuvé, Bon pour Mandat.", 120, cursorY);
    }
    else if (docName === 'Devis Prestation' || docName === 'Facture') {
      doc.autoTable({
        startY: cursorY,
        head: [['Désignation', 'Qté', 'Prix Unitaire', 'Total']],
        body: [
          ['Accompagnement / Service', '1', '500 €', '500 €'],
          ['Frais de dossier', '1', '50 €', '50 €'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 98, 255] }
      });
      cursorY = doc.lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.text("TOTAL À PAYER : 550 €", 140, cursorY);
    }
    else {
      // Texte générique
      doc.text("Document généré automatiquement pour le suivi du dossier.", 15, cursorY);
      doc.text(`Date de génération : ${today}`, 15, cursorY + 10);
    }

    // --- FOOTER ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Ce document est généré par LeadQualif IA - Solution CRM Pro.", 105, pageHeight - 10, { align: 'center' });

    // Sauvegarde
    doc.save(`${docName}_${lead.nom.replace(' ', '_')}.pdf`);

    // Enregistrement BDD
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
      {/* Tabs de Sélection */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('IMMO')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition ${
            activeTab === 'IMMO' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🏠 IMMOBILIER
        </button>
        <button
          onClick={() => setActiveTab('SMMA')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition ${
            activeTab === 'SMMA' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🚀 MARKETING DIGITAL
        </button>
      </div>

      {/* Grille de Boutons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {templates[activeTab].map((tpl) => (
          <button
            key={tpl.name}
            onClick={() => generatePDF(tpl.name)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 hover:shadow-sm transition group"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition">{tpl.icon}</span>
            <span className="text-xs font-medium text-center text-gray-700">{tpl.name}</span>
          </button>
        ))}
      </div>

      {/* Historique Timeline */}
      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Historique des documents</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
        {documents.length > 0 ? documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-red-500">📄</span>
              <span className="font-medium text-gray-700">{doc.type}</span>
            </div>
            <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
          </div>
        )) : (
          <p className="text-xs text-gray-400 italic text-center py-2">Aucun document généré.</p>
        )}
      </div>
    </div>
  );
}
