import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leadsService } from '../lib/supabase'
// Import des icônes
import { 
  LayoutDashboard, TrendingUp, Clock, Users, Zap, CheckCircle, 
  Search, RefreshCw, FileText, X, Phone, MessageCircle, Calendar 
} from 'lucide-react'

const API_BACKEND_URL = '[COLLEZ VOTRE URL RENDER ICI]/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState(null) // Pour la Modale

  // États pour le Générateur d'Annonces
  const [annonceForm, setAnnonceForm] = useState({ adresse: '', pieces_surface: '', description: '', dpe: '', prix: '' })
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [tempsEconomise, setTempsEconomise] = useState(5)

  // 1. CHARGEMENT DES DONNÉES
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const result = await leadsService.getAllLeads()
        if (result.success) {
          setLeads(result.data.map(l => ({
            ...l, 
            score: l.score_qualification || 0,
            nom: l.nom || 'Prospect Inconnu',
            type_bien: l.type_bien_recherche || 'Non précisé',
            telephone: l.telephone || '',
            budget: l.budget_estime ? parseInt(l.budget_estime) : 0
          })))
        } else {
          console.error('Erreur de chargement des leads:', result.error)
        }
      } catch (e) { 
        console.error('Erreur:', e) 
      } finally { 
        setLoading(false) 
      }
    }
    fetchLeads()
  }, [])

  // 2. FONCTIONS UTILES (WhatsApp & Tel)
  
  // Nettoie le numéro pour les liens (enlève les espaces, ajoute l'indicatif si besoin)
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Garde uniquement les chiffres
    // Astuce : Si le numéro commence par 06/07 sans indicatif (France), on peut ajouter 33
    // Pour le Bénin, si ça commence par 01, on laisse tel quel ou on ajoute 229 si manquant
    return cleaned; 
  }

  // Génère le lien WhatsApp avec message pré-rempli
  const getWhatsAppLink = (lead) => {
    const phone = cleanPhoneNumber(lead.telephone);
    if (!phone) return '#';
    const message = `Bonjour ${lead.nom}, suite à votre demande concernant un bien à ${lead.localisation_souhaitee || lead.adresse}...`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  const leadsChaudsCount = leads.filter(l => l.score >= 8).length
  const leadsTries = [...leads].sort((a, b) => b.score - a.score)

  // Générateur d'Annonces avec OpenAI
  const handleAnnonce = async (e) => {
    e.preventDefault()
    
    // Afficher l'état de chargement
    setAnnonceGeneree("🤖 Génération en cours...")
    
    try {
      console.log('🔗 URL du backend:', API_BACKEND_URL)
      console.log('📤 Données envoyées:', {
        type: annonceForm.pieces_surface ? 'appartement' : 'maison',
        adresse: annonceForm.adresse,
        prix: annonceForm.prix,
        surface: annonceForm.pieces_surface,
        pieces: annonceForm.pieces_surface
      })
      
      const response = await fetch(`${API_BACKEND_URL}/generate-annonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: annonceForm.pieces_surface ? 'appartement' : 'maison',
          adresse: annonceForm.adresse,
          prix: annonceForm.prix,
          surface: annonceForm.pieces_surface,
          pieces: annonceForm.pieces_surface
        })
      })

      console.log('📥 Status de la réponse:', response.status)
      console.log('📥 Headers de la réponse:', response.headers)

      const data = await response.json()
      console.log('📥 Données reçues:', data)

      if (data.success) {
        setAnnonceGeneree(data.annonce)
        setTempsEconomise(t => t + 1)
      } else {
        setAnnonceGeneree(`❌ Erreur: ${data.error || 'Impossible de générer l\'annonce'}`)
      }
    } catch (error) {
      console.error('❌ Erreur complète lors de la génération de l\'annonce:', error)
      console.error('❌ Stack trace:', error.stack)
      setAnnonceGeneree(`❌ Erreur de connexion: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
      
      {/* --- MODALE DÉTAIL LEAD (POP-UP ACTIVE) --- */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            
            {/* En-tête Modale */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/> Fiche Prospect
              </h3>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
                <X size={20} />
              </button>
            </div>

            {/* Contenu Modale */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Colonne Gauche : Qui ? */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Identité</p>
                <p className="text-2xl font-bold text-slate-900 mb-1">{selectedLead.nom}</p>
                <p className="text-slate-500 text-sm mb-4">Ajouté le : {new Date().toLocaleDateString()}</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg">
                    <MessageCircle size={18} className="text-blue-500"/>
                    <span className="text-sm font-medium">{selectedLead.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg">
                    <Phone size={18} className="text-green-500"/>
                    <span className="text-sm font-medium">{selectedLead.telephone || 'Non renseigné'}</span>
                  </div>
                </div>
              </div>

              {/* Colonne Droite : Quoi ? */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Le Projet</p>
                
                <div className="mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedLead.score >= 8 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    Score IA : {selectedLead.score}/10
                  </span>
                </div>

                <ul className="space-y-3">
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 text-sm">Budget</span>
                    <span className="font-bold text-slate-900">{selectedLead.budget ? selectedLead.budget.toLocaleString() + ' €' : '-'}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 text-sm">Recherche</span>
                    <span className="font-bold text-slate-900 text-right text-sm">{selectedLead.type_bien}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer : ACTIONS (C'est ici que la magie opère) */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              
              {/* Bouton Téléphone */}
              {selectedLead.telephone && (
                <a href={`tel:${selectedLead.telephone}`} 
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm transition text-sm font-bold">
                  <Phone size={16}/> Appeler
                </a>
              )}

              {/* Bouton WhatsApp (Actif) */}
              {selectedLead.telephone && (
                <a href={getWhatsAppLink(selectedLead)} 
                   target="_blank" 
                   rel="noreferrer"
                   className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-md transition text-sm font-bold">
                  <MessageCircle size={16}/> WhatsApp
                </a>
              )}

              {/* Bouton RDV (Calendly - Placeholder) */}
              <a href="https://calendly.com/" target="_blank" rel="noreferrer" 
                 className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition text-sm font-bold shadow-lg shadow-slate-200">
                <Calendar size={16}/> Prendre RDV
              </a>

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
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold ml-2 flex gap-1 items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> PRO
            </span>
          </div>
          <a href="/formulaire.html" target="_blank" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition">
            <FileText size={18} /> Ouvrir Formulaire
          </a>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-slate-500 font-medium">Prospects Qualifiés</p>
              <h3 className="text-4xl font-bold text-slate-800">{loading ? '-' : leadsChaudsCount}</h3>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={28} /></div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-slate-500 font-medium">Temps Gagné (IA)</p>
              <h3 className="text-4xl font-bold text-emerald-600">{tempsEconomise}h</h3>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Clock size={28} /></div>
          </div>
          
          <div className="bg-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center items-center text-center">
            <p className="text-slate-400 text-sm mb-1">État du système</p>
            <p className="font-bold text-green-400 flex items-center gap-2"><CheckCircle size={16}/> 100% Opérationnel</p>
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
                  <tr>
                    <th className="p-4">Prospect</th>
                    <th className="p-4">Budget</th>
                    <th className="p-4">Potentiel</th>
                    <th className="p-4 text-right">Action Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsTries.map(lead => {
                    const isHot = lead.score >= 8;
                    return (
                      <tr key={lead.id} className={`transition-colors ${isHot ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{lead.nom}</div>
                          <div className="text-slate-400 text-xs">{lead.email}</div>
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                          {lead.budget > 0 ? lead.budget.toLocaleString() + ' €' : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                            isHot ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isHot && <Zap size={12} fill="currentColor"/>} {lead.score}/10
                          </span>
                        </td>
                   {/* ... début de la ligne tr ... */}

<td className="p-4 text-right flex items-center justify-end gap-2">
  
  {/* 1. Bouton WhatsApp Direct (Petit et Vert) */}
  {lead.telephone && (
    <a 
      href={`https://wa.me/${lead.telephone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${lead.nom}, suite à votre demande sur LeadQualif...`)}`}
      target="_blank"
      rel="noreferrer"
      className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition"
      title="Ouvrir WhatsApp"
    >
      <MessageCircle size={18} />
    </a>
  )}

  {/* 2. Bouton Appel (Petit et Bleu) */}
  {lead.telephone && (
    <a 
      href={`tel:${lead.telephone}`}
      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-500 hover:text-white transition"
      title="Appeler"
    >
      <Phone size={18} />
    </a>
  )}

  {/* 3. Bouton Détail (Fiche complète) */}
  <button 
    onClick={() => setSelectedLead(lead)} 
    className="flex items-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition text-xs font-bold shadow-sm"
  >
    <Search size={14}/> Voir
  </button>

</td>

{/* ... fin de la ligne tr ... */}
                      </tr>
                    )
                  })}
                  {leads.length === 0 && !loading && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Aucun lead détecté</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* GÉNÉRATEUR ANNONCE */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-24">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="text-yellow-500" fill="currentColor"/> Rédacteur IA</h2>
            <form onSubmit={handleAnnonce} className="space-y-3">
              <input className="w-full p-3 bg-slate-50 rounded-xl text-sm border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                placeholder="Adresse du bien" value={annonceForm.adresse} onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})} required/>
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prix" value={annonceForm.prix} onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})} />
                <input className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Surface" value={annonceForm.pieces_surface} onChange={e => setAnnonceForm({...annonceForm, pieces_surface: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg shadow-slate-200 flex justify-center items-center gap-2">
                <FileText size={16}/> Générer Annonce
              </button>
            </form>
            {annonceGeneree && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-slate-700 whitespace-pre-line border border-blue-100 animate-fade-in">
                {annonceGeneree}
                <button onClick={() => navigator.clipboard.writeText(annonceGeneree)} className="mt-2 text-blue-600 font-bold text-xs hover:underline">Copier le texte</button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}