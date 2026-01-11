import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/print.css';

const DocumentPreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const componentRef = useRef();
  const [isPrinting, setIsPrinting] = useState(false);
  const [document, setDocument] = useState(null);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction d'impression manuelle pour garantir l'impression instantanée
  const handlePrint = () => {
    setIsPrinting(true);
    
    try {
      // Vérifications approfondies que la page n'est pas dans un modal
      const modalSelectors = [
        '.fixed.inset-0',
        '.modal',
        '.overlay',
        '[role="dialog"]',
        '.fixed.z-50'
      ];
      
      let isInModal = false;
      let modalElement = null;
      
      for (const selector of modalSelectors) {
        modalElement = document.querySelector(selector);
        if (modalElement && modalElement.contains(componentRef.current)) {
          isInModal = true;
          break;
        }
      }
      
      // Vérification supplémentaire : si le body a overflow hidden
      const bodyOverflow = window.getComputedStyle(document.body).overflow;
      if (bodyOverflow === 'hidden' || bodyOverflow === 'clip') {
        console.warn('Le body a overflow hidden, probablement dans un modal');
        isInModal = true;
      }
      
      // Vérification : si le document n'est pas le premier élément visible
      const documentRect = componentRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      if (documentRect.width < viewportWidth * 0.8 || documentRect.height < viewportHeight * 0.8) {
        console.warn('Le document semble être dans un conteneur plus petit que la fenêtre');
        isInModal = true;
      }
      
      if (isInModal) {
        console.warn('Le document est dans un modal, utilisation du fallback iframe');
        // Fallback : extraire le contenu et l'imprimer dans une nouvelle fenêtre
        printWithIframe();
        return;
      }
      
      // Focus sur la fenêtre actuelle
      window.focus();
      
      // S'assurer que la page est bien visible
      if (document.hidden) {
        console.warn('La page est cachée, tentative de focus');
        window.focus();
      }
      
      // Timeout pour s'assurer que le focus est bien appliqué
      setTimeout(() => {
        try {
          // Tenter l'impression directe
          console.log('Tentative d\'impression directe');
          window.print();
          
          // Timeout pour réinitialiser l'état d'impression
          setTimeout(() => {
            setIsPrinting(false);
            console.log('Impression directe terminée');
          }, 1000);
          
        } catch (error) {
          console.error('Erreur lors de l\'impression directe:', error);
          // Fallback : utiliser iframe
          printWithIframe();
        }
      }, 100);
      
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      // Fallback : utiliser iframe
      printWithIframe();
    }
  };

  // Fallback avec iframe pour les navigateurs récalcitrants
  const printWithIframe = () => {
    try {
      console.log('Création de l\'iframe pour l\'impression');
      
      // Créer un iframe caché
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '210mm'; // Largeur A4
      iframe.style.height = '297mm'; // Hauteur A4
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.id = 'print-iframe';
      
      document.body.appendChild(iframe);
      
      // Attendre que l'iframe soit ajouté au DOM
      setTimeout(() => {
        try {
          // Écrire le contenu du document dans l'iframe
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const documentContent = componentRef.current.innerHTML;
          
          // Récupérer tous les styles de la page actuelle
          const allStyles = Array.from(document.styleSheets)
            .map(styleSheet => {
              try {
                return Array.from(styleSheet.cssRules)
                  .map(rule => rule.cssText)
                  .join('\n');
              } catch (e) {
                return '';
              }
            })
            .join('\n');
          
          // Ajouter le CSS d'impression et les styles de la page
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Document à imprimer</title>
                <style>
                  ${allStyles}
                  
                  /* Styles d'impression spécifiques */
                  @page {
                    size: A4;
                    margin: 15mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                    background: white !important;
                  }
                  .document-container {
                    width: 100%;
                    max-width: none;
                    margin: 0;
                    padding: 2rem;
                    box-shadow: none;
                    background: white !important;
                  }
                  .document-content {
                    width: 100%;
                    max-width: none;
                    margin: 0;
                    padding: 0;
                    overflow: visible;
                  }
                  table {
                    page-break-inside: avoid;
                    width: 100%;
                    border-collapse: collapse;
                  }
                  .no-break {
                    page-break-inside: avoid;
                  }
                  .p-8 {
                    page-break-inside: avoid;
                  }
                  h1, h2, h3 {
                    page-break-after: avoid;
                    page-break-inside: avoid;
                  }
                  @media print {
                    body { 
                      print-color-adjust: exact;
                      -webkit-print-color-adjust: exact;
                    }
                    .bg-gray-50,
                    .bg-blue-50,
                    .bg-yellow-50 {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                    .border,
                    .border-t,
                    .border-b,
                    .border-l,
                    .border-r {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                  }
                </style>
              </head>
              <body>
                ${documentContent}
                <script>
                  // S'assurer que l'impression se déclenche après le chargement
                  window.onload = function() {
                    setTimeout(function() {
                      console.log('Impression depuis iframe');
                      window.focus();
                      window.print();
                    }, 300);
                  };
                </script>
              </body>
            </html>
          `);
          iframeDoc.close();
          
          // Attendre que le contenu soit rendu
          setTimeout(() => {
            try {
              // Imprimer depuis l'iframe
              console.log('Tentative d\'impression depuis iframe');
              iframe.contentWindow.focus();
              
              // Vérifier si le navigateur supporte print() dans iframe
              if (typeof iframe.contentWindow.print === 'function') {
                iframe.contentWindow.print();
              } else {
                // Fallback : ouvrir dans une nouvelle fenêtre
                console.warn('print() non supporté dans iframe, fallback vers nouvelle fenêtre');
                document.body.removeChild(iframe);
                printWithNewWindow();
                return;
              }
              
              // Nettoyer l'iframe après impression
              setTimeout(() => {
                try {
                  if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                  }
                } catch (e) {
                  console.warn('Erreur lors du nettoyage de l\'iframe:', e);
                }
                setIsPrinting(false);
                console.log('Impression iframe terminée');
              }, 3000);
              
            } catch (printError) {
              console.error('Erreur lors de l\'impression depuis iframe:', printError);
              try {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              } catch (e) {
                console.warn('Erreur lors du nettoyage de l\'iframe:', e);
              }
              setIsPrinting(false);
              
              // Dernier fallback : ouvrir dans une nouvelle fenêtre
              printWithNewWindow();
            }
          }, 800);
          
        } catch (contentError) {
          console.error('Erreur lors de l\'écriture dans l\'iframe:', contentError);
          try {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          } catch (e) {
            console.warn('Erreur lors du nettoyage de l\'iframe:', e);
          }
          setIsPrinting(false);
          printWithNewWindow();
        }
      }, 100);
      
    } catch (iframeError) {
      console.error('Erreur lors de la création de l\'iframe:', iframeError);
      setIsPrinting(false);
      printWithNewWindow();
    }
  };

  // Dernier fallback : nouvelle fenêtre
  const printWithNewWindow = () => {
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      const documentContent = componentRef.current.innerHTML;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document à imprimer</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              }
              .document-container {
                width: 100%;
                max-width: none;
                margin: 0;
                padding: 2rem;
                box-shadow: none;
              }
              table {
                page-break-inside: avoid;
                width: 100%;
                border-collapse: collapse;
              }
              .no-break {
                page-break-inside: avoid;
              }
            </style>
          </head>
          <body>
            ${documentContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 500);
              }
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      setIsPrinting(false);
      
    } catch (newWindowError) {
      console.error('Erreur lors de l\'ouverture de la nouvelle fenêtre:', newWindowError);
      setIsPrinting(false);
      alert('Impossible d\'ouvrir la fenêtre d\'impression. Veuillez utiliser Ctrl+P (ou Cmd+P sur Mac).');
    }
  };

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
      <div className="mb-8 no-break">
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
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg no-break">
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

  useEffect(() => {
    // Charger les données du document depuis localStorage ou API
    const loadDocument = () => {
      try {
        const storedData = localStorage.getItem(`document_${id}`);
        if (storedData) {
          const data = JSON.parse(storedData);
          setDocument(data.document);
          setAgencyProfile(data.agencyProfile);
          setLead(data.lead);
        } else {
          // Si pas de données, rediriger vers le dashboard
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Erreur lors du chargement du document:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Document non trouvé</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header minimal pour les actions (masqué à l'impression) */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Retour</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              {document.type?.label?.toUpperCase() || 'DOCUMENT'}
            </h1>
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
              onClick={() => {
                // Simuler un téléchargement PDF via impression
                window.print();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Télécharger PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu du document - plein écran */}
      <div className="document-content">
        <div 
          ref={componentRef} 
          className="document-container bg-white max-w-4xl mx-auto shadow-lg print:shadow-none"
          style={{ 
            minHeight: '100vh',
            padding: '2rem',
            margin: '0 auto'
          }}
        >
          {/* Entête professionnel */}
          <div className="p-8 border-b-2 border-gray-200 no-break">
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
                  {document.type?.label?.toUpperCase() || 'DOCUMENT'}
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
          <div className="p-8 bg-gray-50 border-b border-gray-200 no-break">
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
          <div className="p-8 document-content">
            {/* Section métadonnées optionnelles */}
            {renderMetadataSection()}
            
            {document.type?.id === 'devis' && document.financialData && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6 no-break">DEVIS</h2>
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
            
            {document.type?.id === 'facture' && document.financialData && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6 no-break">FACTURE</h2>
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
            
            {document.type?.id === 'mandat' && (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold text-gray-900 mb-6 no-break">MANDAT EXCLUSIF</h2>
                <div className="text-gray-700 space-y-4">
                  <p>Le soussigné <strong>{lead?.nom || 'Client'}</strong> ci-dessous désigné donne 
                    mandat exclusif à <strong>{agencyProfile?.name || 'Agence'}</strong> pour la vente 
                    du bien situé au [adresse complète du bien].
                  </p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">ARTICLE 1 - DURÉE DU MANDAT</h3>
                  <p>Le présent mandat est conclu pour une durée de 3 (trois) mois à compter de la date de signature.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">ARTICLE 2 - COMMISSION</h3>
                  <p>Une commission de 5% du prix de vente HT sera due par le vendeur au moment de la signature de l'acte de vente.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">ARTICLE 3 - ENGAGEMENTS DES PARTIES</h3>
                  <p>Le vendeur s'engage à ne pas confier de mandat à une autre agence pendant la durée du présent mandat. 
                  L'agence s'engage à assurer la promotion active du bien et à organiser les visites selon la disponibilité du vendeur.</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">ARTICLE 4 - RÉSILIATION</h3>
                  <p>Le mandat peut être résilié par anticipation moyennant un préavis de 15 jours.</p>
                </div>
              </div>
            )}
            
            {document.type?.id === 'compromis' && (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold text-gray-900 mb-6 no-break">COMPROMIS DE VENTE</h2>
                <div className="text-gray-700 space-y-4">
                  <h3 className="font-semibold text-lg mb-3 no-break">PARTIES CONCERNÉES</h3>
                  <p><strong>Vendeur:</strong> [Nom et adresse du vendeur]</p>
                  <p><strong>Acheteur:</strong> {lead?.nom}</p>
                  {lead?.email && <p>Email: {lead.email}</p>}
                  {lead?.telephone && <p>Téléphone: {lead.telephone}</p>}
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">BIEN CONCERNÉ</h3>
                  <p><strong>Adresse:</strong> [adresse complète du bien]</p>
                  <p><strong>Prix de vente:</strong> {formatAmount(lead?.budget || 0)}</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">CLAUSES SUSPENSIVES</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Obtention d'un prêt bancaire (si applicable)</li>
                    <li>Accord de la copropriété (si applicable)</li>
                    <li>Autorisation administrative (si applicable)</li>
                  </ul>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">CONDITIONS FINANCIÈRES</h3>
                  <p><strong>Acompte:</strong> {formatAmount((lead?.budget || 0) * 0.10)} (10% du prix de vente)</p>
                  <p><strong>Solde:</strong> {formatAmount((lead?.budget || 0) * 0.90)} à la levée des clauses suspensives</p>
                  
                  <h3 className="font-semibold text-lg mt-6 mb-3 no-break">DÉLAIS</h3>
                  <p><strong>Délai de rétractation:</strong> 10 jours à compter de la signature</p>
                  <p><strong>Date prévisionnelle de signature définitive:</strong> [à déterminer]</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-8 no-break">
            <div className="flex justify-between items-end">
              <div className="flex-1">
                <div className="mb-8">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Signature et cachet</p>
                  <div className="border-b-2 border-gray-400 w-64 h-12"></div>
                </div>
                <p className="text-sm text-gray-600">
                  Fait à {document.metadata?.lieuSignature || agencyProfile?.address?.split(',')[0] || 'Paris'}, le {getCurrentDate()}
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

export default DocumentPreviewPage;
