import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import LeadForm from '../components/LeadForm';
import DocumentGenerator from '../components/DocumentGenerator';
import { aiService } from '../services/ai';
import { TrialBanner, LeadQuotaBanner, UpgradeBanner, AddLeadGate } from '../components/PlanGuard';
import OnboardingGuide from '../components/OnboardingGuide';
import { NotificationBell, NotificationBanners } from '../components/SmartNotifications';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';

export default function Dashboard() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('kanban');

  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0 });
  const [agencyType, setAgencyType] = useState('immobilier');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);

  // === NOUVEAUX ÉTATS ===
  const [searchQuery, setSearchQuery] = useState('');
  const [filterQualification, setFilterQualification] = useState('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [crmHistory, setCrmHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'historique' | 'ia'

  // === DRAG & DROP ===
  const [activeDragId, setActiveDragId] = useState(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Refs
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(true);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollInterval = useRef(null);

  const statuts = ['À traiter', 'Contacté', 'Offre en cours', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  // === ARCHIVE / DELETE ===
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // leadId en attente de confirmation

  // === HELPER: Score IA Badge ===
  const getScoreBadge = (lead) => {
    const score = lead.score || lead.score_ia || 0;
    const q = lead.qualification || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid');
    if (q === 'chaud') return { label: '🟢 Chaud', bg: 'bg-green-100', text: 'text-green-700', score };
    if (q === 'tiede') return { label: '🟡 Tiède', bg: 'bg-yellow-100', text: 'text-yellow-700', score };
    return { label: '🔴 Froid', bg: 'bg-red-100', text: 'text-red-700', score };
  };

  // === LEADS FILTRÉS ===
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery ||
      lead.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.telephone?.includes(searchQuery);

    const score = lead.score || lead.score_ia || 0;
    const q = lead.qualification || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid');
    const matchesFilter = filterQualification === 'all' || q === filterQualification;

    // Archivés : masqués par défaut, visibles si showArchived
    const isArchived = lead.statut === 'Archivé';
    const matchesArchive = showArchived ? isArchived : !isArchived;

    return matchesSearch && matchesFilter && matchesArchive;
  });

  // === LOG CRM EVENT ===
  const logCrmEvent = async (leadId, type, title, description = '', metadata = {}) => {
    try {
      const agencyId = agencyProfile?.agency_id || agencyProfile?.id || 'default';
      await supabase.from('crm_events').insert({
        lead_id: leadId,
        agency_id: agencyId,
        type,
        title,
        description,
        metadata,
        created_by: session?.user?.id || null
      });
    } catch (error) {
      console.error('Erreur log CRM:', error);
    }
  };

  // === FETCH CRM HISTORY ===
  const fetchCrmHistory = async (leadId) => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('crm_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      setCrmHistory(data || []);
    } catch (error) {
      console.error('Erreur historique CRM:', error);
      setCrmHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // === FETCH AI SUGGESTION ===
  const fetchAISuggestion = async (lead) => {
    setLoadingAI(true);
    setAiSuggestion('');
    try {
      const result = await aiService.qualifyLead(lead);
      // Extraire la recommandation depuis les différents niveaux de réponse
      const evaluation = result?.evaluation_complete || result
      const actionImmediate = evaluation?.recommandations?.action_immediate
      const scoreLabel = result?.score_qualification ?? result?.score ?? 0
      const niveau = result?.niveau_interet_final || result?.niveau_interet || evaluation?.niveau_interet || 'FROID'
      const resume = result?.resume || evaluation?.raison_classification || ''
      const recs = Array.isArray(result?.recommandations) ? result.recommandations : []
      const suggestion = actionImmediate
        || (recs.length > 0 ? recs.join(' — ') : null)
        || (resume ? `${niveau} (${scoreLabel}%) — ${resume}` : `Score : ${scoreLabel}% — Niveau : ${niveau}`)
      setAiSuggestion(suggestion);
      // Sauvegarder la suggestion en base
      await supabase.from('leads')
        .update({ suggestion_ia: suggestion, ia_processed_at: new Date().toISOString() })
        .eq('id', lead.id);
      await logCrmEvent(lead.id, 'ia_suggestion', 'Suggestion IA générée', suggestion);
    } catch (error) {
      setAiSuggestion(lead.suggestion_ia || 'Erreur lors de la génération de la suggestion IA.');
    } finally {
      setLoadingAI(false);
    }
  };

  // === RENDEZ-VOUS ===
  const handleRendezVous = (lead) => {
    const agencySettings = {
      calendlyUrl: agencyProfile?.calendly_link || null,
      useCalendly: !!agencyProfile?.calendly_link
    };

    const eventTitle = `Rendez-vous - ${lead.nom}`;
    const eventDescription = `Lead: ${lead.nom}\nEmail: ${lead.email}\nTéléphone: ${lead.telephone}\nType de bien: ${lead.type_bien || 'Non spécifié'}\nBudget: ${lead.budget || 'Non spécifié'}€\n---\nPris par: ${session?.user?.user_metadata?.nom_complet || session?.user?.user_metadata?.name || 'Agent'}`.trim();

    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 1);
    const eventEndTime = new Date(eventDate);
    eventEndTime.setHours(eventEndTime.getHours() + 1);

    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    if (agencySettings.useCalendly && agencySettings.calendlyUrl) {
      const calendlyUrl = `${agencySettings.calendlyUrl}?name=${encodeURIComponent(lead.nom)}&email=${encodeURIComponent(lead.email)}&phone=${encodeURIComponent(lead.telephone)}`;
      window.open(calendlyUrl, '_blank');
    } else {
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&details=${encodeURIComponent(eventDescription)}&dates=${formatDate(eventDate)}/${formatDate(eventEndTime)}`;
      window.open(googleCalendarUrl, '_blank');
    }

    logCrmEvent(lead.id, 'rdv', 'RDV planifié', `Rendez-vous créé pour ${lead.nom}`);
  };

  // === MODIFICATION LEAD ===
  const handleEditLead = async () => {
    try {
      const { error } = await supabase
        .from('leads')
        .update(editFormData)
        .eq('id', selectedLead.id);
      if (error) throw error;

      const updated = { ...selectedLead, ...editFormData };
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
      setSelectedLead(updated);
      setShowEditModal(false);
      await logCrmEvent(selectedLead.id, 'edit', 'Lead modifié', 'Informations mises à jour');
    } catch (error) {
      console.error('Erreur modification:', error);
    }
  };

  // Scroll
  const checkScrollOverflow = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const hasOverflow = container.scrollWidth > container.clientWidth;
    const canScrollLeft = container.scrollLeft > 0;
    const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth;
    setShowLeftArrow(hasOverflow && canScrollLeft);
    setShowRightArrow(hasOverflow && canScrollRight);
  };

  const scrollByAmount = (amount) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScrollOverflow, 300);
  };

  const startHoverScroll = (direction) => {
    // Ne pas scroller si un drag est en cours
    if (activeDragId) return;
    if (scrollInterval.current) return;
    scrollInterval.current = setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      container.scrollLeft += direction === 'left' ? -8 : 8;
    }, 30);
  };

  const stopHoverScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  useEffect(() => {
    setTimeout(checkScrollOverflow, 500);
    window.addEventListener('resize', checkScrollOverflow);
    return () => {
      window.removeEventListener('resize', checkScrollOverflow);
      stopHoverScroll();
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchLeads();
        fetchStats();
        fetchAgencyProfile();
      }
    });
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erreur chargement leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: leads } = await supabase.from('leads').select('budget, statut');
      if (leads) {
        const total = leads.length;
        const won = leads.filter(l => l.statut === 'Gagné').length;
        const potential = leads.reduce((sum, l) => sum + (l.budget || 0), 0);
        setStats({ total, won, potential });
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const fetchAgencyProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) {
        setAgencyProfile({ type_agence: 'immobilier', agency_id: 'default' });
      } else {
        setAgencyProfile(profileData);
        setAgencyType(profileData.type_agence || 'immobilier');
      }
    } catch (error) {
      setAgencyProfile({ type_agence: 'immobilier', agency_id: 'default' });
    }
  };

  const updateStatus = async (leadId, newStatus) => {
    if (!newStatus) return;
    const oldLead = leads.find(l => l.id === leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatus } : l));
    await supabase.from('leads').update({ statut: newStatus }).eq('id', leadId);
    await logCrmEvent(
      leadId,
      'status_change',
      `Statut → "${newStatus}"`,
      `Changement de "${oldLead?.statut || 'Inconnu'}" à "${newStatus}"`
    );
  };

  // === ARCHIVER UN LEAD ===
  const handleArchiveLead = async (leadId) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: 'Archivé' } : l));
    await supabase.from('leads').update({ statut: 'Archivé' }).eq('id', leadId);
    await logCrmEvent(leadId, 'archive', 'Lead archivé', 'Lead déplacé vers les archives');
    if (selectedLead?.id === leadId) setSelectedLead(null);
  };

  // === SUPPRIMER UN LEAD ===
  const handleDeleteLead = async (leadId) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    await supabase.from('leads').delete().eq('id', leadId);
    setConfirmDelete(null);
    if (selectedLead?.id === leadId) setSelectedLead(null);
  };

  // === DRAG & DROP HANDLERS ===
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
    stopHoverScroll(); // stopper tout scroll automatique dès le début du drag
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const leadId = active.id;
    const newStatut = over.id; // column id = statut name

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.statut === newStatut) return;

    await updateStatus(leadId, newStatut);
  };

  // Helper statut couleur
  const statutColor = (statut) => {
    const map = {
      'À traiter': 'bg-gray-100 text-gray-800',
      'Contacté': 'bg-blue-100 text-blue-800',
      'Offre en cours': 'bg-yellow-100 text-yellow-800',
      'RDV fixé': 'bg-orange-100 text-orange-800',
      'Négociation': 'bg-purple-100 text-purple-800',
      'Gagné': 'bg-green-100 text-green-800',
      'Perdu': 'bg-red-100 text-red-800',
    };
    return map[statut] || 'bg-gray-100 text-gray-800';
  };

  // Helper icône CRM event type
  const crmEventIcon = (type) => {
    const icons = {
      status_change: '🔄',
      edit: '✏️',
      rdv: '📅',
      whatsapp: '💬',
      email: '📧',
      call: '📞',
      document: '📄',
      ia_suggestion: '🧠',
      note: '📝',
    };
    return icons[type] || '⚡';
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* ===== HEADER ===== */}
      <header className="flex-none h-auto bg-white border-b border-slate-200 px-6 z-40 shadow-sm shrink-0">
        {/* Ligne principale */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-900 hidden md:block">Pipeline</h1>
            <div className="flex gap-2">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">{stats.total} leads</span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100 hidden sm:block">{stats.potential.toLocaleString()} €</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle archivés */}
            <button
              onClick={() => setShowArchived(prev => !prev)}
              title={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showArchived
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="hidden sm:inline">{showArchived ? '📂 Archivés' : '📂 Archivés'}</span>
              <span className="sm:hidden">📂</span>
            </button>

            {/* Kanban / Liste toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                title="Vue Kanban"
                className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="hidden md:inline">📋 Kanban</span>
                <span className="md:hidden">📋</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Vue Liste"
                className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="hidden md:inline">☰ Liste</span>
                <span className="md:hidden">☰</span>
              </button>
            </div>

            {/* Nouveau lead — action principale */}
            <AddLeadGate>
              <button
                data-new-lead
                onClick={() => setShowLeadForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold shadow-sm"
                title="Nouveau lead"
              >
                <span>➕</span>
                <span className="hidden sm:inline">Nouveau lead</span>
              </button>
            </AddLeadGate>

            {/* Cloche notifications */}
            <NotificationBell agencyId={agencyProfile?.agency_id || agencyProfile?.id} />
          </div>
        </div>

        {/* === BARRE RECHERCHE + FILTRES === */}
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {/* Recherche */}
          <div className="relative flex-1 min-w-[160px] max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Rechercher un lead…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >✕</button>
            )}
          </div>

          {/* Filtres qualification */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'all',   icon: '⚡', label: 'Tous',   style: filterQualification === 'all'   ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50' },
              { key: 'chaud', icon: '🟢', label: 'Chaud', style: filterQualification === 'chaud' ? 'bg-green-600 text-white'  : 'bg-white text-green-700 border border-green-200 hover:bg-green-50' },
              { key: 'tiede', icon: '🟡', label: 'Tiède', style: filterQualification === 'tiede' ? 'bg-yellow-500 text-white' : 'bg-white text-yellow-700 border border-yellow-200 hover:bg-yellow-50' },
              { key: 'froid', icon: '🔴', label: 'Froid', style: filterQualification === 'froid' ? 'bg-red-500 text-white'    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterQualification(f.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${f.style}`}
                title={f.label}
              >
                <span className="hidden sm:inline">{f.icon} {f.label}</span>
                <span className="sm:hidden">{f.icon}</span>
              </button>
            ))}
          </div>

          {/* Compteur résultats */}
          {(searchQuery || filterQualification !== 'all') && (
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {filteredLeads.length} résultat{filteredLeads.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {/* ===== ONBOARDING GUIDE ===== */}
        <OnboardingGuide />

        {/* ===== BANNIÈRES PLAN + NOTIFICATIONS URGENTES ===== */}
        <div className="px-6 pt-2 space-y-1">
          <TrialBanner />
          <LeadQuotaBanner />
          <UpgradeBanner feature="docs" />
          <NotificationBanners agencyId={agencyProfile?.agency_id || agencyProfile?.id} />
        </div>

        {/* ===== VUE KANBAN avec Drag & Drop ===== */}
        {viewMode === 'kanban' && (
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
          <div className="p-6 h-full overflow-hidden">
            {showLeftArrow && (
              <button
                onClick={() => !activeDragId && scrollByAmount(-320)}
                onMouseEnter={() => startHoverScroll('left')}
                onMouseLeave={stopHoverScroll}
                className={`fixed left-16 top-1/2 -translate-y-1/2 z-50 w-11 h-11 bg-white/90 hover:bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110
                  ${activeDragId ? 'pointer-events-none opacity-0' : ''}`}
              >
                <span className="text-gray-700 text-lg select-none">◀</span>
              </button>
            )}

            {showRightArrow && (
              <button
                onClick={() => !activeDragId && scrollByAmount(320)}
                onMouseEnter={() => startHoverScroll('right')}
                onMouseLeave={stopHoverScroll}
                className={`fixed right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 bg-white/90 hover:bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110
                  ${activeDragId ? 'pointer-events-none opacity-0' : ''}`}
              >
                <span className="text-gray-700 text-lg select-none">▶</span>
              </button>
            )}

            <div
              ref={scrollContainerRef}
              className="p-6 h-full overflow-x-auto overflow-y-hidden"
              onScroll={checkScrollOverflow}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', whiteSpace: 'nowrap' }}
            >
              <div className="flex gap-6 h-full">
                {statuts.map((statut, idx) => {
                  const columnLeads = filteredLeads.filter(l => l.statut === statut);
                  return (
                    <KanbanColumn
                      key={statut}
                      statut={statut}
                      idx={idx}
                      leads={columnLeads}
                      statuts={statuts}
                      activeDragId={activeDragId}
                      getScoreBadge={getScoreBadge}
                      statutColor={statutColor}
                      onSelectLead={(lead) => {
                        setSelectedLead(lead);
                        setActiveTab('info');
                        setCrmHistory([]);
                        setAiSuggestion(lead.suggestion_ia || '');
                      }}
                      onNavigate={(id) => navigate(`/lead/${id}`)}
                      onUpdateStatus={updateStatus}
                      onRdv={handleRendezVous}
                      onArchive={handleArchiveLead}
                      onDelete={(id) => setConfirmDelete(id)}
                      /* relayés vers KanbanCard via KanbanColumn */
                    />
                  );
                })}
                <div className="min-w-[50px]"></div>
              </div>
            </div>
          </div>

          {/* Overlay pendant le drag */}
          <DragOverlay>
            {activeDragId ? (() => {
              const lead = leads.find(l => l.id === activeDragId);
              if (!lead) return null;
              const badge = getScoreBadge(lead);
              return (
                <div className="bg-white p-3 rounded-xl shadow-2xl border-2 border-blue-400 w-[300px] rotate-2 opacity-95">
                  <div className="font-bold text-slate-900 text-sm mb-1">{lead.nom}</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-green-600 mb-2">
                    <span>💰</span><span>{lead.budget ? lead.budget.toLocaleString('fr-FR') + ' €' : '—'}</span>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })() : null}
          </DragOverlay>
          </DndContext>
        )}

        {/* ===== VUE LISTE ===== */}
        {viewMode === 'list' && (
          <div className="p-6 h-full overflow-y-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Score IA</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Téléphone</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase">Budget</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Source</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLeads.map(lead => {
                      const badge = getScoreBadge(lead);
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedLead(lead);
                            setActiveTab('info');
                            setCrmHistory([]);
                            setAiSuggestion(lead.suggestion_ia || '');
                          }}
                        >
                          <td className="px-3 py-2 font-medium text-slate-900 text-sm">{lead.nom}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                              {badge.label}{badge.score > 0 && ` ${badge.score}%`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">{lead.email || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{lead.telephone || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
                              🏠 {lead.type_bien || 'Non défini'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statutColor(lead.statut)}`}>
                              {lead.statut}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-600 text-sm">
                            {lead.budget ? lead.budget.toLocaleString('fr-FR') + ' €' : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex px-2 py-1 text-xs rounded bg-slate-50 text-slate-700 border">
                              🌍 {lead.source || 'Inconnue'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center space-x-1">
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/lead/${lead.id}`); }} className="text-green-600 hover:text-green-800 p-1" title="Voir">👁</button>
                              <a href={`https://wa.me/${lead.telephone?.replace(/\D/g, '')}`} target="_blank" className="text-green-600 hover:text-green-800 p-1" title="WhatsApp" onClick={e => { e.stopPropagation(); logCrmEvent(lead.id, 'whatsapp', 'Message WhatsApp envoyé'); }}>💬</a>
                              <a href={`tel:${lead.telephone}`} className="text-blue-600 hover:text-blue-800 p-1" title="Appeler" onClick={e => { e.stopPropagation(); logCrmEvent(lead.id, 'call', 'Appel téléphonique'); }}>📞</a>
                              <a href={`mailto:${lead.email}`} className="text-orange-600 hover:text-orange-800 p-1" title="Email" onClick={e => { e.stopPropagation(); logCrmEvent(lead.id, 'email', 'Email envoyé'); }}>📧</a>
                              <button className="text-purple-600 hover:text-purple-800 p-1" title="RDV" onClick={e => { e.stopPropagation(); handleRendezVous(lead); }}>📅</button>
                              <button className="text-amber-500 hover:text-amber-700 p-1" title="Archiver" onClick={e => { e.stopPropagation(); handleArchiveLead(lead.id); }}>📁</button>
                              <button className="text-red-500 hover:text-red-700 p-1" title="Supprimer" onClick={e => { e.stopPropagation(); setConfirmDelete(lead.id); }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredLeads.length === 0 && (
                  <div className="text-center text-slate-400 py-12 text-sm">Aucun lead trouvé</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== PANNEAU LEAD SÉLECTIONNÉ ===== */}
        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">

              {/* Header panneau */}
              <div className="p-4 border-b border-slate-200 shrink-0">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedLead.nom}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        selectedLead.lead_role === 'proprietaire' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedLead.lead_role === 'proprietaire' ? '🔑 Propriétaire' : '🏠 Client'}
                      </span>
                      {(() => {
                        const b = getScoreBadge(selectedLead);
                        return (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${b.bg} ${b.text}`}>
                            {b.label}{b.score > 0 && ` ${b.score}%`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 text-lg">✕</button>
                </div>

                {/* Actions rapides */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => { window.open(`https://wa.me/${selectedLead.telephone?.replace(/\D/g, '')}`, '_blank'); logCrmEvent(selectedLead.id, 'whatsapp', 'Message WhatsApp envoyé'); }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors"
                  >
                    <span className="text-lg mb-1">💬</span>WhatsApp
                  </button>
                  <button
                    onClick={() => { window.open(`tel:${selectedLead.telephone}`, '_blank'); logCrmEvent(selectedLead.id, 'call', 'Appel téléphonique'); }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                  >
                    <span className="text-lg mb-1">📞</span>Appeler
                  </button>
                  <button
                    onClick={() => { window.open(`mailto:${selectedLead.email}`, '_blank'); logCrmEvent(selectedLead.id, 'email', 'Email envoyé'); }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition-colors"
                  >
                    <span className="text-lg mb-1">📧</span>Email
                  </button>
                  <button
                    onClick={() => handleRendezVous(selectedLead)}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-colors"
                  >
                    <span className="text-lg mb-1">📅</span>RDV
                  </button>
                </div>
              </div>

              {/* Onglets */}
              <div className="flex border-b border-slate-200 shrink-0">
                {[
                  { key: 'info', label: '📋 Infos' },
                  { key: 'historique', label: '🕐 Historique' },
                  { key: 'ia', label: '🧠 IA' },
                  { key: 'documents', label: '📄 Docs' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'historique' && crmHistory.length === 0) {
                        fetchCrmHistory(selectedLead.id);
                      }
                      if (tab.key === 'ia' && !aiSuggestion) {
                        fetchAISuggestion(selectedLead);
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      activeTab === tab.key
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenu onglets - scrollable */}
              <div className="flex-1 overflow-y-auto">

                {/* === ONGLET INFOS === */}
                {activeTab === 'info' && (
                  <div className="p-4 space-y-3">
                    <div className="space-y-2">
                      {[
                        { icon: '📧', label: 'Email', value: selectedLead.email },
                        { icon: '📞', label: 'Téléphone', value: selectedLead.telephone },
                        { icon: '💰', label: 'Budget', value: selectedLead.budget ? selectedLead.budget.toLocaleString('fr-FR') + ' €' : '—', green: true },
                        { icon: '🏠', label: 'Type de bien', value: selectedLead.type_bien },
                        { icon: '🌍', label: 'Source', value: selectedLead.source },
                        { icon: '📅', label: 'Créé le', value: new Date(selectedLead.created_at).toLocaleDateString('fr-FR') },
                      ].map(row => (
                        <div key={row.label} className="flex items-center gap-3 py-1.5 border-b border-slate-50">
                          <span className="text-base w-5">{row.icon}</span>
                          <span className="text-xs text-slate-500 w-24 shrink-0">{row.label}</span>
                          <span className={`text-xs font-medium ${row.green ? 'text-green-600 font-bold' : 'text-slate-800'}`}>
                            {row.value || '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Statut + changement */}
                    <div className="pt-2">
                      <p className="text-xs font-bold text-slate-600 mb-2">Changer de statut</p>
                      <div className="flex flex-wrap gap-1">
                        {statuts.map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              updateStatus(selectedLead.id, s);
                              setSelectedLead(prev => ({ ...prev, statut: s }));
                            }}
                            className={`px-2 py-1 text-xs rounded-full font-medium transition-all ${
                              selectedLead.statut === s
                                ? `${statutColor(s)} ring-2 ring-offset-1 ring-current`
                                : `${statutColor(s)} opacity-60 hover:opacity-100`
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message du lead */}
                    {selectedLead.message && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-slate-600 mb-1">💬 Message</p>
                        <p className="text-xs text-slate-700">{selectedLead.message}</p>
                      </div>
                    )}

                    {/* Bouton Modifier */}
                    <button
                      onClick={() => {
                        setEditFormData({
                          nom: selectedLead.nom || '',
                          email: selectedLead.email || '',
                          telephone: selectedLead.telephone || '',
                          budget: selectedLead.budget || '',
                          type_bien: selectedLead.type_bien || '',
                          source: selectedLead.source || '',
                          message: selectedLead.message || '',
                          statut: selectedLead.statut || 'À traiter',
                        });
                        setShowEditModal(true);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-700 text-sm font-semibold transition-colors"
                    >
                      ✏️ Modifier ce lead
                    </button>

                    <button
                      onClick={() => navigate(`/lead/${selectedLead.id}`)}
                      className="w-full flex items-center justify-center gap-2 p-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 text-sm font-semibold transition-colors"
                    >
                      👁 Fiche complète
                    </button>
                  </div>
                )}

                {/* === ONGLET HISTORIQUE CRM === */}
                {activeTab === 'historique' && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">Historique CRM</p>
                      <button
                        onClick={() => fetchCrmHistory(selectedLead.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        🔄 Rafraîchir
                      </button>
                    </div>

                    {loadingHistory && (
                      <div className="text-center py-6 text-slate-400 text-sm">Chargement…</div>
                    )}

                    {/* Entrée de création toujours présente */}
                    <div className="space-y-3">
                      {crmHistory.map((event, i) => (
                        <div key={event.id || i} className="flex items-start gap-3">
                          <div className="shrink-0 w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-sm">
                            {crmEventIcon(event.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{event.description}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Création du lead */}
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-sm">⚡</div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-800">Lead créé</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(selectedLead.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {!loadingHistory && crmHistory.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-2">Aucun événement CRM enregistré</p>
                      )}
                    </div>
                  </div>
                )}

                {/* === ONGLET IA === */}
                {activeTab === 'ia' && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">🧠 Analyse IA</p>
                      <button
                        onClick={() => fetchAISuggestion(selectedLead)}
                        disabled={loadingAI}
                        className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                      >
                        {loadingAI ? '⏳ Analyse…' : '🔄 Analyser'}
                      </button>
                    </div>

                    {/* Score gauge */}
                    {(() => {
                      const badge = getScoreBadge(selectedLead);
                      const score = badge.score;
                      return (
                        <div className={`p-4 rounded-xl ${badge.bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-sm ${badge.text}`}>{badge.label}</span>
                            <span className={`text-2xl font-bold ${badge.text}`}>{score}%</span>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <p className={`text-xs mt-2 ${badge.text} opacity-80`}>Score d'intention d'achat</p>
                        </div>
                      );
                    })()}

                    {/* Suggestion IA */}
                    {(aiSuggestion || selectedLead.suggestion_ia) && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-purple-700 mb-2">💡 Recommandation IA</p>
                        <p className="text-xs text-purple-800 leading-relaxed">
                          {aiSuggestion || selectedLead.suggestion_ia}
                        </p>
                      </div>
                    )}

                    {/* Résumé IA */}
                    {selectedLead.resume_ia && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-600 mb-2">📝 Résumé IA</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{selectedLead.resume_ia}</p>
                      </div>
                    )}

                    {loadingAI && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        <div className="animate-spin text-2xl mb-2">⚙️</div>
                        Analyse en cours…
                      </div>
                    )}

                    {!loadingAI && !aiSuggestion && !selectedLead.suggestion_ia && (
                      <p className="text-xs text-slate-400 text-center py-4">Cliquez sur "Analyser" pour générer une suggestion IA</p>
                    )}
                  </div>
                )}

                {/* === ONGLET DOCUMENTS === */}
                {activeTab === 'documents' && (
                  <div className="p-4">
                    <DocumentGenerator
                      lead={selectedLead}
                      agencyId={agencyProfile?.agency_id || agencyProfile?.id || session?.user?.id}
                      agencyType={agencyType}
                      onDocumentGenerated={(data) => {
                        logCrmEvent(selectedLead.id, 'document', `Document généré`, `Type: ${data?.type || 'Document'}`);
                        fetchLeads();
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL NOUVEAU LEAD ===== */}
        {showLeadForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                <h2 className="text-xl font-bold text-slate-900">➕ Nouveau Lead</h2>
                <button onClick={() => setShowLeadForm(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
              </div>
              <LeadForm
                onClose={() => setShowLeadForm(false)}
                onSuccess={() => { setShowLeadForm(false); fetchLeads(); fetchStats(); }}
                agencyType={agencyProfile?.type_agence || 'immobilier'}
              />
            </div>
          </div>
        )}

        {/* ===== MODAL MODIFIER LEAD ===== */}
        {showEditModal && selectedLead && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                <h2 className="text-lg font-bold text-slate-900">✏️ Modifier — {selectedLead.nom}</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
              </div>

              <div className="p-6 space-y-4">
                {[
                  { key: 'nom', label: 'Nom complet', type: 'text', placeholder: 'Jean Dupont' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'jean@exemple.com' },
                  { key: 'telephone', label: 'Téléphone', type: 'text', placeholder: '+33 6 00 00 00 00' },
                  { key: 'budget', label: 'Budget (€)', type: 'number', placeholder: '300000' },
                  { key: 'type_bien', label: 'Type de bien', type: 'text', placeholder: 'Appartement, Maison…' },
                  { key: 'source', label: 'Source', type: 'text', placeholder: 'Facebook, WhatsApp…' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{field.label}</label>
                    <input
                      type={field.type}
                      value={editFormData[field.key] || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                ))}

                {/* Statut */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Statut</label>
                  <select
                    value={editFormData.statut || 'À traiter'}
                    onChange={e => setEditFormData(prev => ({ ...prev, statut: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {statuts.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Message / Notes</label>
                  <textarea
                    value={editFormData.message || ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="Notes sur ce lead…"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEditLead}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    ✅ Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══ MODALE CONFIRMATION SUPPRESSION ══ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">🗑️</div>
              <div>
                <p className="font-bold text-slate-900">Supprimer ce lead ?</p>
                <p className="text-xs text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5 bg-slate-50 rounded-lg px-3 py-2">
              <strong>{leads.find(l => l.id === confirmDelete)?.nom || 'Ce lead'}</strong> sera définitivement supprimé avec tout son historique CRM.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteLead(confirmDelete)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ===== COMPOSANTS KANBAN DnD =====

function KanbanColumn({
  statut, idx, leads, statuts, activeDragId,
  getScoreBadge, statutColor,
  onSelectLead, onNavigate, onUpdateStatus, onRdv,
  onArchive, onDelete
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[320px] max-w-[320px] flex flex-col h-full max-h-[85vh] rounded-xl border transition-all duration-200 ${
        isOver
          ? 'bg-blue-50 border-blue-400 shadow-lg shadow-blue-100'
          : 'bg-slate-100/50 border-slate-200'
      }`}
    >
      <div className="p-4 font-bold text-slate-700 bg-white/80 rounded-t-xl flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/50">
        {statut}
        <span className="bg-white text-xs px-2 py-1 rounded-full shadow-sm text-slate-500 border">{leads.length}</span>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {leads.map(lead => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            idx={idx}
            statuts={statuts}
            activeDragId={activeDragId}
            getScoreBadge={getScoreBadge}
            statutColor={statutColor}
            onSelect={onSelectLead}
            onNavigate={onNavigate}
            onUpdateStatus={onUpdateStatus}
            onRdv={onRdv}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}

        {/* Zone de dépôt vide */}
        {leads.length === 0 && (
          <div className={`flex items-center justify-center h-16 rounded-xl border-2 border-dashed text-xs transition-all ${
            isOver ? 'border-blue-400 text-blue-500 bg-blue-50' : 'border-slate-200 text-slate-400'
          }`}>
            {isOver ? '⬇ Déposer ici' : 'Aucun lead'}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  lead, idx, statuts, activeDragId,
  getScoreBadge, statutColor,
  onSelect, onNavigate, onUpdateStatus, onRdv,
  onArchive, onDelete
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const badge = getScoreBadge(lead);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl h-[120px] opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all duration-200"
      onClick={() => onSelect(lead)}
    >
      {/* Drag handle hint + actions */}
      <div className="flex justify-between mb-2">
        <div className="flex items-center gap-1">
          {/* Drag handle */}
          <span
            {...attributes}
            {...listeners}
            className="text-slate-300 hover:text-slate-500 cursor-grab text-xs mr-1 select-none"
            onClick={e => e.stopPropagation()}
            title="Glisser pour déplacer"
          >⠿</span>
          <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">
            🏠 {lead.type_bien || 'Projet'}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(lead.id); }}
            className="w-6 h-6 bg-green-50 hover:bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm"
            title="Voir les détails"
          >👁</button>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, statuts[idx + 1]); }}
            className="w-6 h-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm"
            title="Avancer"
          >→</button>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, statuts[idx - 1]); }}
            className="w-6 h-6 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm"
            title="Reculer"
          >←</button>
          <button
            onClick={(e) => { e.stopPropagation(); onRdv(lead); }}
            className="w-6 h-6 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shadow-sm"
            title="RDV"
          >📅</button>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
            className="w-6 h-6 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-sm"
            title="Archiver"
          >📁</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
            className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center shadow-sm"
            title="Supprimer"
          >🗑</button>
        </div>
      </div>

      {/* Nom */}
      <div className="font-bold text-slate-900 mb-2 text-sm">{lead.nom}</div>

      {/* Infos */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>📧</span><span className="truncate">{lead.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>📞</span><span>{lead.telephone || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-green-600">
          <span>💰</span><span>{lead.budget ? lead.budget.toLocaleString('fr-FR') + ' €' : '—'}</span>
        </div>
      </div>

      {/* Score badge IA */}
      <div className="flex items-center justify-between mt-2">
        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
          {badge.label}
          {badge.score > 0 && <span className="ml-1 opacity-70">{badge.score}%</span>}
        </span>
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statutColor(lead.statut)}`}>
          {lead.statut}
        </span>
      </div>
    </div>
  );
}
