import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ProfileManager from '../services/profileManager';
import LeadForm from '../components/LeadForm';
import ImportLeadsModal from '../components/ImportLeadsModal';
import useHotLeadAlerts from '../hooks/useHotLeadAlerts';
import DocumentGenerator from '../components/DocumentGenerator';
import { aiService } from '../services/ai';
import { LeadQuotaBanner, UpgradeBanner, AddLeadGate, usePlanGuard } from '../components/PlanGuard';
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

// ── WhatsApp helpers ─────────────────────────────────────────────────────────
/**
 * Normalise un numéro pour WhatsApp (supprime tout sauf les chiffres).
 * Les nouveaux leads stockent le numéro au format international (+33612345678).
 * Rétro-compat : anciens numéros FR sans indicatif (0612345678 → 33612345678).
 */
const toWhatsAppPhone = (raw = '') => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Rétro-compat : numéros FR locaux sans indicatif (10 chiffres, commence par 0)
  if (digits.startsWith('0') && digits.length === 10) return '33' + digits.substring(1);
  return digits;
};

/** URL WhatsApp Web — fonctionne sur PC (navigateur) ET mobile */
const buildWhatsAppUrl = (phone, message = '') => {
  const p = toWhatsAppPhone(phone);
  if (!p) return null;
  const base = `https://web.whatsapp.com/send?phone=${p}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
};

/** Icône SVG WhatsApp officielle */
const WhatsAppIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ── Labels SMMA ─────────────────────
const TYPE_SERVICE_LABELS = {
  social_media:      'Social Media',
  meta_ads:          'Meta Ads',
  google_ads:        'Google Ads',
  seo:               'SEO',
  creation_contenu:  'Contenu',
  emailing:          'Emailing / CRM',
  strategie:         'Stratégie globale',
  autre:             'Autre',
};
const BUDGET_MARKETING_LABELS = {
  'moins_500':   '< 500\u00a0€/mois',
  '500_1500':    '500–1\u00a0500\u00a0€',
  '1500_3000':   '1\u00a0500–3\u00a0000\u00a0€',
  '3000_5000':   '3\u00a0000–5\u00a0000\u00a0€',
  '5000_plus':   '> 5\u00a0000\u00a0€',
};

/** Retourne le libellé TYPE selon le contexte agence */
const getLeadType = (lead, isSmma) => {
  if (isSmma) return TYPE_SERVICE_LABELS[lead.type_service] || lead.type_service || null;
  // Priorité : type_bien_recherche (colonne réelle DB), puis fallbacks anciens noms
  return lead.type_bien_recherche || lead.type_de_bien || lead.type_bien || null;
};

/** Retourne le libellé BUDGET selon le contexte agence */
const getLeadBudget = (lead, isSmma) => {
  if (isSmma) return BUDGET_MARKETING_LABELS[lead.budget_marketing] || lead.budget_marketing || null;
  return lead.budget ? lead.budget.toLocaleString('fr-FR') + ' €' : null;
};

/**
 * Génère une recommandation dynamique basée sur le score réel du lead.
 * Utilisé en fallback si suggestion_ia absente ou générique.
 */
const getSmartRecommendation = (lead) => {
  const score = lead.score || lead.score_ia || lead.score_qualification || 0;
  const niveau = (lead.niveau_interet || '').toUpperCase();
  const statut = lead.statut || '';

  if (statut === 'Gagné') return '✅ Client signé. Préparer le onboarding et le premier rapport de performance.';
  if (statut === 'Perdu') return '❌ Lead perdu. Analyser la raison pour améliorer le processus commercial.';
  if (statut === 'Devis envoyé') return '📄 Devis envoyé. Relancer sous 48h si pas de réponse. Proposer un appel de clarification.';
  if (statut === 'Négociation') return '🤝 En négociation. Rester disponible, proposer un ajustement de l\'offre si besoin.';

  if (score >= 80 || niveau === 'CHAUD') {
    return '🔥 Lead très chaud. Contacter immédiatement — intention d\'achat claire. Proposer un appel ou une démo aujourd\'hui.';
  }
  if (score >= 65) {
    return '🟢 Lead chaud. Contacter dans les 24h. Envoyer un devis personnalisé et répondre aux éventuelles questions.';
  }
  if (score >= 45 || niveau === 'TIÈDE') {
    return '🟡 Lead tiède. Contacter sous 48h. Nourrir avec des témoignages clients ou une étude de cas pertinente.';
  }
  if (score >= 25) {
    return '🟠 Lead froid mais qualifiable. Relancer avec un email de présentation et ajouter au suivi automatique.';
  }
  return '❄️ Lead froid ou peu qualifié. Ajouter à la liste de suivi longue durée. Automatiser les relances.';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { canAccess } = usePlanGuard();
  const [viewMode, setViewMode] = useState('kanban');

  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0, chauds: 0 });
  const [agencyType, setAgencyType] = useState('immobilier');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);

  // ── Bulk WhatsApp en mode Liste ─────────────────────────────────────────────
  const [bulkWALeads, setBulkWALeads]   = useState(null); // null | lead[]
  const [bulkWAIndex, setBulkWAIndex]   = useState(0);

  // Toast notifications
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  // ── Alertes leads chauds temps réel ─────────────────────
  const hotLeadWebhook = agencyProfile?.notification_webhook || ''
  const hotLeadAgencyId = agencyProfile?.agency_id || null
  useHotLeadAlerts(hotLeadAgencyId, hotLeadWebhook)

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
    // Priorité : score_qualification (champ principal) → score_ia → score → 0
    const score = lead.score_qualification || lead.score_ia || lead.score || 0;
    // niveau_interet UNIQUEMENT — ne pas lire lead.qualification qui contient
    // le statut pipeline ("À traiter", "Contacté"…) et non la température IA
    const rawNiveau = (lead.niveau_interet || '').toLowerCase().replace('tiède','tiede').replace('tièd','tiede');
    const VALID = ['chaud', 'tiede', 'froid'];
    const q = (VALID.includes(rawNiveau) ? rawNiveau : null) || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid');
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

    const score = lead.score_qualification || lead.score_ia || lead.score || 0;
    const rawNiveau = (lead.niveau_interet || '').toLowerCase().replace('tiède','tiede').replace('tièd','tiede');
    const VALID_N = ['chaud', 'tiede', 'froid'];
    const q = (VALID_N.includes(rawNiveau) ? rawNiveau : null) || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid');
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

  // ── Action de contact : log + auto-avancement Kanban ─────────────────────────
  // Si le lead est encore "À traiter", le déplacer vers "Contacté" automatiquement
  const handleContactAction = async (lead, actionType) => {
    const eventMap = {
      whatsapp: { type: 'whatsapp', title: 'Message WhatsApp envoyé' },
      call:     { type: 'call',     title: 'Appel téléphonique'      },
      email:    { type: 'email',    title: 'Email envoyé'            },
    };
    const ev = eventMap[actionType];
    if (ev) await logCrmEvent(lead.id, ev.type, ev.title);

    if (lead.statut === 'À traiter') {
      await supabase.from('leads').update({ statut: 'Contacté', updated_at: new Date().toISOString() }).eq('id', lead.id);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, statut: 'Contacté' } : l));
      showToast(`✅ ${lead.nom} déplacé vers "Contacté"`);
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
      // Extraire score et niveau depuis le résultat IA
      const evaluation = result?.evaluation_complete || result
      const scoreLabel = result?.score_qualification ?? result?.score ?? lead.score ?? lead.score_ia ?? 0
      const niveau = result?.niveau_interet_final || result?.niveau_interet || evaluation?.niveau_interet || 'FROID'
      const resume = result?.resume || evaluation?.raison_classification || ''
      // Construire un objet lead enrichi avec le score/niveau IA pour la recommandation dynamique
      const enrichedLead = { ...lead, score: scoreLabel, score_ia: scoreLabel, niveau_interet: niveau }
      // Recommandation dynamique basée sur le score réel IA + résumé contextuel si disponible
      const smartRec = getSmartRecommendation(enrichedLead)
      const suggestion = resume
        ? `${smartRec}\n\n📝 Analyse IA : ${resume}`
        : smartRec
      setAiSuggestion(suggestion);
      // Sauvegarder score + niveau + recommandation en base
      await supabase.from('leads')
        .update({
          suggestion_ia: smartRec,          // stocker la version courte (sans résumé)
          resume_ia: resume || smartRec,
          score_qualification: scoreLabel,
          score: scoreLabel,
          niveau_interet: niveau,
          ia_processed_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
      await logCrmEvent(lead.id, 'ia_suggestion', 'Analyse IA', `Score: ${scoreLabel}% — ${niveau}`);
    } catch (error) {
      setAiSuggestion(getSmartRecommendation(lead));
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Utiliser ProfileManager pour obtenir le bon agency_id
      // (cohérent avec Stats.jsx et les leads insérés via le formulaire public)
      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: false,
        useFallback: true,
        verbose: false,
      });

      // Priorité : profile.agency_id → fallback sur user.id
      const agencyId = profileResult.success
        ? (ProfileManager.getSafeAgencyId(profileResult.profile) !== 'default'
            ? ProfileManager.getSafeAgencyId(profileResult.profile)
            : user.id)
        : user.id;

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', agencyId)
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: false,
        useFallback: true,
        verbose: false,
      });

      const agencyId = profileResult.success
        ? (ProfileManager.getSafeAgencyId(profileResult.profile) !== 'default'
            ? ProfileManager.getSafeAgencyId(profileResult.profile)
            : user.id)
        : user.id;

      const { data: leads } = await supabase
        .from('leads').select('budget, statut, niveau_interet')
        .eq('agency_id', agencyId);
      if (leads) {
        const total = leads.length;
        const won = leads.filter(l => l.statut === 'Gagné').length;
        const potential = leads.reduce((sum, l) => sum + (l.budget || 0), 0);
        const chauds = leads.filter(l => (l.niveau_interet || '').toLowerCase() === 'chaud').length;
        setStats({ total, won, potential, chauds });
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
              {agencyType === 'smma' ? (
                stats.chauds > 0 && (
                  <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100 hidden sm:flex items-center gap-1">
                    🔥 {stats.chauds} chaud{stats.chauds > 1 ? 's' : ''}
                  </span>
                )
              ) : (
                stats.potential > 0 && (
                  <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100 hidden sm:block">
                    {stats.potential.toLocaleString()} €
                  </span>
                )
              )}
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

            {/* Import leads — verrouillé sur plan gratuit */}
            {canAccess('docs') ? (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm"
                title="Importer depuis CSV / Excel"
              >
                <span>📥</span>
                <span className="hidden sm:inline">Importer</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/settings?tab=facturation')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm opacity-70"
                title="Fonctionnalité Solo+ — Passer à un plan supérieur"
              >
                <span>🔒</span>
                <span className="hidden sm:inline">Importer</span>
              </button>
            )}

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
                      agencyType={agencyType}
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
                      onWhatsApp={(lead) => {
                        const url = buildWhatsAppUrl(lead.telephone || '');
                        if (url) { window.open(url, '_blank'); handleContactAction(lead, 'whatsapp'); }
                      }}
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
          <div className="p-4 md:p-6 h-full overflow-y-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
              {/* ── Tableau ── */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 z-20">Nom</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Score IA</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Téléphone</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                        {agencyType === 'smma' ? 'Service' : 'Type'}
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Statut</th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                        {agencyType === 'smma' ? 'Budget' : 'Budget'}
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wide sticky right-0 bg-slate-50 z-20 shadow-[-2px_0_6px_rgba(0,0,0,0.06)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map(lead => {
                      const badge = getScoreBadge(lead);
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                          onClick={() => {
                            setSelectedLead(lead);
                            setActiveTab('info');
                            setCrmHistory([]);
                            setAiSuggestion(lead.suggestion_ia || '');
                          }}
                        >
                          {/* Nom — sticky gauche */}
                          <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/40 z-10">
                            {lead.nom}
                          </td>

                          {/* Score */}
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                              {badge.label}{badge.score > 0 && ` ${badge.score}%`}
                            </span>
                          </td>

                          {/* Email — masqué < md */}
                          <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[160px] truncate hidden md:table-cell">
                            {lead.email || '—'}
                          </td>

                          {/* Téléphone */}
                          <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                            {lead.telephone || '—'}
                          </td>

                          {/* Type/Service — masqué < lg */}
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            {(() => {
                              const isSmma = agencyType === 'smma';
                              const typeLabel = getLeadType(lead, isSmma);
                              return (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">
                                  {isSmma ? '📣' : '🏠'} {typeLabel || 'Non défini'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Statut */}
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statutColor(lead.statut)}`}>
                              {lead.statut}
                            </span>
                          </td>

                          {/* Budget — masqué < md */}
                          <td className="px-3 py-2.5 text-right font-bold text-green-700 text-xs whitespace-nowrap hidden md:table-cell">
                            {getLeadBudget(lead, agencyType === 'smma') || '—'}
                          </td>

                          {/* Actions — sticky droite TOUJOURS VISIBLE */}
                          <td className="px-2 py-2 sticky right-0 bg-white group-hover:bg-blue-50/40 z-10 shadow-[-2px_0_6px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-center gap-0.5">
                              {/* WhatsApp — en premier, bien visible */}
                              {lead.telephone ? (
                                <a
                                  href={buildWhatsAppUrl(lead.telephone) || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                                  title={`WhatsApp · ${lead.telephone}`}
                                  onClick={e => { e.stopPropagation(); handleContactAction(lead, 'whatsapp'); }}
                                >
                                  <WhatsAppIcon size={15} />
                                </a>
                              ) : (
                                <span className="w-7 h-7 inline-flex items-center justify-center text-slate-300" title="Pas de téléphone">
                                  <WhatsAppIcon size={14} />
                                </span>
                              )}
                              <a
                                href={`tel:${lead.telephone}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                title="Appeler"
                                onClick={e => { e.stopPropagation(); handleContactAction(lead, 'call'); }}
                              >📞</a>
                              <a
                                href={`mailto:${lead.email}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-orange-50 text-orange-500 transition-colors"
                                title="Email"
                                onClick={e => { e.stopPropagation(); handleContactAction(lead, 'email'); }}
                              >📧</a>
                              <button
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors"
                                title="RDV"
                                onClick={e => { e.stopPropagation(); handleRendezVous(lead); }}
                              >📅</button>
                              <button
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                                title="Archiver"
                                onClick={e => { e.stopPropagation(); handleArchiveLead(lead.id); }}
                              >📁</button>
                              <button
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                title="Supprimer"
                                onClick={e => { e.stopPropagation(); setConfirmDelete(lead.id); }}
                              >🗑</button>
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

              {/* ── Barre WhatsApp en bas ── */}
              {(() => {
                const withPhone = filteredLeads.filter(l => l.telephone);
                if (withPhone.length === 0) return null;
                return (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <WhatsAppIcon size={16} />
                        <span><strong>{withPhone.length}</strong> lead{withPhone.length > 1 ? 's' : ''} avec téléphone sur {filteredLeads.length}</span>
                      </span>
                    </div>
                    <button
                      onClick={() => { setBulkWALeads(withPhone); setBulkWAIndex(0); }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <WhatsAppIcon size={16} />
                      Contacter un à un via WhatsApp
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Modal Bulk WhatsApp ─────────────────────────────────────────────── */}
        {bulkWALeads && bulkWALeads.length > 0 && (() => {
          const lead    = bulkWALeads[bulkWAIndex];
          const total   = bulkWALeads.length;
          const waUrl   = buildWhatsAppUrl(lead.telephone, `Bonjour ${lead.nom}, je reviens vers vous suite à votre demande.`);
          const percent = Math.round(((bulkWAIndex + 1) / total) * 100);
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-green-600 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <WhatsAppIcon size={20} />
                    <span className="font-bold text-base">WhatsApp en série</span>
                  </div>
                  <button onClick={() => setBulkWALeads(null)} className="text-white/80 hover:text-white text-xl">✕</button>
                </div>

                {/* Barre de progression */}
                <div className="h-1.5 bg-slate-100">
                  <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>

                {/* Contenu */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1 text-xs text-slate-400 font-medium">
                    <span>Lead {bulkWAIndex + 1} / {total}</span>
                    <span>{percent}% traités</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <div className="font-bold text-slate-900 text-lg mb-0.5">{lead.nom}</div>
                    <div className="text-slate-500 text-sm">{lead.telephone}</div>
                    {lead.email && <div className="text-slate-400 text-xs mt-0.5">{lead.email}</div>}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {lead.statut && (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statutColor(lead.statut)}`}>
                          {lead.statut}
                        </span>
                      )}
                      {(() => {
                        const b = getScoreBadge(lead);
                        return (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${b.bg} ${b.text}`}>
                            {b.label}{b.score > 0 && ` ${b.score}%`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Bouton principal WhatsApp */}
                  <a
                    href={waUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors mb-3"
                    onClick={() => handleContactAction(lead, 'whatsapp')}
                  >
                    <WhatsAppIcon size={18} />
                    Ouvrir WhatsApp pour {lead.nom}
                  </a>

                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBulkWAIndex(i => Math.max(0, i - 1))}
                      disabled={bulkWAIndex === 0}
                      className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                    >
                      ← Précédent
                    </button>
                    {bulkWAIndex < total - 1 ? (
                      <button
                        onClick={() => setBulkWAIndex(i => i + 1)}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Suivant →
                      </button>
                    ) : (
                      <button
                        onClick={() => setBulkWALeads(null)}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        ✅ Terminé
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
                    onClick={() => { const url = buildWhatsAppUrl(selectedLead.telephone || ''); if (url) window.open(url, '_blank'); handleContactAction(selectedLead, 'whatsapp'); }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors"
                  >
                    <span className="mb-1"><WhatsAppIcon size={20} /></span>WhatsApp
                  </button>
                  <button
                    onClick={() => { window.open(`tel:${selectedLead.telephone}`, '_blank'); handleContactAction(selectedLead, 'call'); }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                  >
                    <span className="text-lg mb-1">📞</span>Appeler
                  </button>
                  <button
                    onClick={() => { window.open(`mailto:${selectedLead.email}`, '_blank'); handleContactAction(selectedLead, 'email'); }}
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

                    {/* Suggestion IA — dynamique par score, ou résultat du bouton Analyser */}
                    {(() => {
                      // Priorité : résultat frais du bouton "Analyser" → stored suggestion_ia → fallback dynamique par score
                      const GENERIC_FROID = 'Ajouter à la liste de suivi longue durée. Peut devenir intéressant plus tard.'
                      const storedSuggestion = selectedLead.suggestion_ia
                      const isGeneric = !storedSuggestion || storedSuggestion.trim() === GENERIC_FROID
                      const displayRec = aiSuggestion
                        || (!isGeneric ? storedSuggestion : null)
                        || getSmartRecommendation(selectedLead)
                      const isLive = !!aiSuggestion
                      return (
                        <div className={`border rounded-xl p-4 ${isLive ? 'bg-purple-50 border-purple-200' : 'bg-indigo-50 border-indigo-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className={`text-xs font-bold ${isLive ? 'text-purple-700' : 'text-indigo-700'}`}>
                              💡 Recommandation IA
                            </p>
                            {!isLive && (
                              <span className="text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
                                Basée sur score {selectedLead.score || selectedLead.score_ia || 0}/100
                              </span>
                            )}
                          </div>
                          {(() => {
                            const parts = displayRec.split('\n\n📝 Analyse IA : ')
                            return (
                              <>
                                <p className={`text-xs leading-relaxed font-medium ${isLive ? 'text-purple-800' : 'text-indigo-800'}`}>
                                  {parts[0]}
                                </p>
                                {parts[1] && (
                                  <p className={`text-xs mt-2 leading-relaxed opacity-75 ${isLive ? 'text-purple-700' : 'text-indigo-700'}`}>
                                    📝 {parts[1]}
                                  </p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )
                    })()}

                    {/* Résumé IA — seulement si pas déjà affiché dans la recommandation */}
                    {!aiSuggestion && selectedLead.resume_ia && selectedLead.resume_ia !== selectedLead.suggestion_ia && (
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

        {/* ===== MODAL IMPORT LEADS ===== */}
        {showImportModal && (
          <ImportLeadsModal
            onClose={() => setShowImportModal(false)}
            onSuccess={(count) => {
              setShowImportModal(false)
              fetchLeads()
              fetchStats && fetchStats()
            }}
            agencyId={agencyProfile?.agency_id || agencyProfile?.id || session?.user?.id}
            agencyType={agencyProfile?.type_agence || 'immobilier'}
          />
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
                agencyId={agencyProfile?.agency_id || agencyProfile?.id || session?.user?.id}
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

      {/* ── Toast auto-avancement Kanban ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition-all ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

    </div>
  );
}

// ===== COMPOSANTS KANBAN DnD =====

function KanbanColumn({
  statut, idx, leads, statuts, activeDragId,
  getScoreBadge, statutColor, agencyType,
  onSelectLead, onNavigate, onUpdateStatus, onRdv,
  onArchive, onDelete, onWhatsApp
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
            agencyType={agencyType}
            onSelect={onSelectLead}
            onNavigate={onNavigate}
            onUpdateStatus={onUpdateStatus}
            onRdv={onRdv}
            onArchive={onArchive}
            onDelete={onDelete}
            onWhatsApp={onWhatsApp}
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
  getScoreBadge, statutColor, agencyType,
  onSelect, onNavigate, onUpdateStatus, onRdv,
  onArchive, onDelete, onWhatsApp
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
            {agencyType === 'smma' ? '📣' : '🏠'}{' '}
            {getLeadType(lead, agencyType === 'smma') || (agencyType === 'smma' ? 'Service' : 'Projet')}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(lead.id); }}
            className="w-6 h-6 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full flex items-center justify-center shadow-sm"
            title="Voir les détails"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
          </button>
          {lead.telephone && (
            <button
              onClick={(e) => { e.stopPropagation(); if (onWhatsApp) onWhatsApp(lead); }}
              className="w-6 h-6 bg-green-50 hover:bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm"
              title={`WhatsApp · ${lead.telephone}`}
            >
              <WhatsAppIcon size={12} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, statuts[idx + 1]); }}
            className="w-6 h-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm font-bold text-xs"
            title="Avancer"
          >→</button>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, statuts[idx - 1]); }}
            className="w-6 h-6 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm font-bold text-xs"
            title="Reculer"
          >←</button>
          <button
            onClick={(e) => { e.stopPropagation(); onRdv(lead); }}
            className="w-6 h-6 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shadow-sm"
            title="RDV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd"/></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
            className="w-6 h-6 bg-amber-50 hover:bg-amber-100 text-amber-500 rounded-full flex items-center justify-center shadow-sm"
            title="Archiver"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 7.5v7A1.5 1.5 0 003.5 16h13a1.5 1.5 0 001.5-1.5v-7H2zm5 2a.5.5 0 000 1h6a.5.5 0 000-1H7z"/></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
            className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-400 rounded-full flex items-center justify-center shadow-sm"
            title="Supprimer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
          </button>
        </div>
      </div>

      {/* Nom */}
      <div className="font-bold text-slate-900 mb-2 text-sm">{lead.nom}</div>

      {/* Infos */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12" className="shrink-0 text-slate-400"><path d="M2.5 3A1.5 1.5 0 001 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0115 5.293V4.5A1.5 1.5 0 0013.5 3h-11z"/><path d="M15 6.954L8.978 9.86a2.25 2.25 0 01-1.956 0L1 6.954V11.5A1.5 1.5 0 002.5 13h11a1.5 1.5 0 001.5-1.5V6.954z"/></svg>
          <span className="truncate">{lead.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12" className="shrink-0 text-slate-400"><path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5V5c0 1.149.15 2.263.43 3.322a13.422 13.422 0 009.248 9.248c1.06.28 2.173.43 3.322.43h1.5a1.5 1.5 0 001.5-1.5v-1.148a1.5 1.5 0 00-1.175-1.465l-3.223-.716a1.5 1.5 0 00-1.341.343l-.793.793a11.927 11.927 0 01-6.394-6.394l.793-.793a1.5 1.5 0 00.343-1.34L5.465 3.175A1.5 1.5 0 004 2H3.5z" clipRule="evenodd"/></svg>
          <span>{lead.telephone || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12" className="shrink-0"><path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z"/></svg>
          <span>{getLeadBudget(lead, agencyType === 'smma') || '—'}</span>
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
