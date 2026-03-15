import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ProfileManager from '../services/profileManager';
import { DOC_TYPE_LABEL, DOC_TYPE_ICON } from '../services/documentCounterService';
import { FeatureGate } from '../components/PlanGuard';

export default function DocumentsCenter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredLeadId, setFilteredLeadId] = useState(searchParams.get('lead'));
  const [filterType, setFilterType] = useState('tous');
  const [filterStatut, setFilterStatut] = useState('tous');

  useEffect(() => {
    fetchDocuments();
  }, [filteredLeadId]);

  // Réinitialise le filtre type si le type sélectionné disparaît des docs chargés
  useEffect(() => {
    if (filterType !== 'tous' && documents.length > 0) {
      const hasType = documents.some(d => d.type_document === filterType);
      if (!hasType) setFilterType('tous');
    }
  }, [documents]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDocuments([]);
        return;
      }

      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: true,
        useFallback: true,
        required: ['agency_id'],
        verbose: true,
      });

      if (!profileResult.success) {
        setDocuments([]);
        return;
      }

      const profile = profileResult.profile;
      const agencyId = ProfileManager.getSafeAgencyId(profile);

      if (!agencyId) {
        setDocuments([]);
        return;
      }

      let query = supabase
        .from('documents')
        .select('*')
        .eq('agency_id', agencyId);

      if (filteredLeadId) {
        query = query.eq('lead_id', filteredLeadId);
      }

      const { data: docs, error: documentsError } = await query
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      // Enrichir avec les données leads
      if (docs && docs.length > 0) {
        const leadIds = [...new Set(docs.map(d => d.lead_id))].filter(Boolean);
        if (leadIds.length > 0) {
          const { data: leads } = await supabase
            .from('leads')
            .select('id, nom, email, telephone, statut, budget, type_bien')
            .in('id', leadIds);

          setDocuments(docs.map(doc => ({
            ...doc,
            lead: (leads || []).find(l => l.id === doc.lead_id) || null,
          })));
        } else {
          setDocuments(docs);
        }
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('❌ Erreur fetchDocuments:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────
  // Filtrage local
  // ──────────────────────────────────
  const filteredDocs = documents.filter(doc => {
    const typeOk = filterType === 'tous' || doc.type_document === filterType;
    const statutOk = filterStatut === 'tous' || doc.statut === filterStatut;
    return typeOk && statutOk;
  });

  // ──────────────────────────────────
  // Helpers UI
  // ──────────────────────────────────
  const getDocumentIcon = (type) => DOC_TYPE_ICON[type] ?? '📄';
  const getDocumentLabel = (type) => DOC_TYPE_LABEL[type] ?? type;

  const STATUT_COLOR = {
    brouillon:  'bg-slate-100 text-slate-700',
    envoyé:     'bg-blue-100 text-blue-700',
    signé:      'bg-purple-100 text-purple-700',
    payé:       'bg-green-100 text-green-700',
    annulé:     'bg-red-100 text-red-700',
    généré:     'bg-teal-100 text-teal-700',
  };

  const LEAD_STATUT_COLOR = {
    'À traiter':  'bg-slate-100 text-slate-700',
    'Contacté':   'bg-blue-100 text-blue-700',
    'RDV fixé':   'bg-yellow-100 text-yellow-700',
    'Négociation':'bg-orange-100 text-orange-700',
    'Gagné':      'bg-green-100 text-green-700',
    'Perdu':      'bg-red-100 text-red-700',
  };

  const formatDate = (str) =>
    str ? new Date(str).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }) : '—';

  // Compteurs par type pour les stats rapides
  const countByType = (type) => documents.filter(d => d.type_document === type).length;
  const countByStatut = (statut) => documents.filter(d => d.statut === statut).length;

  // Types de documents uniques présents dans les docs de cette agence
  const availableTypes = Array.from(
    new Set(documents.map(d => d.type_document).filter(Boolean))
  ).sort();

  // ──────────────────────────────────
  // Render
  // ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement des documents…</p>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="docs" mode="banner">
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">

      {/* ── En-tête sticky ── */}
      <header className="flex-none bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Centre de Documents</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {filteredLeadId
                ? `Documents filtrés — lead #${filteredLeadId}`
                : 'Tous les documents générés pour votre agence'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {filteredLeadId && (
              <button
                onClick={() => setFilteredLeadId(null)}
                className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                ← Tous les documents
              </button>
            )}
            <button
              onClick={fetchDocuments}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualiser
            </button>
          </div>
        </div>
      </header>

      {/* ── Zone scrollable ── */}
      <main className="flex-1 overflow-auto px-8 py-6 space-y-6">

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: documents.length, icon: '📄', color: 'text-slate-900', bg: 'bg-slate-100' },
            { label: 'Devis', value: countByType('devis'), icon: '💰', color: 'text-green-700', bg: 'bg-green-100' },
            { label: 'Factures', value: countByType('facture'), icon: '🧾', color: 'text-blue-700', bg: 'bg-blue-100' },
            { label: 'Signés', value: countByStatut('signé'), icon: '✍️', color: 'text-purple-700', bg: 'bg-purple-100' },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
              <div className={`${bg} rounded-full p-3 text-xl`}>{icon}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="tous">Tous les types</option>
              {availableTypes.map(k => (
                <option key={k} value={k}>
                  {getDocumentIcon(k)} {getDocumentLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Statut</label>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="tous">Tous les statuts</option>
              {['brouillon', 'envoyé', 'signé', 'payé', 'annulé'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <p className="ml-auto text-xs text-slate-400 self-center">
            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Type & N°', 'Lead', 'Contact', 'Statut lead', 'Statut doc', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <div className="text-5xl mb-3">📄</div>
                      <p className="font-medium">Aucun document trouvé</p>
                      <p className="text-sm mt-1">Ajustez les filtres ou générez des documents depuis les fiches leads</p>
                    </td>
                  </tr>
                ) : filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    {/* Type & N° */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getDocumentIcon(doc.type_document)}</span>
                        <div>
                          <p className="font-medium text-slate-800 capitalize">
                            {getDocumentLabel(doc.type_document)}
                          </p>
                          {doc.numero_document && (
                            <p className="text-xs font-mono text-slate-400">{doc.numero_document}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Lead */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{doc.lead?.nom ?? '—'}</p>
                      {doc.lead?.budget && (
                        <p className="text-xs text-green-600">{doc.lead.budget.toLocaleString()} €</p>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p>{doc.lead?.email ?? '—'}</p>
                      <p>{doc.lead?.telephone ?? ''}</p>
                    </td>

                    {/* Statut lead */}
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${LEAD_STATUT_COLOR[doc.lead?.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {doc.lead?.statut ?? 'N/A'}
                      </span>
                    </td>

                    {/* Statut doc */}
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUT_COLOR[doc.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {doc.statut ?? '—'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/documents/view/${doc.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir
                        </Link>
                        <button
                          onClick={() => navigate(`/dashboard?lead=${doc.lead_id}`)}
                          className="text-slate-500 hover:text-slate-800 text-sm font-medium"
                        >
                          Lead
                        </button>
                        {doc.fichier_url && (
                          <a
                            href={doc.fichier_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
    </FeatureGate>
  );
}
