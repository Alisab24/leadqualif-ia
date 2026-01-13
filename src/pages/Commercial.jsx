import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ProfileManager from '../services/profileManager'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable' // Import crucial pour les tableaux

export default function Commercial() {
  const [agencyProfile, setAgencyProfile] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  
  // États pour la génération
  const [selectedDocType, setSelectedDocType] = useState(null) // 'Mandat', 'Facture', etc.
  const [targetType, setTargetType] = useState('lead') // 'lead' ou 'libre'
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [documentCounter, setDocumentCounter] = useState(1) // Compteur pour numérotation
  
  // Champs libres
  const [freeName, setFreeName] = useState('')
  const [freeAddress, setFreeAddress] = useState('')
  
  // Champs dynamiques (Prix, etc.)
  const [docValue, setDocValue] = useState('') // Sert pour Prix ou Honoraires

  useEffect(() => {
    getInitialData()
  }, [])

  async function getInitialData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 1. Récupérer le profil agence
        const profile = await fetchAgencyProfile();
        setAgencyProfile(profile)

        // 2. Récupérer les leads pour la liste
        const agencyId = ProfileManager.getSafeAgencyId(profile);
        if (agencyId && agencyId !== 'default') {
          const { data: leadsData } = await supabase
            .from('leads')
            .select('id, nom, email, telephone, adresse')
            .eq('agency_id', agencyId)
          setLeads(leadsData || [])
        }
      }
    } catch (error) {
      console.error("Erreur chargement:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgencyProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // PROTECTION ROBUSTE: Utiliser ProfileManager
      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: true,  // Créer automatiquement si non trouvé
        useFallback: true,      // Utiliser fallback si échec
        required: ['agency_id'], // agency_id est obligatoire
        verbose: true
      });

      if (!profileResult.success) {
        console.error(' Impossible de récupérer le profil:', profileResult.error);
        return null;
      }

      const profile = profileResult.profile;
      console.log(' Profil chargé:', {
        action: profileResult.action,
        agencyId: ProfileManager.getSafeAgencyId(profile),
        isFallback: ProfileManager.isFallbackProfile(profile)
      });

      return profile;
    } catch (error) {
      console.error(' Erreur chargement profil:', error);
      return null;
    }
  };

  // Utilitaire pour charger le logo sans erreur CORS
  const getBase64ImageFromUrl = async (imageUrl) => {
    if (!imageUrl) return null;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Impossible de charger le logo :", e);
      return null;
    }
  };

  const handleGeneratePDF = async () => {
    if (!agencyProfile) {
      alert("Veuillez d'abord configurer vos paramètres d'agence.");
      return;
    }

    // 1. Identifier le client
    let clientName = '';
    let clientAddress = '';
    
    if (targetType === 'lead') {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (!lead) { alert("Veuillez sélectionner un client."); return; }
      clientName = lead.nom;
      clientAddress = lead.adresse || lead.email; // Fallback
    } else {
      if (!freeName) { alert("Veuillez saisir un nom."); return; }
      clientName = freeName;
      clientAddress = freeAddress;
    }

    try {
      // 2. Initialiser le PDF
      const doc = new jsPDF();
      const primaryColor = agencyProfile.couleur_primaire || '#000000';
      const secondaryColor = agencyProfile.couleur_secondaire || '#666666';
      const currency = agencyProfile.devise || '€';

      // --- EN-TÊTE (HEADER) ---
      // Barre de couleur
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, 210, 40, 'F');

      // Logo (si dispo)
      const logoBase64 = await getBase64ImageFromUrl(agencyProfile.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 10, 5, 30, 30);
      }

      // Nom Agence (Texte Blanc dans la barre)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(agencyProfile.nom_agence || 'MON AGENCE', 50, 20);

      // Coordonnées (Sous le nom)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const coordText = `${agencyProfile.adresse_agence || ''}\nTél: ${agencyProfile.telephone_agence || ''} - ${agencyProfile.email_agence || ''}`;
      doc.text(coordText, 50, 28);

      // --- INFO CLIENT ---
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(secondaryColor);
      doc.roundedRect(120, 50, 80, 25, 3, 3);
      
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor);
      doc.text("CLIENT / DESTINATAIRE :", 125, 55);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(clientName, 125, 62);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(clientAddress || '', 125, 68);

      // --- NUMÉRO DU DOCUMENT ---
      const currentYear = new Date().getFullYear();
      const documentNumber = `FAC-${currentYear}-${String(documentCounter).padStart(3, '0')}`;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`N° ${documentNumber}`, 10, 85);

      // --- TITRE DU DOCUMENT ---
      doc.setFontSize(18);
      doc.setTextColor(primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text(selectedDocType.toUpperCase(), 10, 100);
      doc.line(10, 102, 100, 102); // Petit trait souligné

      let finalY = 110; // Position verticale curseur

      // --- CORPS DU DOCUMENT (Switch Table vs Texte) ---
      
      if (selectedDocType === 'Facture' || selectedDocType === 'Devis') {
        // MODE TABLEAU
        const prixUnitaire = parseFloat(docValue) || 0;
        const tvaRate = 0.18; // Exemple 18% (A configurer plus tard)
        const montantHT = prixUnitaire;
        const montantTVA = montantHT * tvaRate;
        const montantTTC = montantHT + montantTVA;

        autoTable(doc, {
          startY: 100,
          head: [['Désignation', 'Qté', 'Prix Unit.', 'Total HT']],
          body: [
            ['Honoraires / Prestations', '1', `${prixUnitaire.toLocaleString()} ${currency}`, `${montantHT.toLocaleString()} ${currency}`],
          ],
          headStyles: { fillColor: primaryColor },
          theme: 'grid',
        });

        finalY = doc.lastAutoTable.finalY + 10;

        // Bloc Total
        doc.setFontSize(10);
        doc.text(`Total HT : ${montantHT.toLocaleString()} ${currency}`, 150, finalY, { align: 'right' });
        doc.text(`TVA (18%) : ${montantTVA.toLocaleString()} ${currency}`, 150, finalY + 6, { align: 'right' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor);
        doc.text(`NET À PAYER : ${montantTTC.toLocaleString()} ${currency}`, 150, finalY + 14, { align: 'right' });

        // IBAN
        doc.setFontSize(10);
        doc.setTextColor(0,0,0);
        doc.setFont('helvetica', 'normal');
        doc.text("Mode de règlement : Virement Bancaire", 10, finalY + 30);

      } else {
        // MODE TEXTE (Mandat, Bon de visite)
        const textBody = `
        Nous soussignés, ${agencyProfile.nom_agence}, représentés par ${agencyProfile.signataire || 'Le Gérant'},
        
        Reconnaissons par la présente avoir établi ce document pour M/Mme ${clientName}.
        
        OBJET : ${selectedDocType} concernant le bien situé à [ADRESSE DU BIEN].
        VALEUR ESTIMÉE / PRIX : ${docValue} ${currency}.
        
        Ce document est établi pour servir et valoir ce que de droit.
        Fait à ${agencyProfile.pays || 'l\'Agence'}, le ${new Date().toLocaleDateString()}.
        `;
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(textBody, 10, 100);
        finalY = 180;
      }

      // --- FOOTER (Pied de page) ---
      const pageHeight = doc.internal.pageSize.height;
      doc.setDrawColor(primaryColor);
      doc.line(10, pageHeight - 15, 200, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const footerText = `${agencyProfile.nom_agence} - ${agencyProfile.identifiant_fiscal ? 'IFU: ' + agencyProfile.identifiant_fiscal : ''} - ${agencyProfile.site_web || ''}`;
      doc.text(footerText, 105, pageHeight - 10, { align: 'center' });

      // --- FOOTER ---
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Document généré par LeadQualif IA - Le cockpit de l\'immobilier moderne', 105, 285, { align: 'center' });

      // --- HISTORIQUE : Ajouter dans la timeline du lead ---
      if (targetType === 'lead' && selectedLeadId) {
        try {
          await supabase.from('activities').insert([{
            lead_id: selectedLeadId,
            type: 'document',
            description: `📄 ${selectedDocType} généré le ${new Date().toLocaleDateString('fr-FR')}`,
            created_at: new Date().toISOString()
          }]);
          console.log('✅ Activité document enregistrée dans la timeline');
        } catch (err) {
          console.error('Erreur enregistrement activité:', err);
        }
      }

      // Incrémenter le compteur de documents
      setDocumentCounter(prev => prev + 1);

      // --- TÉLÉCHARGEMENT ---
      doc.save(`${selectedDocType}_${clientName.replace(/\s+/g, '_')}.pdf`);
      alert('Document téléchargé avec succès !');

    } catch (err) {
      alert("Erreur lors de la génération : " + err.message);
      console.error(err);
    }
  }

  if (loading) return <div className="p-10 text-center">Chargement des données...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Espace Documents</h1>
            <p className="text-gray-500">Générez vos Mandats, Factures et Devis en un clic.</p>
          </div>
          <Link to="/app" className="bg-slate-200 px-4 py-2 rounded hover:bg-slate-300">
            ← Retour Dashboard
          </Link>
        </header>

        {/* --- ZONE DE CONFIGURATION --- */}
        <div className="bg-white p-6 rounded-lg shadow mb-8 border border-slate-200">
          <h2 className="text-lg font-bold mb-4 text-slate-700">1. Configuration du Document</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Choix du Destinataire */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Destinataire</label>
              <div className="flex gap-4 mb-4">
                <button 
                  onClick={() => setTargetType('lead')}
                  className={`px-4 py-2 rounded ${targetType === 'lead' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                >
                  Client Internet (Lead)
                </button>
                <button 
                  onClick={() => setTargetType('libre')}
                  className={`px-4 py-2 rounded ${targetType === 'libre' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                >
                  Saisie Libre (Autre)
                </button>
              </div>

              {targetType === 'lead' ? (
                <select 
                  className="w-full p-2 border rounded"
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  value={selectedLeadId}
                >
                  <option value="">-- Choisir un client --</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.nom} ({lead.email})</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input 
                    type="text" placeholder="Nom complet du client" 
                    className="w-full p-2 border rounded"
                    value={freeName} onChange={e => setFreeName(e.target.value)}
                  />
                  <input 
                    type="text" placeholder="Adresse / Ville" 
                    className="w-full p-2 border rounded"
                    value={freeAddress} onChange={e => setFreeAddress(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Valeurs Variables */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Détails financiers</label>
              <input 
                type="number" 
                placeholder="Montant (Prix vente ou Honoraires)" 
                className="w-full p-2 border rounded mb-2"
                value={docValue} onChange={e => setDocValue(e.target.value)}
              />
              <p className="text-xs text-gray-500">Saisissez le montant HT. La TVA sera calculée automatiquement pour les factures.</p>
            </div>
          </div>
        </div>

        {/* --- GRILLE DES DOCUMENTS --- */}
        <h2 className="text-lg font-bold mb-4 text-slate-700">2. Choisir le document à générer</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { type: 'Mandat', icon: '📜', color: 'bg-orange-50 border-orange-200 text-orange-700' },
            { type: 'Bon de Visite', icon: '👁️', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { type: 'Devis', icon: '📑', color: 'bg-purple-50 border-purple-200 text-purple-700' },
            { type: 'Facture', icon: '💶', color: 'bg-green-50 border-green-200 text-green-700' },
          ].map((doc) => (
            <button
              key={doc.type}
              onClick={() => { setSelectedDocType(doc.type); setTimeout(handleGeneratePDF, 100); }}
              className={`p-6 rounded-xl border-2 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 ${doc.color}`}
            >
              <span className="text-4xl">{doc.icon}</span>
              <span className="font-bold">{doc.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
