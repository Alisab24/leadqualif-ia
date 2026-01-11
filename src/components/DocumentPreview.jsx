import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';

const DocumentPreview = ({ 
  document, 
  agencyProfile, 
  lead, 
  onClose,
  documentType 
}) => {
  const componentRef = useRef();
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    onBeforePrint: () => setIsPrinting(true),
    onAfterPrint: () => setIsPrinting(false),
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm;
      }
      @media print {
        body { 
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `
  });

  const formatAmount = (amount, currency = 'EUR') => {
    if (amount === null || amount === undefined || amount === 0) {
      return '0 €';
    }
    
    // 🎯 CORRECTION: Convertir le symbole € en code ISO 4217
    // Intl.NumberFormat n'accepte que les codes ISO, pas les symboles
    const normalizedCurrency = currency === '€' ? 'EUR' : currency;
    
    try {
      const formatted = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true
      }).format(amount);
      
      return formatted;
    } catch (error) {
      console.warn('⚠️ Erreur formatAmount avec devise:', currency, error);
      // Fallback en cas d'erreur
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
  };

  const formatAmountPlain = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(amount || 0);
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDocumentNumber = () => {
    return `FAC-${Date.now().toString().slice(-6)}`;
  };

  const renderFinancialTable = (items, totals) => {
    return (
      <div className="mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Description</th>
              <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700 w-24">Quantité</th>
              <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 w-32">Montant (€)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                  {item.description}
                </td>
                <td className="py-4 px-6 text-sm text-center text-gray-600">
                  {item.quantity || '1'}
                </td>
                <td className="py-4 px-6 text-sm text-right font-semibold text-gray-900">
                  {formatAmountPlain(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {totals.map((total, index) => {
              const isTotalTTC = total.label.includes('TOTAL TTC');
              const isBold = total.label.includes('TOTAL');
              
              return (
                <tr key={index} className={isTotalTTC ? 'bg-blue-50 border-t-2 border-blue-200' : 'border-t border-gray-200'}>
                  <td 
                    colSpan="2" 
                    className={`py-4 px-6 text-sm ${
                      isTotalTTC ? 'font-bold text-blue-700 text-lg' : 
                      isBold ? 'font-semibold text-gray-800' : 
                      'text-gray-600'
                    }`}
                  >
                    {total.label}
                  </td>
                  <td className={`py-4 px-6 text-sm text-right ${
                    isTotalTTC ? 'font-bold text-blue-700 text-lg' : 
                    isBold ? 'font-semibold text-gray-800' : 
                    'text-gray-600'
                  }`}>
                    {formatAmountPlain(total.amount)} €
                  </td>
                </tr>
              );
            })}
          </tfoot>
        </table>
      </div>
    );
  };

  const renderMetadataSection = () => {
    if (!document?.metadata) return null;
    
    return (
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-800 mb-3">INFORMATIONS COMPLÉMENTAIRES</h3>
        
        {document.metadata.notes && (
          <div className="mb-3">
            <p className="text-xs text-yellow-700 font-medium mb-1">Notes:</p>
            <p className="text-sm text-yellow-900">{document.metadata.notes}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-xs">
          {document.metadata.reference && (
            <div>
              <span className="font-medium text-yellow-700">Réf:</span>
              <span className="text-yellow-900 ml-2">{document.metadata.reference}</span>
            </div>
          )}
          
          {document.metadata.dateEcheance && (
            <div>
              <span className="font-medium text-yellow-700">Échéance:</span>
              <span className="text-yellow-900 ml-2">{new Date(document.metadata.dateEcheance).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          
          {document.metadata.lieuSignature && (
            <div>
              <span className="font-medium text-yellow-700">Lieu:</span>
              <span className="text-yellow-900 ml-2">{document.metadata.lieuSignature}</span>
            </div>
          )}
        </div>
        
        {/* Champs SMMA */}
        {document.metadata.periodeFacturation && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-xs text-yellow-700 font-medium mb-1">Période facturation:</p>
            <p className="text-sm text-yellow-900">{document.metadata.periodeFacturation}</p>
          </div>
        )}
        
        {document.metadata.modeReglement && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-xs text-yellow-700 font-medium mb-1">Mode règlement:</p>
            <p className="text-sm text-yellow-900">{document.metadata.modeReglement}</p>
          </div>
        )}
        
        {document.metadata.contactFacturation && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-xs text-yellow-700 font-medium mb-1">Contact facturation:</p>
            <p className="text-sm text-yellow-900">{document.metadata.contactFacturation}</p>
          </div>
        )}
        
        {document.metadata.prestationDetails && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-xs text-yellow-700 font-medium mb-1">Détails prestation:</p>
            <p className="text-sm text-yellow-900">{document.metadata.prestationDetails}</p>
          </div>
        )}
      </div>
    );
  };

  if (!document) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden">
      {/* Header du document preview */}
      <div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {documentType?.label?.toUpperCase() || 'DOCUMENT'}
          </h2>
          <span className="text-sm text-gray-500">
            N° {getDocumentNumber()} • {getCurrentDate()}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>{isPrinting ? 'Impression...' : 'Imprimer'}</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* Contenu du document */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        <div ref={componentRef} className="bg-white max-w-4xl mx-auto shadow-lg print:shadow-none">
          {/* Entête professionnel */}
          <div className="p-8 border-b-2 border-gray-200">
            <div className="flex justify-between items-start mb-6">
              {/* Logo et infos agence */}
              <div className="flex items-start space-x-6">
                {agencyProfile?.logo_url && (
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <img 
                      src={agencyProfile.logo_url} 
                      alt="Logo agence" 
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {agencyProfile?.name || 'Agence'}
                  </h1>
                  <div className="text-sm text-gray-600 space-y-1">
                    {agencyProfile?.address && <p>{agencyProfile.address}</p>}
                    {agencyProfile?.email && <p>{agencyProfile.email}</p>}
                    {agencyProfile?.phone && <p>{agencyProfile.phone}</p>}
                    {agencyProfile?.registrationNumber && (
                      <p className="text-xs text-gray-500">{agencyProfile.registrationNumber}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Informations document */}
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  FACTURE
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="font-semibold">N° {getDocumentNumber()}</p>
                  <p>Date: {getCurrentDate()}</p>
                  <p className="text-xs">Échéance: 30 jours</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bloc client */}
          <div className="p-8 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">CLIENT</h2>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="flex">
                  <span className="text-sm font-semibold text-gray-700 w-20">Nom:</span>
                  <span className="text-sm text-gray-900">{lead?.nom || 'Non spécifié'}</span>
                </div>
                {lead?.email && (
                  <div className="flex">
                    <span className="text-sm font-semibold text-gray-700 w-20">Email:</span>
                    <span className="text-sm text-gray-900">{lead.email}</span>
                  </div>
                )}
                {lead?.telephone && (
                  <div className="flex">
                    <span className="text-sm font-semibold text-gray-700 w-20">Tél:</span>
                    <span className="text-sm text-gray-900">{lead.telephone}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {lead?.budget && (
                  <div className="flex">
                    <span className="text-sm font-semibold text-gray-700 w-20">Budget:</span>
                    <span className="text-sm text-gray-900">{formatAmount(lead.budget)}</span>
                  </div>
                )}
                {lead?.type_bien && (
                  <div className="flex">
                    <span className="text-sm font-semibold text-gray-700 w-20">Projet:</span>
                    <span className="text-sm text-gray-900">{lead.type_bien}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="p-8">
            {/* Section métadonnées optionnelles */}
            {renderMetadataSection()}
            
            {documentType?.id === 'devis' && document.financialData && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6">DEVIS</h2>
                <div className="mb-6">
                  <p className="text-gray-700 mb-4">
                    Nous vous proposons les prestations suivantes pour votre projet immobilier.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Conditions de paiement:</strong> {document.settings?.conditionsPaiement || '50% à la signature, 50% à la livraison'}
                    </p>
                  </div>
                </div>
                
                {renderFinancialTable(document.financialData.items, document.financialData.totals)}
              </>
            )}
            
            {documentType?.id === 'facture' && document.financialData && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6">FACTURE</h2>
                <div className="mb-6">
                  <p className="text-gray-700 mb-4">
                    En règlement de la facture ci-dessous pour les prestations réalisées.
                  </p>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>Conditions de paiement:</strong> {document.settings?.conditionsPaiement || 'Paiement à réception de facture'}
                    </p>
                  </div>
                </div>
                
                {renderFinancialTable(document.financialData.items, document.financialData.totals)}
              </>
            )}
            
            {documentType?.id === 'mandat' && (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold text-gray-900 mb-6">MANDAT EXCLUSIF</h2>
                <div className="text-gray-700 space-y-4">
                  <p>Le soussigné <strong>{lead?.nom || 'Client'}</strong> ci-dessous désigné donne 
                    mandat exclusif à <strong>{agencyProfile?.name || 'Agence'}</strong> pour la vente 
                    du bien situé au [adresse complète du bien].
                  </p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">ARTICLE 1 - DURÉE DU MANDAT</h3>
                  <p>Le présent mandat est conclu pour une durée de 3 (trois) mois à compter de la date de signature.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">ARTICLE 2 - COMMISSION</h3>
                  <p>Une commission de 5% du prix de vente HT sera due par le vendeur au moment de la signature de l'acte de vente.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">ARTICLE 3 - ENGAGEMENTS DES PARTIES</h3>
                  <p>Le vendeur s'engage à ne pas confier de mandat à une autre agence pendant la durée du présent mandat. 
                  L'agence s'engage à assurer la promotion active du bien et à organiser les visites selon la disponibilité du vendeur.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">ARTICLE 4 - RÉSILIATION</h3>
                  <p>Le mandat peut être résilié par anticipation moyennant un préavis de 15 jours.</p>
                </div>
              </div>
            )}
            
            {documentType?.id === 'compromis' && (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold text-gray-900 mb-6">COMPROMIS DE VENTE</h2>
                <div className="text-gray-700 space-y-4">
                  <h3 className="font-semibold text-lg mb-3">PARTIES CONCERNÉES</h3>
                  <p><strong>Vendeur:</strong> [Nom et adresse du vendeur]</p>
                  <p><strong>Acheteur:</strong> {lead?.nom}</p>
                  {lead?.email && <p>Email: {lead.email}</p>}
                  {lead?.telephone && <p>Téléphone: {lead.telephone}</p>}
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">BIEN CONCERNÉ</h3>
                  <p><strong>Adresse:</strong> [adresse complète du bien]</p>
                  <p><strong>Prix de vente:</strong> {formatAmount(lead?.budget || 0)}</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">CLAUSES SUSPENSIVES</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Obtention d'un prêt bancaire (si applicable)</li>
                    <li>Accord de la copropriété (si applicable)</li>
                    <li>Autorisation administrative (si applicable)</li>
                  </ul>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">CONDITIONS FINANCIÈRES</h3>
                  <p><strong>Acompte:</strong> {formatAmount((lead?.budget || 0) * 0.10)} (10% du prix de vente)</p>
                  <p><strong>Solde:</strong> {formatAmount((lead?.budget || 0) * 0.90)} à la levée des clauses suspensives</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3">DÉLAIS</h3>
                  <p><strong>Délai de rétractation:</strong> 10 jours à compter de la signature</p>
                  <p><strong>Date prévisionnelle de signature définitive:</strong> [à déterminer]</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-8">
            <div className="flex justify-between items-end">
              <div className="flex-1">
                <div className="mb-8">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Signature</p>
                  <div className="border-b-2 border-gray-300 w-48"></div>
                </div>
                <p className="text-xs text-gray-500">
                  Fait le {getCurrentDate()}
                </p>
              </div>
              
              <div className="text-right text-xs text-gray-500 max-w-xs">
                {agencyProfile?.legalMention && (
                  <p>{agencyProfile.legalMention}</p>
                )}
                <p className="mt-2">
                  {agencyProfile?.legalName || agencyProfile?.name} • 
                  {agencyProfile?.registrationNumber && ` ${agencyProfile.registrationNumber}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
