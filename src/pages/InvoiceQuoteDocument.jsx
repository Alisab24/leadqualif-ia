import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/print.css';
import '../styles/invoice-quote.css';

const InvoiceQuoteDocument = () => {
  const { id, type } = useParams(); // type = 'devis' ou 'facture'
  const navigate = useNavigate();
  const componentRef = useRef();
  const [isPrinting, setIsPrinting] = useState(false);
  const [document, setDocument] = useState(null);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPage2, setShowPage2] = useState(false);

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
                <title>${type === 'devis' ? 'DEVIS' : 'FACTURE'} à imprimer</title>
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
            <title>${type === 'devis' ? 'DEVIS' : 'FACTURE'} à imprimer</title>
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

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined || amount === 0) {
      return '0 €';
    }
    
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(amount);
    
    return formatted;
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
    const prefix = type === 'devis' ? 'DEV' : 'FAC';
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  };

  const getEcheanceDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const amountToWords = (amount) => {
    // Conversion simplifiée en lettres (à améliorer avec une librairie)
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
    if (amount < 1000) {
      return `${units[Math.floor(amount / 100)] ? units[Math.floor(amount / 100)] + ' cent' : ''} ${units[amount % 100]}`.trim();
    }
    return formatAmount(amount); // Fallback
  };

  const renderHeader = () => {
    return (
      <div className="invoice-header no-break">
        {/* À gauche - Infos agence */}
        <div className="agency-info">
          {agencyProfile?.logo_url && (
            <div className="agency-logo">
              <img 
                src={agencyProfile.logo_url} 
                alt="Logo agence" 
              />
            </div>
          )}
          <div className="agency-details">
            <h2>{agencyProfile?.name || 'Agence'}</h2>
            <div className="document-meta">
              {agencyProfile?.address && <p>{agencyProfile.address}</p>}
              {agencyProfile?.email && <p>{agencyProfile.email}</p>}
              {agencyProfile?.phone && <p>{agencyProfile.phone}</p>}
            </div>
          </div>
        </div>
        
        {/* À droite - Infos document */}
        <div className="document-info">
          <div className="document-title">
            {type === 'devis' ? 'DEVIS' : 'FACTURE'}
          </div>
          <div className="document-meta">
            <p className="font-semibold">N° {getDocumentNumber()}</p>
            <p>Date: {getCurrentDate()}</p>
            {type === 'facture' && <p>Échéance: {getEcheanceDate()}</p>}
            <p>Devise: EUR</p>
          </div>
        </div>
      </div>
    );
  };

  const renderClientBlock = () => {
    return (
      <div className="client-block no-break">
        <h3>CLIENT</h3>
        <div className="client-grid">
          {/* Colonne gauche */}
          <div className="client-column">
            <div className="client-row">
              <span className="label">Nom:</span>
              <span className="value">{lead?.nom || 'Non spécifié'}</span>
            </div>
            {lead?.email && (
              <div className="client-row">
                <span className="label">Email:</span>
                <span className="value">{lead.email}</span>
              </div>
            )}
            {lead?.telephone && (
              <div className="client-row">
                <span className="label">Tél:</span>
                <span className="value">{lead.telephone}</span>
              </div>
            )}
          </div>
          
          {/* Colonne droite */}
          <div className="client-column">
            <div className="client-row">
              <span className="label">Projet:</span>
              <span className="value">{lead?.type_bien || 'Non spécifié'}</span>
            </div>
            {lead?.budget && (
              <div className="client-row">
                <span className="label">Budget:</span>
                <span className="value">{formatAmount(lead.budget)}</span>
              </div>
            )}
            <div className="client-row">
              <span className="label">Source:</span>
              <span className="value">Formulaire IA</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCentralTable = () => {
    if (!document?.financialData?.items || document.financialData.items.length === 0) {
      return null;
    }

    return (
      <div className="central-table no-break">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-center">Qté</th>
              <th className="text-right">Prix unitaire</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {document.financialData.items.map((item, index) => (
              <tr key={index}>
                <td className="description">{item.description}</td>
                <td className="quantity text-center">{item.quantity || '1'}</td>
                <td className="unit-price text-right">{formatAmountPlain(item.amount)} €</td>
                <td className="line-total text-right">{formatAmountPlain(item.amount)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTotalsZone = () => {
    if (!document?.financialData?.totals) {
      return null;
    }

    const totalTTC = document.financialData.totals.find(t => t.label.includes('TOTAL TTC'));
    const subTotal = document.financialData.totals.find(t => t.label.includes('HT'));
    const tva = document.financialData.totals.find(t => t.label.includes('TVA'));

    return (
      <div className="totals-zone no-break">
        <div className="totals-container">
          {/* Tableau des totaux */}
          <table className="totals-table">
            <tbody>
              {subTotal && (
                <tr>
                  <td className="label">Sous-total HT</td>
                  <td className="amount">{formatAmountPlain(subTotal.amount)} €</td>
                </tr>
              )}
              {tva && (
                <tr>
                  <td className="label">TVA ({document.settings?.tva || 20}%)</td>
                  <td className="amount">{formatAmountPlain(tva.amount)} €</td>
                </tr>
              )}
              {totalTTC && (
                <tr className="total-ttc-row">
                  <td className="label">TOTAL TTC</td>
                  <td className="amount">{formatAmountPlain(totalTTC.amount)} €</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Montant en lettres */}
          {totalTTC && (
            <div className="amount-in-words">
              <div className="label">
                Arrêté la présente {type === 'devis' ? 'devis' : 'facture'} à la somme de :
              </div>
              <div className="amount-text">
                {amountToWords(totalTTC.amount)} euros TTC
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConditionsMentions = () => {
    return (
      <div className="conditions-mentions no-break">
        <div className="conditions-grid">
          {/* Conditions de paiement */}
          <div>
            <h4>Conditions de paiement</h4>
            <p>
              {document?.settings?.conditionsPaiement || 
               (type === 'devis' ? '50% à la signature, 50% à la livraison' : 'Paiement à réception de facture')}
            </p>
          </div>
          
          {/* Mentions légales */}
          <div>
            <h4>Mentions légales</h4>
            <div>
              {agencyProfile?.legalName && <p>{agencyProfile.legalName}</p>}
              {agencyProfile?.registrationNumber && <p>{agencyProfile.registrationNumber}</p>}
              {agencyProfile?.legalMention && <p>{agencyProfile.legalMention}</p>}
              <p>Pays: France | Devise: EUR</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSignature = () => {
    return (
      <div className="signature-block no-break">
        <div className="signature-grid">
          {/* Signature agence */}
          <div className="signature-column">
            <div className="signature-label">Signature agence</div>
            <div className="signature-line"></div>
            <div className="signature-name">
              {agencyProfile?.name || 'Agence'}
            </div>
          </div>
          
          {/* Signature client */}
          <div className="signature-column">
            <div className="signature-label">Signature client</div>
            <div className="signature-line"></div>
            <div className="signature-name">
              {lead?.nom || 'Client'}
            </div>
          </div>
        </div>
        
        {/* Lieu + date */}
        <div className="location-date">
          Fait à {document?.metadata?.lieuSignature || agencyProfile?.address?.split(',')[0] || 'Paris'}, le {getCurrentDate()}
        </div>
      </div>
    );
  };

  const renderPage2 = () => {
    if (!showPage2) return null;

    return (
      <div className="page-2">
        <div className="document-container">
          <div className="page-header">
            <h2 className="page-title">ANNEXE</h2>
          </div>
          
          {/* Contenu de la page 2 - conditions détaillées, annexes IA, etc. */}
          <div className="annex-content">
            <div className="annex-section">
              <h3>Conditions complémentaires</h3>
              <div>
                <p>
                  Les présentes conditions générales s'appliquent à l'ensemble des prestations 
                  fournies par {agencyProfile?.name || 'l\'agence'} dans le cadre du présent 
                  {type === 'devis' ? ' devis' : ' contrat'}.
                </p>
                
                {/* Ajouter ici le contenu spécifique à la page 2 */}
                {document?.metadata?.notes && (
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">Notes complémentaires</h4>
                    <p className="text-yellow-900">{document.metadata.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
          
          // Vérifier si page 2 est nécessaire
          const hasManyItems = data.document?.financialData?.items?.length > 5;
          const hasLongNotes = data.document?.metadata?.notes?.length > 200;
          setShowPage2(hasManyItems || hasLongNotes);
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
              {type === 'devis' ? 'DEVIS' : 'FACTURE'} N°{getDocumentNumber()}
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
          className="document-container invoice-quote-document bg-white max-w-4xl mx-auto shadow-lg print:shadow-none"
          style={{ 
            minHeight: '100vh',
            padding: '2rem',
            margin: '0 auto'
          }}
        >
          {/* 1️⃣ HEADER (compact, premium, Stripe-like) */}
          {renderHeader()}
          
          {/* 2️⃣ BLOC CLIENT (lisible – 2 colonnes) */}
          {renderClientBlock()}
          
          {/* 3️⃣ TABLEAU CENTRAL (CŒUR DU DOCUMENT) */}
          {renderCentralTable()}
          
          {/* 4️⃣ ZONE TOTAUX (très lisible) */}
          {renderTotalsZone()}
          
          {/* 5️⃣ CONDITIONS & MENTIONS (compact) */}
          {renderConditionsMentions()}
          
          {/* 6️⃣ SIGNATURE (SUR LA MÊME PAGE) */}
          {renderSignature()}
        </div>
        
        {/* 9️⃣ CAS PAGE 2 (EXCEPTION) */}
        {renderPage2()}
      </div>
    </div>
  );
};

export default InvoiceQuoteDocument;
