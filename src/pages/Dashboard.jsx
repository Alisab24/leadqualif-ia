import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('kanban') // 'list' ou 'kanban'

  // Modale simplifiée pour éviter les erreurs de build
  const [selectedLead, setSelectedLead] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  // Configuration du Pipeline
  const STATUS_ORDER = ['À traiter', 'Message laissé', 'RDV Pris', 'Offre en cours', 'Vendu', 'Perdu']

  // Couleurs des étiquettes
  const STATUS_COLORS = {
    'À traiter': 'bg-red-100 text-red-800 border-red-200',
    'Message laissé': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'RDV Pris': 'bg-blue-100 text-blue-800 border-blue-200',
    'Offre en cours': 'bg-purple-100 text-purple-800 border-purple-200',
    'Vendu': 'bg-green-100 text-green-800 border-green-200',
    'Perdu': 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Fonction pour copier le lien
  const copyEstimationLink = async () => {
    const url = window.location.origin + '/estimation'
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('Lien copié !')
      setTimeout(() => setCopyMessage(''), 2000)
    } catch (err) {
      console.error('Erreur copie:', err)
      setCopyMessage('Erreur')
      setTimeout(() => setCopyMessage(''), 2000)
    }
  }

  // 1. WhatsApp (Nettoie le numéro et ouvre l'app avec message pré-rempli)
  const openWhatsApp = (e, lead) => {
    e.stopPropagation(); // Empêche d'ouvrir la modale
    if (!lead.telephone) return alert("Pas de numéro de téléphone renseigné.");
    
    // Tracking automatique avant l'action
    trackActivity(lead.id, 'whatsapp', 'Action rapide : WhatsApp ouvert');
    
    // Nettoyage basique du numéro (garde que les chiffres)
    const phone = lead.telephone.replace(/[^0-9]/g, '');
    const message = `Bonjour ${lead.nom}, je suis votre conseiller LeadQualif. J'ai bien reçu votre demande d'estimation. Avez-vous un moment pour échanger ?`;
    
    // Insertion dans activities (manuel pour le suivi)
    logActivity(lead.id, 'action', 'A contacté via WhatsApp');
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  // 2. Email (Ouvre le client mail avec Sujet et Corps pré-remplis)
  const openEmail = (e, lead) => {
    e.stopPropagation();
    if (!lead.email) return alert("Pas d'email renseigné.");

    // Tracking automatique avant l'action
    trackActivity(lead.id, 'email', 'Action rapide : Email ouvert');

    const subject = `Votre projet immobilier - Estimation ${lead.type_bien || ''}`;
    const body = `Bonjour ${lead.nom},\n\nJe fais suite à votre estimation sur notre site.\n\nQuand seriez-vous disponible pour en discuter ?\n\nCordialement,`;

    // Insertion dans activities (manuel pour le suivi)
    logActivity(lead.id, 'action', 'A contacté via Email');

    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // 3. RDV (Ouvre Google Agenda pour créer un événement pré-rempli)
  const openCalendar = (e, lead) => {
    e.stopPropagation();
    
    // Tracking automatique avant l'action
    trackActivity(lead.id, 'rdv', 'Action rapide : RDV planifié');

    const title = `RDV Client : ${lead.nom}`;
    const details = `Tel: ${lead.telephone}\nEmail: ${lead.email}\nBudget: ${lead.budget}€`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}`;

    // Insertion dans activities (manuel pour le suivi)
    logActivity(lead.id, 'action', 'A planifié un RDV');

    window.open(url, '_blank');
  }

  // 4. Appel téléphonique
  const openCall = (e, lead) => {
    e.stopPropagation();
    if (!lead.telephone) return alert("Pas de numéro de téléphone renseigné.");
    
    // Tracking automatique avant l'action
    trackActivity(lead.id, 'call', 'Action rapide : Appel téléphonique');
    
    // Insertion dans activities (manuel pour le suivi)
    logActivity(lead.id, 'action', 'A appelé le client');
    
    // Ouvre l'application téléphonique
    window.location.href = `tel:${lead.telephone}`;
  }

  // Fonction de tracking automatique (invisible)
  const trackActivity = async (leadId, actionType, description) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert([{
          lead_id: leadId,
          type: 'action_auto',
          action_type: actionType, // whatsapp, email, rdv, call
          description: description,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Erreur tracking activité:', error);
      } else {
        console.log('🔍 Tracking enregistré:', description);
      }
    } catch (err) {
      console.error('Erreur trackActivity:', err);
    }
  }

  // Fonction utilitaire pour logger les activités
  const logActivity = async (leadId, type, description) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert([{
          lead_id: leadId,
          type: type,
          description: description,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Erreur insertion activité:', error);
      } else {
        console.log('✅ Activité enregistrée:', description);
      }
    } catch (err) {
      console.error('Erreur logActivity:', err);
    }
  }

  // Fonction utilitaire pour calculer la commission potentielle
  const calculatePotential = (budget) => {
    if (!budget) return 0;
    
    if (budget < 100000) {
      return 5000; // Forfait 5k€ pour budgets < 100k€
    } else {
      return Math.round(budget * 0.05); // 5% du budget
    }
  }

  // Fonctions pour les Smart Badges
  const isPriority = (lead) => {
    return calculateScore(lead) >= 8;
  }

  const needsRelance = (lead) => {
    const now = new Date();
    const lastActivity = lead.lastActivity ? new Date(lead.lastActivity) : new Date(lead.created_at);
    const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
    return hoursSinceActivity > 48; // Plus de 48h sans activité
  }

  const getLeadStatus = (lead) => {
    const now = new Date();
    const lastActivity = lead.lastActivity ? new Date(lead.lastActivity) : new Date(lead.created_at);
    const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
    
    if (hoursSinceActivity < 24) return 'active';
    if (hoursSinceActivity > 168) return 'dormant'; // 7 jours = 168 heures
    return 'normal';
  }

  // Fonction pour obtenir l'icône et couleur selon le type d'activité
  const getActivityIcon = (activity) => {
    switch(activity.action_type || activity.type) {
      case 'whatsapp':
        return { icon: '💬', color: 'bg-green-600' };
      case 'email':
        return { icon: '📧', color: 'bg-blue-600' };
      case 'rdv':
        return { icon: '📅', color: 'bg-orange-600' };
      case 'call':
        return { icon: '📞', color: 'bg-purple-600' };
      case 'action':
        return { icon: '⚡', color: 'bg-indigo-600' };
      case 'statut':
        return { icon: '🔄', color: 'bg-blue-600' };
      case 'document':
        return { icon: '📄', color: 'bg-violet-600' };
      default:
        return { icon: '📋', color: 'bg-gray-600' };
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('agency_id').eq('user_id', user.id).single()
        if (profile?.agency_id) {
          // Récupérer les leads
          const { data: leadsData } = await supabase
            .from('leads')
            .select('*')
            .eq('agency_id', profile.agency_id)
            .order('created_at', { ascending: false })
          
          // Récupérer les activités récentes pour chaque lead
          const { data: activitiesData } = await supabase
            .from('activities')
            .select('*')
            .in('lead_id', leadsData?.map(l => l.id) || [])
            .order('created_at', { ascending: false })

          // Enrichir les leads avec les activités et détecter les leads froids
          const enrichedLeads = leadsData?.map(lead => {
            const leadActivities = activitiesData?.filter(a => a.lead_id === lead.id) || []
            const lastActivity = leadActivities[0] // La plus récente
            
            // Détecter si le lead est froid (pas d'activité depuis 3 jours)
            const threeDaysAgo = new Date()
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
            const isCold = lastActivity ? new Date(lastActivity.created_at) < threeDaysAgo : true
            
            // Ajouter le champ assigned_to (fictif pour l'instant)
            const assignedTo = lead.assigned_to || 'Non assigné'
            
            return {
              ...lead,
              activities: leadActivities,
              lastActivity: lastActivity?.created_at,
              isCold,
              assigned_to: assignedTo
            }
          }) || []

          setLeads(enrichedLeads)
        }
      }
    } catch (error) {
      console.error("Erreur chargement:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (leadId, newStatus) => {
    // Mise à jour immédiate (Optimistic UI)
    setLeads(leads.map(l => l.id === leadId ? { ...l, statut: newStatus } : l))

    // Sauvegarde en base
    await supabase.from('leads').update({ statut: newStatus }).eq('id', leadId)
    // Historique
    await supabase.from('activities').insert([{ 
      lead_id: leadId, 
      type: 'statut', 
      description: `Statut passé à ${newStatus}` 
    }])
  }

  const calculateScore = (lead) => {
    let score = 3
    if (lead.budget > 200000) score += 2
    if (lead.telephone) score += 3
    if (lead.email) score += 2
    return Math.min(score, 10)
  }

  const openModal = (lead) => {
    setSelectedLead(lead)
    setIsModalOpen(true)
  }

  if (loading) return "Chargement du Pipeline..."

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec toggle */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {viewMode === 'kanban' ? 'Pipeline des Ventes' : 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Vue Liste
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Vue Pipeline
              </button>
            </div>
            
            {/* Nouveau bloc d'actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                + Nouveau Lead
              </button>
              
              <div className="relative">
                <button
                  onClick={copyEstimationLink}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  title="Copier le lien d'estimation"
                >
                  📋
                </button>
                
                {/* Message de copie */}
                {copyMessage && (
                  <div className="absolute -top-8 right-0 bg-green-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                    {copyMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VUE PIPELINE (KANBAN) */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-8 items-start min-h-[500px] p-6">
          {STATUS_ORDER.map(statut => (
            <div key={statut} className="min-w-[280px] w-72 bg-slate-100 rounded-xl p-3 flex flex-col shrink-0">
              <div className={`font-bold uppercase text-xs mb-3 px-3 py-1.5 rounded-lg w-fit ${STATUS_COLORS[statut] || 'bg-gray-200'}`}>
                {statut} • {leads.filter(l => (l.statut || 'À traiter') === statut).length}
              </div>
              
              <div className="flex-1 space-y-3">
                {leads.filter(l => (l.statut || 'À traiter') === statut).map(lead => (
                  <div key={lead.id} onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }} className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 relative">
                    {/* En haut : Nom + Score IA */}
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-800 text-sm">{lead.nom}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${calculateScore(lead) >= 7 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                        Score: {calculateScore(lead)}/10
                      </span>
                    </div>
                    
                    {/* Milieu : Potentiel (le plus important) */}
                    <div className="text-center py-3 mb-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Potentiel</p>
                      <p className="text-2xl font-bold text-green-700">
                        {calculatePotential(lead.budget).toLocaleString()} €
                      </p>
                    </div>
                    
                    {/* Alertes visuelles et Smart Badges */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {/* Badge Prioritaire */}
                      {isPriority(lead) && (
                        <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                          🔥 Prioritaire
                        </span>
                      )}
                      
                      {/* Badge Relance requise */}
                      {needsRelance(lead) && (
                        <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                          ⚠️ Relance
                        </span>
                      )}
                    </div>
                    
                    {/* Suggestion Business */}
                    {(lead.statut || 'À traiter') === 'RDV Pris' && (
                      <div className="mb-2">
                        <button 
                          onClick={() => window.location.href = '/app/commercial'}
                          className="w-full bg-blue-100 text-blue-700 py-1.5 rounded-lg hover:bg-blue-200 transition-colors font-medium text-xs flex items-center justify-center gap-1"
                        >
                          📄 Préparer Mandat
                        </button>
                      </div>
                    )}
                    
                    {/* Infos secondaires */}
                    <p className="text-xs text-gray-600 mb-2">
                      {lead.type_bien} • {lead.budget ? `${lead.budget.toLocaleString()}€ budget` : 'Budget non défini'}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      📧 {lead.email} • 📞 {lead.telephone}
                    </p>
                    
                    {/* Actions Rapides */}
                    <div className="flex gap-2 mb-3 mt-2">
                      <button 
                        onClick={(e) => openWhatsApp(e, lead)}
                        className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Ouvrir WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
                      
                      <button 
                        onClick={(e) => openCalendar(e, lead)}
                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Planifier RDV"
                      >
                        📅 RDV
                      </button>
                      
                      <button 
                        onClick={(e) => openEmail(e, lead)}
                        className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Envoyer Email"
                      >
                        ✉ Email
                      </button>
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) - 1]); }}
                        disabled={STATUS_ORDER.indexOf(statut) === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed text-sm"
                      >
                        ←
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) + 1]); }}
                        disabled={STATUS_ORDER.indexOf(statut) === STATUS_ORDER.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed text-sm"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VUE LISTE (TABLEAU) */}
      {viewMode === 'list' && (
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              {/* En-tête du tableau */}
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left font-bold text-gray-500">Prospect</th>
                  <th className="p-4 text-left font-bold text-gray-500">Budget</th>
                  <th className="p-4 text-left font-bold text-gray-500">Score IA</th> {/* Nouvelle Colonne */}
                  <th className="p-4 text-left font-bold text-gray-500">Statut</th>
                  <th className="p-4 text-left font-bold text-gray-500">Actions Rapides</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">
                      {lead.nom}
                      <div className="text-xs text-gray-400">{lead.type_bien}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{lead.budget?.toLocaleString()} €</td>
                    
                    {/* Colonne Score IA + Smart Badges */}
                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${calculateScore(lead) >= 7 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                          {calculateScore(lead)}/10
                        </span>
                        
                        {/* Smart Badges */}
                        <div className="flex flex-col gap-1">
                          {isPriority(lead) && (
                            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse flex items-center gap-1">
                              🔥 Prioritaire
                            </span>
                          )}
                          
                          {needsRelance(lead) && (
                            <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold animate-pulse flex items-center gap-1">
                              ⚠️ Relance
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={lead.statut || 'À traiter'}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 text-xs rounded p-1"
                      >
                        {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    {/* Colonne Actions (Version Compacte) */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {/* Actions rapides */}
                        <div className="flex gap-1">
                          <button onClick={(e) => openWhatsApp(e, lead)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="WhatsApp">💬</button>
                          <button onClick={(e) => openCalendar(e, lead)} className="p-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200" title="RDV">📅</button>
                          <button onClick={(e) => openEmail(e, lead)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Email">✉</button>
                          <button onClick={(e) => openCall(e, lead)} className="p-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200" title="Appeler">📞</button>
                          <button onClick={() => openModal(lead)} className="p-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Voir Dossier">👁️</button>
                        </div>
                        
                        {/* Suggestion Business */}
                        {(lead.statut || 'À traiter') === 'RDV Pris' && (
                          <button 
                            onClick={() => window.location.href = '/app/commercial'}
                            className="w-full bg-blue-100 text-blue-700 py-1 rounded hover:bg-blue-200 transition-colors font-medium text-xs"
                          >
                            📄 Mandat
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE FICHE LEAD PROFESSIONNELLE */}
      {isModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl transform transition-all overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header avec synthèse */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedLead.nom}</h2>
                  <div className="flex items-center gap-4 mb-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${calculateScore(selectedLead) >= 7 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      Score: {calculateScore(selectedLead)}/10
                    </span>
                    <span className="text-blue-100">
                      Potentiel: <span className="font-bold text-white">{calculatePotential(selectedLead.budget).toLocaleString()} €</span>
                    </span>
                  </div>
                  
                  {/* Phrase de synthèse */}
                  <div className="bg-white/20 rounded-lg px-3 py-2 inline-block">
                    {(() => {
                      const status = getLeadStatus(selectedLead);
                      if (status === 'active') return '🟢 Ce lead est actif.';
                      if (status === 'dormant') return '🔴 Ce lead est dormant.';
                      return '🟡 Ce lead est en suivi.';
                    })()}
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white text-2xl">×</button>
              </div>
            </div>
            
            {/* Contenu 2 colonnes */}
            <div className="grid md:grid-cols-2 gap-6 p-6">
              {/* Colonne Gauche - Infos */}
              <div className="space-y-6">
                {/* Coordonnées */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    📞 Coordonnées
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="font-medium">{selectedLead.email || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Téléphone</p>
                      <p className="font-medium">{selectedLead.telephone || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Localisation</p>
                      <p className="font-medium">{selectedLead.adresse || 'Non renseignée'}</p>
                    </div>
                  </div>
                </div>

                {/* Projet */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    🏠 Projet Immobilier
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Type de bien</p>
                      <p className="font-medium">{selectedLead.type_bien || 'Non défini'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Budget estimé</p>
                      <p className="font-bold text-lg text-blue-700">{selectedLead.budget?.toLocaleString()} €</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Statut actuel</p>
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${STATUS_COLORS[selectedLead.statut || 'À traiter'] || 'bg-gray-200'}`}>
                        {selectedLead.statut || 'À traiter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assignation */}
                <div className="bg-purple-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    👥 Assignation
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Agent assigné</p>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>{selectedLead.assigned_to || 'Non assigné'}</option>
                        <option>Alice Martin (AM)</option>
                        <option>Bob Dupont (BD)</option>
                        <option>Carol Lambert (CL)</option>
                      </select>
                    </div>
                    <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium">
                      Assigner à cet agent
                    </button>
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-orange-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    📄 Documents
                  </h3>
                  <div className="space-y-2">
                    <button 
                      onClick={() => window.location.href = '/app/commercial'}
                      className="w-full bg-orange-100 text-orange-700 py-2 rounded-lg hover:bg-orange-200 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      📋 Mandat (Générer)
                    </button>
                    <button 
                      onClick={() => window.location.href = '/app/commercial'}
                      className="w-full bg-orange-100 text-orange-700 py-2 rounded-lg hover:bg-orange-200 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      💰 Offre (Générer)
                    </button>
                  </div>
                </div>
              </div>

              {/* Colonne Droite - Timeline */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  🕒 Historique des activités
                </h3>
                
                <div className="space-y-4">
                  {/* Timeline */}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-sm">Lead créé</p>
                      <p className="text-xs text-gray-500">
                        {selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString() : 'Date inconnue'}
                      </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={(e) => openWhatsApp(e, selectedLead)}
                      className="bg-green-100 text-green-700 py-2 rounded-lg hover:bg-green-200 transition-colors font-medium text-sm"
                    >
                      💬 WhatsApp
                    </button>
                    <button 
                      onClick={(e) => openEmail(e, selectedLead)}
                      className="bg-blue-100 text-blue-700 py-2 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                    >
                      ✉ Email
                    </button>
                    <button 
                      onClick={(e) => openCalendar(e, selectedLead)}
                      className="bg-orange-100 text-orange-700 py-2 rounded-lg hover:bg-orange-200 transition-colors font-medium text-sm"
                    >
                      📅 RDV
                    </button>
                    <button className="bg-purple-100 text-purple-700 py-2 rounded-lg hover:bg-purple-200 transition-colors font-medium text-sm">
                      📞 Appeler
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CRÉATION LEAD */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all overflow-hidden">
             <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Nouveau Lead</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
             </div>
             <div className="p-6">
                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Jean Dupont" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="jean@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                        <input type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="06 12 34 56 78" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type de bien</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option>Maison</option>
                            <option>Appartement</option>
                            <option>Terrain</option>
                        </select>
                    </div>
                </form>
             </div>
             <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annuler</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Créer le Lead
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
