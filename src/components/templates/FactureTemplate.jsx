import React from 'react';

export default function FactureTemplate({ 
  agency, 
  lead, 
  documentNumber = `FAC-${Date.now()}`,
  items = [],
  tva = 20,
  paymentStatus = 'En attente'
}) {
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const tvaAmount = subtotal * (tva / 100);
  const total = subtotal + tvaAmount;

  // Items par défaut si non fournis
  const defaultItems = items.length > 0 ? items : [
    {
      designation: "Analyse de besoins et stratégie",
      description: "Audit complet et plan d'action personnalisé",
      quantity: 1,
      price: 1500
    },
    {
      designation: "Mise en place des outils",
      description: "Configuration et intégration des solutions techniques",
      quantity: 1,
      price: 800
    },
    {
      designation: "Formation et accompagnement",
      description: "Session de formation et support 3 mois",
      quantity: 1,
      price: 1200
    }
  ];

  const finalItems = items.length > 0 ? items : defaultItems;
  const finalSubtotal = items.length > 0 ? subtotal : defaultItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const finalTva = finalSubtotal * (tva / 100);
  const finalTotal = finalSubtotal + finalTva;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Payée': return 'text-green-600 bg-green-50';
      case 'En attente': return 'text-orange-600 bg-orange-50';
      case 'En retard': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 print:p-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {agency?.logo ? (
            <img src={agency.logo} alt="Logo" className="h-16 w-16 object-contain rounded-lg" />
          ) : (
            <div 
              className="h-16 w-16 rounded-lg flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: agency?.couleur || '#3B82F6' }}
            >
              {agency?.nom?.charAt(0) || 'A'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{agency?.nom || 'LeadQualif IA'}</h1>
            <div className="text-sm text-gray-600 mt-1">
              <p>{agency?.adresse}</p>
              <p>{agency?.email}</p>
              <p>{agency?.telephone}</p>
              {agency?.site && <p>{agency?.site}</p>}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-2">FACTURE N°</div>
          <div className="text-xl font-bold text-gray-900">{documentNumber}</div>
          <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(paymentStatus)}`}>
            {paymentStatus}
          </div>
        </div>
      </div>

      {/* Infos Document */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        <div>
          <div className="text-sm text-gray-500 mb-2">Date d'émission</div>
          <div className="font-semibold text-gray-900">{currentDate}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-2">Date d'échéance</div>
          <div className="font-semibold text-gray-900">{dueDate}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-2">Statut</div>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(paymentStatus)}`}>
            {paymentStatus}
          </div>
        </div>
      </div>

      {/* Infos Client */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <div className="text-sm font-semibold text-gray-700 mb-3">FACTURÉ À</div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-sm text-gray-600">Nom</div>
            <div className="font-semibold text-gray-900">{lead?.nom || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Email</div>
            <div className="font-semibold text-gray-900">{lead?.email || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Téléphone</div>
            <div className="font-semibold text-gray-900">{lead?.telephone || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Projet</div>
            <div className="font-semibold text-gray-900">{lead?.type_bien || 'Projet'}</div>
          </div>
        </div>
      </div>

      {/* Tableau des prestations */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">DÉTAIL DES PRESTATIONS</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Désignation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Quantité</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Prix unitaire</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {finalItems.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.designation}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.description}</td>
                  <td className="px-4 py-4 text-sm text-center text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-4 text-sm text-right text-gray-900">{item.price.toLocaleString()} €</td>
                  <td className="px-4 py-4 text-sm font-semibold text-right text-gray-900">
                    {(item.quantity * item.price).toLocaleString()} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totaux */}
      <div className="flex justify-end mb-8">
        <div className="w-80">
          <div className="bg-gray-50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sous-total HT</span>
              <span className="font-semibold text-gray-900">{finalSubtotal.toLocaleString()} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">TVA ({tva}%)</span>
              <span className="font-semibold text-gray-900">{finalTva.toLocaleString()} €</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="text-base font-bold text-gray-900">TOTAL TTC</span>
              <span 
                className="text-xl font-bold"
                style={{ color: agency?.couleur || '#3B82F6' }}
              >
                {finalTotal.toLocaleString()} €
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conditions de paiement */}
      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">CONDITIONS DE PAIEMENT</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Paiement à 30 jours date de facture</p>
          <p>• Pénalités de retard : 3x le taux légal</p>
          <p>• En cas de retard, une indemnité forfaitaire de 40€ sera appliquée</p>
          <p>• Mode de paiement : Virement bancaire</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-sm text-gray-600 mb-2">Coordonnées bancaires</div>
            <div className="text-sm text-gray-900">
              <p><strong>Titulaire:</strong> {agency?.nom || 'LeadQualif IA'}</p>
              <p><strong>IBAN:</strong> FR76 XXXX XXXX XXXX XXXX XXXX XXX</p>
              <p><strong>BIC:</strong> XXXX XXXX</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-4">Signature et cachet</div>
            <div className="inline-block border-b-2 border-gray-300 pb-2 min-w-32">
              <div className="text-sm text-gray-500">Signature</div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p><strong>{agency?.nom || 'LeadQualif IA'}</strong></p>
              {agency?.ifu && <p>IFU: {agency.ifu}</p>}
              {agency?.siret && <p>SIRET: {agency.siret}</p>}
            </div>
            <div className="text-right">
              <p>Document généré le {currentDate}</p>
              <p>Référence client: {lead?.id?.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Styles pour impression */}
      <style jsx>{`
        @media print {
          .max-w-4xl {
            max-width: 100%;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        
        @page {
          margin: 2cm;
          size: A4;
        }
      `}</style>
    </div>
  );
}
