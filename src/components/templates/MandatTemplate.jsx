import React from 'react';

export default function MandatTemplate({ 
  agency, 
  lead, 
  documentNumber = `MANDAT-${Date.now()}`,
  mandateType = 'Vente',
  duration = '6 mois'
}) {
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const endDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

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
          <div className="text-sm text-gray-500 mb-2">MANDAT N°</div>
          <div className="text-xl font-bold text-gray-900">{documentNumber}</div>
        </div>
      </div>

      {/* Titre et infos */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">CONTRAT DE MANDAT</h2>
        <div className="inline-block px-4 py-2 rounded-lg" style={{ backgroundColor: agency?.couleur || '#3B82F6' }}>
          <span className="text-white font-semibold">MANDAT DE {mandateType.toUpperCase()}</span>
        </div>
      </div>

      {/* Infos Document */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        <div>
          <div className="text-sm text-gray-500 mb-2">Date de signature</div>
          <div className="font-semibold text-gray-900">{currentDate}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-2">Durée du mandat</div>
          <div className="font-semibold text-gray-900">{duration}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-2">Date d'échéance</div>
          <div className="font-semibold text-gray-900">{endDate}</div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="text-sm font-semibold text-gray-700 mb-3">MANDANT</div>
          <div className="space-y-3">
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
              <div className="text-sm text-gray-600">Adresse</div>
              <div className="font-semibold text-gray-900">{lead?.adresse || 'À compléter'}</div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-6">
          <div className="text-sm font-semibold text-blue-700 mb-3">MANDATAIRE</div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-blue-600">Nom</div>
              <div className="font-semibold text-blue-900">{agency?.nom || 'LeadQualif IA'}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600">Email</div>
              <div className="font-semibold text-blue-900">{agency?.email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600">Téléphone</div>
              <div className="font-semibold text-blue-900">{agency?.telephone || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600">Adresse</div>
              <div className="font-semibold text-blue-900">{agency?.adresse || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Objet du mandat */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">OBJET DU MANDAT</h3>
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Le Mandant confie au Mandataire, qui accepte, la mission de {mandateType.toLowerCase()} 
              du bien suivant : <strong>{lead?.type_bien || 'bien immobilier'}</strong>
            </p>
            <p>
              <strong>Adresse du bien :</strong> {lead?.adresse_bien || 'À préciser'}
            </p>
            <p>
              <strong>Prix de vente souhaité :</strong> {lead?.budget ? `${lead.budget.toLocaleString()} €` : 'À discuter'}
            </p>
            <p>
              <strong>Disponibilité :</strong> {lead?.disponibilite || 'À convenir'}
            </p>
          </div>
        </div>
      </div>

      {/* Obligations du Mandataire */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">OBLIGATIONS DU MANDATAIRE</h3>
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start space-x-2">
              <span className="font-bold">1.</span>
              <span>Rechercher activement des acquéreurs potentiels pour le bien</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">2.</span>
              <span>Organiser et effectuer toutes les visites nécessaires</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">3.</span>
              <span>Négocier les conditions de vente au meilleur profit du Mandant</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">4.</span>
              <span>Assurer le suivi administratif jusqu'à la signature finale</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">5.</span>
              <span>Tenir informé régulièrement le Mandant de l'avancement du dossier</span>
            </div>
          </div>
        </div>
      </div>

      {/* Obligations du Mandant */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">OBLIGATIONS DU MANDANT</h3>
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start space-x-2">
              <span className="font-bold">1.</span>
              <span>Fournir tous les documents nécessaires à la vente</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">2.</span>
              <span>Mettre le bien en état de visite à tout moment convenu</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">3.</span>
              <span>Collaborer de bonne foi avec le Mandataire</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold">4.</span>
              <span>Informé immédiatement le Mandataire de toute proposition reçue directement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rémunération */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">RÉMUNÉRATION</h3>
        <div className="bg-yellow-50 rounded-lg p-6">
          <div className="space-y-3 text-sm text-yellow-800">
            <p>
              Le Mandant s'engage à verser au Mandataire une commission de 
              <strong> 5% </strong> du prix de vente HT, payable 
              <strong> à la signature de l'acte de vente </strong>
            </p>
            <p>
              Cette commission est due dès lors que la vente est conclue avec un acquéreur
              présenté par le Mandataire ou ses partenaires.
            </p>
            <p>
              En cas de vente par le Mandant lui-même, une commission de 
              <strong> 2% </strong> reste due au Mandataire pour les prestations effectuées.
            </p>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">SIGNATURES</h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-sm text-gray-600 mb-2">LE MANDANT</div>
            <div className="space-y-4">
              <div className="border-b-2 border-gray-300 pb-2 min-w-48">
                <div className="text-sm text-gray-500">Signature</div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Fait à _________________ le {currentDate}</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-2">LE MANDATAIRE</div>
            <div className="space-y-4">
              <div className="border-b-2 border-gray-300 pb-2 min-w-48">
                <div className="text-sm text-gray-500">Signature</div>
              </div>
              <div className="text-sm text-gray-600">
                <p>{agency?.nom || 'LeadQualif IA'}</p>
                <p>Fait à _________________ le {currentDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p><strong>{agency?.nom || 'LeadQualif IA'}</strong></p>
            {agency?.ifu && <p>IFU: {agency.ifu}</p>}
            {agency?.siret && <p>SIRET: {agency.siret}</p>}
            <p>Assurance professionnelle N°: RC-PRO-2024-001</p>
          </div>
          <div className="text-right">
            <p>Document généré le {currentDate}</p>
            <p>Référence client: {lead?.id?.substring(0, 8).toUpperCase()}</p>
            <p>Numéro de mandat: {documentNumber}</p>
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
