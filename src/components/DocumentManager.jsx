import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentManager({ lead, agencyId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);

  // 1. Charger le profil Agence (pour le Logo/Branding)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!agencyId) return;
      const { data } = await supabase.from('profiles').select('*').eq('agency_id', agencyId).single();
      setAgencyProfile(data);
    };
    fetchProfile();
    fetchDocuments();
  }, [agencyId, lead.id]);

  // 2. Charger l'historique des documents du lead
  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  // 3. Moteur de Génération PDF
  const generatePDF = async (type) => {
    setLoading(true);
    const doc = new jsPDF();

    // --- HEADER (Branding Agence) ---
    // Couleur principale (Bleu Pro par défaut)
    const primaryColor = [41, 98, 255]; 
    
    // Logo (Si url existe, sinon texte)
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text(agencyProfile?.agency_name || "AGENCE PARTENAIRE", 15, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Email: ${agencyProfile?.email || 'contact@agence.com'}`, 15, 28);
    doc.text(`Tél: ${agencyProfile?.phone || '01 23 45 67 89'}`, 15, 36);

    // Trait de séparation
    doc.setDrawColor(200);
    doc.line(15, 42, 195, 42);

    // --- CONTENU DU DOCUMENT (Selon le Type) ---
    doc.setTextColor(0);
    doc.setFontSize(18);
    doc.text(type.toUpperCase(), 105, 55, { align: 'center' });
    
    let bodyData = [];
    if (type === 'Bon de Visite') {
      doc.setFontSize(12);
      doc.text(`Je soussigné(e), ${lead.nom}, reconnais avoir visité ce jour :`, 15, 70);
      doc.text(`Type de bien : ${lead.type_bien || 'Non spécifié'}`, 15, 80);
      doc.text(`Budget annoncé : ${lead.budget} €`, 15, 90);
      doc.text("Conditions : En cas d'achat, je m'engage à passer par l'intermédiaire de l'agence.", 15, 110);
      doc.text("Signature du Client :", 120, 150);
      doc.text("Signature de l'Agence :", 20, 150);
    } 
    else if (type === 'Mandat de Vente') {
      doc.setFontSize(11);
      const text = `Entre l'agence ${agencyProfile?.agency_name || '...'} et le client ${lead.nom}.\n\nObjet : Le mandant charge le mandataire de vendre le bien désigné ci-après.\n\nType : ${lead.type_bien}\nSurface : ${lead.surface || '?'} m2\nPrix net vendeur souhaité : ${lead.budget} €\n\nDurée : Ce mandat est consenti pour une durée irrévocable de 3 mois.`;
      doc.text(text, 15, 70, { maxWidth: 180 });
      
      doc.text("Lu et approuvé (Bon pour mandat)", 120, 160);
    }
    else if (type === 'Offre d\'Achat') {
      doc.text(`Je soussigné(e) ${lead.nom}`, 15, 70);
      doc.text(`Fais une offre d'achat ferme et irrévocable au prix de : ${lead.budget} €`, 15, 80);
      doc.text("Validité de l'offre : 7 jours.", 15, 100);
    }
    else {
      // Document générique / Facture simple
      doc.text(`Client : ${lead.nom}`, 15, 70);
      doc.text(`Date : ${new Date().toLocaleDateString()}`, 15, 80);
      doc.text("Prestation de services.", 15, 100);
    }

    // --- FOOTER (Légal) ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Document généré automatiquement le ${new Date().toLocaleDateString()} par LeadQualif IA.`, 105, pageHeight - 10, { align: 'center' });

    // --- SAUVEGARDE & TÉLÉCHARGEMENT ---
    doc.save(`${type}_${lead.nom}.pdf`);

    // 4. Enregistrer dans l'historique Supabase
    try {
      await supabase.from('documents').insert([{
        lead_id: lead.id,
        agency_id: agencyId,
        type: type,
        status: 'Généré',
        created_at: new Date()
      }]);
      fetchDocuments(); // Rafraîchir la liste
    } catch (err) {
      console.error("Erreur historique:", err);
    }
    setLoading(false);
  };

  // 4. Actions sur les documents
  const updateDocumentStatus = async (docId, newStatus) => {
    try {
      await supabase.from('documents').update({ 
        status: newStatus,
        updated_at: new Date()
      }).eq('id', docId)
      
      // Mettre à jour la liste locale
      setDocuments(prev => prev.map(doc => 
        doc.id === docId ? { ...doc, status: newStatus } : doc
      ))
      
      // Afficher une notification
      showNotification(`Document marqué comme ${newStatus}`)
    } catch (error) {
      console.error('Erreur mise à jour statut:', error)
    }
  }

  const deleteDocument = async (docId) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await supabase.from('documents').delete().eq('id', docId)
        setDocuments(prev => prev.filter(doc => doc.id !== docId))
        showNotification('Document supprimé')
      } catch (error) {
        console.error('Erreur suppression document:', error)
      }
    }
  }

  const showNotification = (message) => {
    // Créer une notification toast simple
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse'
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  return (
    <div>
      {/* BOUTONS D'ACTION */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => generatePDF('Bon de Visite')} disabled={loading} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-2 transition">
          📄 Bon de Visite
        </button>
        <button onClick={() => generatePDF('Mandat de Vente')} disabled={loading} className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 flex items-center gap-2 transition">
          ⚖️ Mandat
        </button>
        <button onClick={() => generatePDF('Offre d\'Achat')} disabled={loading} className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-2 transition">
          💰 Offre
        </button>
      </div>

      {/* TIMELINE HISTORIQUE */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all relative">
            {/* Icône document */}
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">
              {getDocumentIcon(doc.type)}
            </div>
            
            {/* Contenu principal */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-slate-800">{getDocumentTitle(doc.type)}</h4>
                  <p className="text-xs text-slate-500">
                    Créé le {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getDocumentStatusColor(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
              
              {/* Actions principales */}
              <div className="flex gap-2 mt-3">
                {doc.file_url ? (
                  <a 
                    href={doc.file_url} 
                    target="_blank"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    📥 Télécharger
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs">En cours de génération...</span>
                )}
                
                {/* Bouton de régénération */}
                <button 
                  onClick={() => generatePDF(doc.type)}
                  className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
                >
                  🔄 Régénérer
                </button>
              </div>
            </div>
            
            {/* Menu d'actions (3 points) */}
            <div className="absolute top-2 right-2">
              <div className="relative group">
                <button className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 rounded hover:bg-gray-100">
                  ⋮
                </button>
                
                {/* Menu déroulant */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <div className="py-1">
                    <button
                      onClick={() => updateDocumentStatus(doc.id, 'Envoyé')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors"
                    >
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Marquer comme Envoyé
                    </button>
                    
                    <button
                      onClick={() => updateDocumentStatus(doc.id, 'Signé')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 flex items-center gap-2 transition-colors"
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Marquer comme Signé
                    </button>
                    
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors"
                    >
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {documents.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm">Aucun document généré pour ce lead</p>
            <p className="text-xs mt-1">Commencez par générer un mandat ou un devis</p>
          </div>
        )}
      </div>
    </div>
  );
}
