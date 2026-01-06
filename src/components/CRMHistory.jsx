import React, { useState, useEffect } from 'react';
import DocumentService from '../services/documentService';

export default function CRMHistory({ lead, agencyId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await DocumentService.getLeadHistory(lead.id, agencyId);
        setEvents(history);
      } catch (error) {
        console.error('Erreur chargement historique:', error);
      } finally {
        setLoading(false);
      }
    };

    if (lead && agencyId) {
      fetchHistory();
    }
  }, [lead, agencyId]);

  const getEventIcon = (type) => {
    switch (type) {
      case 'document_generated': return '📄';
      case 'document_status_updated': return '🔄';
      case 'call': return '📞';
      case 'email': return '📧';
      case 'meeting': return '📅';
      case 'note': return '📝';
      default: return '📋';
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'document_generated': return 'bg-green-50 text-green-700 border-green-200';
      case 'document_status_updated': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'call': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'email': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'meeting': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'note': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-slate-100 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <span className="text-3xl mb-2 block">📭</span>
        <p>Aucun historique pour ce lead</p>
        <p className="text-sm mt-2">Les actions apparaîtront ici au fur et à mesure</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div 
          key={event.id} 
          className={`p-4 rounded-lg border ${getEventColor(event.type)} hover:shadow-md transition-shadow`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl flex-shrink-0">
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-slate-800 truncate">
                  {event.title}
                </h4>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {event.description && (
                <p className="text-sm text-slate-600 mb-2">
                  {event.description}
                </p>
              )}

              {/* Métadonnées spécifiques aux documents */}
              {event.metadata?.document_type && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-white/50 rounded-full font-medium">
                    {event.metadata.document_type}
                  </span>
                  {event.metadata.version && (
                    <span className="px-2 py-1 bg-white/50 rounded-full">
                      v{event.metadata.version}
                    </span>
                  )}
                  {event.metadata.status && (
                    <span className="px-2 py-1 bg-white/50 rounded-full">
                      {event.metadata.status}
                    </span>
                  )}
                </div>
              )}

              {/* Métadonnées pour les autres types d'événements */}
              {event.metadata && !event.metadata.document_type && (
                <div className="text-xs text-slate-500 mt-1">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      <span className="font-medium">{key}:</span> {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
