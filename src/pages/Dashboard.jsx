import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
// On retire leadsService car on utilise ton Backend Python sur Render
// import { leadsService } from '../lib/supabase' 

// Import des icônes
import { 
  LayoutDashboard, TrendingUp, Clock, Users, Zap, CheckCircle, 
  Search, RefreshCw, FileText, X, Phone, MessageCircle, Calendar, Home, Mail, Building2, FileCheck
} from 'lucide-react'

// ⚠️ IMPORTANT : Colle ton URL Render ici (sans le slash à la fin)
// Exemple : 'https://leadqualif-backend.onrender.com/api'
const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState(null) // Pour la Modale

  // États pour le Générateur d'Annonces
  const [annonceForm, setAnnonceForm] = useState({ 
    type: 'Appartement', 
    adresse: '', 
    surface: '', 
    pieces: '', 
    prix: '' 
  })
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [tempsEconomise, setTempsEconomise] = useState(() => parseInt(localStorage.getItem('timeSaved')) || 0)
  const [newNote, setNewNote] = useState('')

  // 1. CHARGEMENT DES DONNÉES (Via ton Backend Python)
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        console.log("Chargement des leads depuis:", `${API_BACKEND_URL}/leads-chauds`)
        const res = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        const data = await res.json()
        
        if (data.status === 'success' && data.data.leads_chauds) {
          const leadsData = data.data.leads_chauds.map(l => ({
            ...l, 
            score: l.score_ia || 0,
            nom: l.nom || 'Prospect Inconnu',
            type_bien: l.type_bien || 'Non précisé',
            telephone: l.telephone || '',
            statut_crm: l.statut_crm || 'À traiter',
            interactions: l.interactions || []
          }))
          setLeads(leadsData)
          
          // Mise à jour automatique du temps économisé
          const nouveauTemps = (leadsData.length * 0.5) // 0.5h par lead
          setTempsEconomise(ancienTemps => {
            const tempsFinal = Math.max(ancienTemps, nouveauTemps)
            localStorage.setItem('timeSaved', tempsFinal.toString())
            return tempsFinal
          })
        }
      } catch (e) { 
        console.error("Erreur de connexion backend:", e) 
      } finally { 
        setLoading(false) 
      }
    }
    fetchLeads()
  }, [])

  // 2. FONCTIONS UTILES
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    
    // Gestion des numéros français
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      // 06 12 34 56 78 -> 33612345678
      return '33' + cleaned.substring(1);
    } else if (cleaned.startsWith('33') && cleaned.length === 11) {
      // Déjà au format international
      return cleaned;
    } else if (cleaned.length === 9) {
      // 612345678 -> 33612345678
      return '33' + cleaned;
    }
    
    return cleaned;
  }

  const getWhatsAppLink = (lead) => {
    const phone = cleanPhoneNumber(lead.telephone);
    if (!phone) return '#';
    const message = `Bonjour ${lead.nom}, suite à votre demande concernant un bien...`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  // Fonction pour ajouter une interaction
  const addInteraction = async (leadId, typeAction, details = '') => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/leads/${leadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type_action: typeAction, details })
      })
      
      const data = await res.json()
      if (data.success) {
        // Mettre à jour le state local
        setLeads(leads.map(lead => 
          lead.id === leadId 
            ? { ...lead, interactions: [data.interaction, ...(lead.interactions || [])] }
            : lead
        ))
        console.log('Interaction ajoutée:', typeAction)
      }
    } catch (error) {
      console.error('Erreur ajout interaction:', error)
    }
  }

  // Fonction pour ajouter une note manuelle
  const handleAddNote = (leadId) => {
    if (newNote.trim()) {
      addInteraction(leadId, 'Note', newNote.trim())
      setNewNote('')
    }
  }

  // Fonction pour mettre à jour le statut CRM
  const updateStatutCRM = async (leadId, nouveauStatut) => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/leads/${leadId}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: nouveauStatut })
      })
      
      const data = await res.json()
      if (data.status === 'success') {
        // Mettre à jour le state local
        setLeads(leads.map(lead => 
          lead.id === leadId ? { ...lead, statut_crm: nouveauStatut } : lead
        ))
        console.log('Statut CRM mis à jour:', nouveauStatut)
        // Petite notification visuelle
        const notification = document.createElement('div')
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in'
        notification.textContent = 'Statut sauvegardé !'
        document.body.appendChild(notification)
        setTimeout(() => notification.remove(), 2000)
      }
    } catch (error) {
      console.error('Erreur mise à jour statut:', error)
    }
  }

  // Fonction pour générer une annonce
  const handleAnnonce = async (e) => {
    e.preventDefault()
    setIsGenerating(true)
    setAnnonceGeneree("🤖 L'IA rédige votre annonce...")

    try {
      const res = await fetch(`${API_BACKEND_URL}/generate-annonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annonceForm)
      })

      const data = await res.json()

      if (data.text) {
        setAnnonceGeneree(data.text)
        setTempsEconomise(ancienTemps => {
          const nouveauTemps = ancienTemps + 1 // +1 heure pour génération d'annonce
          localStorage.setItem('timeSaved', nouveauTemps.toString())
          return nouveauTemps
        })
      } else {
        setAnnonceGeneree("❌ Erreur IA : " + (data.error || "Réponse vide"))
      }
    } catch (error) {
      setAnnonceGeneree("❌ Erreur connexion : Vérifiez l'URL du backend.")
    } finally {
      setIsGenerating(false)
    }
  }

  // --- CALCULS DES STATISTIQUES (FIX) ---
  // 1. Trier les leads (Score le plus haut en premier)
  const leadsTries = [...leads].sort((a, b) => (b.score_ia || 0) - (a.score_ia || 0));
  // 2. Compter les leads chauds (Score >= 7)
  const leadsChaudsCount = leads.filter(l => (l.score_ia || 0) >= 7).length;
  // 3. Compter les nouveaux (ceux qui n'ont pas encore de statut CRM défini ou 'À traiter')
  const leadsNouveaux = leads.filter(l => !l.statut_crm || l.statut_crm === 'À traiter').length;
  // 4. Statistiques supplémentaires
  const leadsTotal = leads.length;
  const conversionRate = leadsTotal > 0 ? Math.round((leadsChaudsCount / leadsTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
      
      {/* --- MODALE DÉTAIL LEAD --- */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/> Fiche Prospect
              </h3>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"><X size={20} /></button>
            </div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Colonne gauche : Infos prospect */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Identité</p>
                <p className="text-2xl font-bold text-slate-900 mb-1">{selectedLead.nom}</p>
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg"><MessageCircle size={18} className="text-blue-500"/><span className="text-sm font-medium">{selectedLead.email}</span></div>
                  <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg"><Phone size={18} className="text-green-500"/><span className="text-sm font-medium">{selectedLead.telephone || 'Non renseigné'}</span></div>
                </div>
                
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 mt-6">Le Projet</p>
                <div className="mb-4"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedLead.score >= 8 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>Score IA : {selectedLead.score}/10</span></div>
                <ul className="space-y-3">
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500 text-sm">Budget</span><span className="font-bold text-slate-900">{selectedLead.budget ? selectedLead.budget.toLocaleString() + ' €' : '-'}</span></li>
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500 text-sm">Type</span><span className="font-bold text-slate-900 text-right text-sm">{selectedLead.type_bien}</span></li>
                </ul>
              </div>
              
              {/* Colonne droite : Historique */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-4">Historique d'Activités</p>
                
                {/* Liste des interactions */}
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {(selectedLead.interactions || []).length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">Aucune activité enregistrée</p>
                  ) : (
                    selectedLead.interactions.map(interaction => (
                      <div key={interaction.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-start">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            interaction.type_action === 'Appel' ? 'bg-green-100 text-green-700' :
                            interaction.type_action === 'Email' ? 'bg-blue-100 text-blue-700' :
                            interaction.type_action === 'WhatsApp' ? 'bg-purple-100 text-purple-700' :
                            interaction.type_action === 'Note' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {interaction.type_action}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(interaction.date).toLocaleDateString('fr-FR')} {new Date(interaction.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        {interaction.details && <p className="text-sm text-slate-600 mt-1">{interaction.details}</p>}
                      </div>
                    ))
                  )}
                </div>
                
                {/* Ajouter une note */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Ajouter une note</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Note manuelle..."
                      className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddNote(selectedLead.id)}
                    />
                    <button
                      onClick={() => handleAddNote(selectedLead.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              {selectedLead.telephone && (
                <>
                  <button 
                    onClick={() => {
                      addInteraction(selectedLead.id, 'Appel', 'Appel sortant')
                      window.location.href = `tel:${selectedLead.telephone}`
                    }} 
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-blue-600 font-bold text-sm"
                  >
                    <Phone size={16}/> Appeler
                  </button>
                  <a href={`mailto:${selectedLead.email}?subject=Votre projet immobilier - LeadQualif IA&body=Bonjour ${selectedLead.nom},`} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold text-sm"><Mail size={16}/> Email</a>
                  <button 
                    onClick={() => {
                      addInteraction(selectedLead.id, 'WhatsApp', 'Message WhatsApp envoyé')
                      window.open(getWhatsAppLink(selectedLead), '_blank')
                    }} 
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-sm"
                  >
                    <MessageCircle size={16}/> WhatsApp
                  </button>
                  <a href="https://calendly.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition text-sm font-bold shadow-lg shadow-slate-200"><Calendar size={16}/> Prendre RDV</a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><LayoutDashboard size={20} /></div>
            <h1 className="text-xl font-bold">LeadQualif <span className="text-blue-600">IA</span></h1>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold ml-2">PRO</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/commercial" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition"><Building2 size={18} /> Espace Pro</Link>
            <a href="/estimation" target="_blank" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition"><FileText size={18} /> Page d'Estimation</a>
            <button 
              onClick={() => navigator.clipboard.writeText(window.location.origin + '/estimation')} 
              className="flex items-center gap-2 text-slate-500 hover:text-green-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition"
              title="Copier le lien de la page d'estimation"
            >
              🔗 Lien Estimation
            </button>
          </div>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div><p className="text-slate-500 font-medium">Prospects Qualifiés</p><h3 className="text-4xl font-bold text-slate-800">{loading ? '-' : leadsChaudsCount}</h3></div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={28} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div><p className="text-slate-500 font-medium">Temps Gagné (IA)</p><h3 className="text-4xl font-bold text-emerald-600">{tempsEconomise}h</h3></div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Clock size={28} /></div>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center items-center text-center">
            <p className="text-slate-400 text-sm mb-1">État du système</p><p className="font-bold text-green-400 flex items-center gap-2"><CheckCircle size={16}/> 100% Connecté</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LISTE LEADS */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><Users className="text-blue-600"/> Pipeline des Ventes</h2>
              <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><RefreshCw size={18}/></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                  <tr><th className="p-4">Prospect</th><th className="p-4">Budget</th><th className="p-4">Potentiel</th><th className="p-4">Suivi Dossier</th><th className="p-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsTries.map(lead => {
                    const isHot = lead.score >= 8;
                    return (
                      <tr key={lead.id} className={`transition-colors ${isHot ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="p-4"><div className="font-bold text-slate-800">{lead.nom}</div><div className="text-slate-400 text-xs">{lead.email}</div></td>
                        <td className="p-4 font-medium text-slate-600">{lead.budget > 0 ? lead.budget.toLocaleString() + ' €' : '-'}</td>
                        <td className="p-4"><span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${isHot ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{isHot && <Zap size={12}/>} {lead.score}/10</span></td>
                        <td className="p-4">
                          <select 
                            value={lead.statut_crm || 'À traiter'}
                            onChange={(e) => updateStatutCRM(lead.id, e.target.value)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${
                              (lead.statut_crm || 'À traiter') === 'À traiter' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                              (lead.statut_crm || 'À traiter') === 'Contacté' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                              (lead.statut_crm || 'À traiter') === 'RDV Planifié' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                              (lead.statut_crm || 'À traiter') === 'Offre en cours' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                              (lead.statut_crm || 'À traiter') === 'Signé / Vendu' ? 'bg-green-100 text-green-700 border-green-300' :
                              'bg-red-100 text-red-700 border-red-300'
                            }`}
                          >
                            <option value="À traiter">À traiter</option>
                            <option value="Contacté">Contacté</option>
                            <option value="RDV Planifié">RDV Planifié</option>
                            <option value="Offre en cours">Offre en cours</option>
                            <option value="Signé / Vendu">Signé / Vendu</option>
                            <option value="Perdu / Abandon">Perdu / Abandon</option>
                          </select>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          <a href={`mailto:${lead.email}?subject=Votre projet immobilier - LeadQualif IA&body=Bonjour ${lead.nom},`} className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-bold shadow-sm"><Mail size={14}/> Email</a>
                          <button onClick={() => setSelectedLead(lead)} className="flex items-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition text-xs font-bold shadow-sm"><Search size={14}/> Voir</button>
                        </td>
                      </tr>
                    )
                  })}
                  {leads.length === 0 && !loading && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Aucun lead pour l'instant...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* GÉNÉRATEUR ANNONCE (CORRIGÉ POUR BACKEND) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-24">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="text-yellow-500" fill="currentColor"/> Rédacteur IA</h2>
            
            <form onSubmit={handleAnnonce} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Type de bien</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={annonceForm.type} 
                  onChange={e => setAnnonceForm({...annonceForm, type: e.target.value})}
                >
                  <option value="Appartement">Appartement</option>
                  <option value="Maison">Maison</option>
                  <option value="Villa">Villa</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Adresse/Quartier</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  placeholder="Ex: 75011 Paris"
                  value={annonceForm.adresse}
                  onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Prix (€)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    placeholder="Ex: 350000"
                    value={annonceForm.prix}
                    onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Surface (m²)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    placeholder="Ex: 120"
                    value={annonceForm.surface}
                    onChange={e => setAnnonceForm({...annonceForm, surface: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre de pièces</label>
                <input 
                  type="number"
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  placeholder="Ex: 3"
                  value={annonceForm.pieces}
                  onChange={e => setAnnonceForm({...annonceForm, pieces: e.target.value})}
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg shadow-slate-200 flex justify-center items-center gap-2 disabled:opacity-50"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText size={16}/> Générer l'annonce
                  </>
                )}
              </button>
            </form>
            
            {annonceGeneree && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-slate-700 whitespace-pre-line border border-blue-100 animate-fade-in">
                {annonceGeneree}
                <button 
                  onClick={() => navigator.clipboard.writeText(annonceGeneree)} 
                  className="mt-2 text-blue-600 font-bold text-xs hover:underline"
                >
                  📋 Copier le texte
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}