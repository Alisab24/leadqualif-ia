import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import DocumentService from '../services/documentService';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer l'utilisateur et son agence
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.agency_id) {
          setAgencyId(profile.agency_id);
          
          // Récupérer les documents via le service
          const docs = await DocumentService.getAgencyDocuments(profile.agency_id);
          setDocuments(docs);
          setFilteredDocuments(docs);
          
          // Récupérer les statistiques
          const documentStats = await DocumentService.getDocumentStats(profile.agency_id);
          setStats(documentStats);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrage et recherche
  useEffect(() => {
    let filtered = documents;

    // Recherche
    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.leads?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.leads?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par type
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.type === filterType);
    }

    // Filtre par statut
    if (filterStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === filterStatus);
    }

    // Filtre par date
    const now = new Date();
    if (dateRange === '7jours') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.created_at) >= sevenDaysAgo);
    } else if (dateRange === '30jours') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(doc => new Date(doc.created_at) >= thirtyDaysAgo);
    }

    setFilteredDocuments(filtered);
  }, [documents, searchTerm, filterType, filterStatus, dateRange]);

  // Types de documents uniques
  const documentTypes = [...new Set(documents.map(doc => doc.type))];

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'Brouillon': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'Généré': return 'bg-green-50 text-green-700 border-green-200';
      case 'Envoyé': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Signé': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header avec statistiques */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">📂 Centre de Documents</h1>
            <p className="text-slate-600">
              {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} trouvé{filteredDocuments.length > 1 ? 's' : ''}
              {filteredDocuments.length !== documents.length && ` sur ${documents.length} total`}
            </p>
          </div>
          <Link 
            to="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            📊 Dashboard
          </Link>
        </div>

        {/* Cartes de statistiques */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl">📄</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Ce mois</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.thisMonth}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 text-xl">📅</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Cette semaine</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.thisWeek}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-xl">📊</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Immobilier</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.immo}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-xl">🏠</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Marketing</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.smma}</p>
                </div>
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 text-xl">🚀</div>
              </div>
            </div>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Recherche</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un document ou client..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type de document</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les types</option>
                {documentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="Brouillon">Brouillon</option>
                <option value="Généré">Généré</option>
                <option value="Envoyé">Envoyé</option>
                <option value="Signé">Signé</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Période</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les dates</option>
                <option value="7jours">7 derniers jours</option>
                <option value="30jours">30 derniers jours</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                  setFilterStatus('all');
                  setDateRange('all');
                }}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                🔄 Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center py-20">
          <span className="text-6xl mb-4 block">🔍</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {documents.length === 0 ? 'Aucun document' : 'Aucun résultat trouvé'}
          </h3>
          <p className="text-slate-500 mb-6">
            {documents.length === 0 
              ? 'Pour générer des documents, allez sur le Dashboard et cliquez sur un Lead.'
              : 'Essayez de modifier vos filtres ou votre recherche.'
            }
          </p>
          {documents.length === 0 && (
            <Link 
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📊 Voir le Dashboard
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-700">Type</th>
                  <th className="text-left p-4 font-medium text-slate-700">Client</th>
                  <th className="text-left p-4 font-medium text-slate-700">Version</th>
                  <th className="text-left p-4 font-medium text-slate-700">Statut</th>
                  <th className="text-left p-4 font-medium text-slate-700">Projet</th>
                  <th className="text-left p-4 font-medium text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center text-xs font-bold">PDF</div>
                        <span className="font-medium text-slate-700">{doc.type}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-700">{doc.leads?.nom || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{doc.leads?.email || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-50 text-slate-700 text-xs font-bold rounded-full border border-slate-200">
                        v{doc.version}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {doc.leads?.type_bien && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                          {doc.leads.type_bien}
                        </span>
                      )}
                      {doc.leads?.budget && (
                        <span className="ml-2 text-green-600 font-medium">
                          {parseInt(doc.leads.budget).toLocaleString()} €
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600">
                      <div>
                        <p>{new Date(doc.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(doc.created_at).toLocaleTimeString().slice(0,5)}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-slate-800 mb-4">🚀 Actions rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/dashboard"
            className="text-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            📊 Dashboard
          </Link>
          <Link 
            to="/estimation"
            className="text-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            🚀 Nouveau Lead
          </Link>
          <Link 
            to="/settings"
            className="text-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            ⚙️ Paramètres
          </Link>
        </div>
      </div>
    </div>
  );
}
