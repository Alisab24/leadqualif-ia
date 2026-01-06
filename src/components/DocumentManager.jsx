import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentManager({ lead, agencyId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead?.id) fetchDocuments();
  }, [lead]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  const generatePDF = async (docName) => {
    setLoading(true);
    const doc = new jsPDF();
    doc.text(`Document: ${docName}`, 10, 10);
    doc.text(`Client: ${lead.nom}`, 10, 20);
    doc.save(`${docName}.pdf`);

    await supabase.from('documents').insert([{
      lead_id: lead.id,
      agency_id: agencyId,
      type: docName,
      status: 'Généré'
    }]);
    fetchDocuments();
    setLoading(false);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => generatePDF('Devis')} 
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Devis'}
        </button>
        <button 
          onClick={() => generatePDF('Contrat')} 
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Contrat'}
        </button>
      </div>
      
      <div className="space-y-2">
        {documents.map(doc => (
          <div key={doc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="font-medium">{doc.type}</span>
            <span className="text-sm text-gray-500">{doc.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
