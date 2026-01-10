import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const DocumentViewer = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🎯 LIRE LE DOCUMENT DEPUIS LA BASE (PAS DE GÉNÉRATION DYNAMIQUE)
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .select(`
          *,
          leads!inner(
            id,
            nom,
            email,
            telephone,
            budget,
            type_bien
          )
        `)
        .eq('id', id)
        .single();

      if (documentError) {
        console.error('❌ Erreur chargement document:', documentError);
        setError('Document non trouvé');
        return;
      }

      if (!documentData) {
        setError('Document non trouvé');
        return;
      }

      console.log('📄 Document lu depuis la base:', documentData);
      setDocument(documentData);

    } catch (err) {
      console.error('❌ Erreur fetchDocument:', err);
      setError('Erreur lors du chargement du document');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (document?.preview_html) {
      // 🎯 IMPRIMER LE HTML PERSISTÉ (COMME STRIPE)
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${document.titre}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${document.preview_html}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (document?.preview_html) {
      // 🎯 TÉLÉCHARGER LE HTML PERSISTÉ
      const blob = new Blob([document.preview_html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${document.reference}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Erreur</h3>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Document non trouvé</h3>
          <p className="text-slate-600">Ce document n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{document.titre}</h1>
            <p className="text-slate-600">Référence: {document.reference}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2h6m-6 8h6m-6-8h6" />
              </svg>
              Imprimer
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Télécharger
            </button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Métadonnées */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-700">Type:</span>
                <span className="ml-2 text-slate-900">{document.type}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Statut:</span>
                <span className="ml-2 text-slate-900">{document.statut}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Total TTC:</span>
                <span className="ml-2 text-slate-900">{document.total_ttc} {document.devise}</span>
              </div>
            </div>
          </div>

          {/* HTML PERSISTÉ */}
          <div className="p-6">
            <div 
              dangerouslySetInnerHTML={{ __html: document.preview_html }}
              className="prose max-w-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
