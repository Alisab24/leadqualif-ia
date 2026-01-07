import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentTimeline({ leadId, refreshTrigger }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leadId) fetchTimelineEvents();
  }, [leadId, refreshTrigger]); // Ajout de refreshTrigger

  const fetchTimelineEvents = async () => {
    setLoading(true);
    try {
      // Récupérer les documents pour créer la timeline
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transformer les documents en événements de timeline
      const timelineEvents = (documents || []).map(doc => ({
        id: doc.id,
        type: 'document',
        title: `${doc.type_document} généré`,
        description: `Document ${doc.type_document} créé avec statut "${doc.statut}"`,
        date: doc.created_at,
        icon: getDocumentIcon(doc.type_document),
        color: getEventColor(doc.statut)
      }));

      setEvents(timelineEvents);
    } catch (error) {
      console.error('Erreur chargement timeline:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'devis': return '💰';
      case 'contrat': return '📋';
      case 'mandat': return '✍️';
      case 'facture': return '🧾';
      default: return '📄';
    }
  };

  const getEventColor = (status) => {
    switch (status) {
      case 'généré': return 'text-green-600';
      case 'envoyé': return 'text-blue-600';
      case 'signé': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Aujourd'hui";
    } else if (diffDays === 1) {
      return "Hier";
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jours`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-xs text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="text-gray-400 text-sm">Aucune activité récente</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-gray-700 mb-3">Activité récente</h4>
      {events.map((event, index) => (
        <div key={event.id} className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-sm">{event.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${event.color}`}>
                {event.title}
              </p>
              <span className="text-xs text-gray-500">
                {formatTime(event.date)}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {formatDate(event.date)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
