import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/print.css';
import '../styles/invoice-quote.css';
import { DocumentCounterService } from '../services/documentCounterService';

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
  const [isSaving, setIsSaving] = useState(false);

  // Fonction d'impression avec nom de fichier personnalisé
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: DocumentCounterService.generatePdfFileName(
      document?.document_number,
      type
    ),
    onBeforeGetContent: () => {
      setIsPrinting(true);
    },
    onAfterPrint: () => {
      setIsPrinting(false);
    },
    onPrintError: (error) => {
      console.error('❌ Erreur impression:', error);
      setIsPrinting(false);
      alert('Erreur lors de l\'impression. Veuillez réessayer.');
    }
  });

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDocumentNumber = () => {
    // Si le document a été enregistré, afficher le numéro généré
    if (document?.document_number) {
      return document.document_number;
    }
    // Sinon, afficher "Aperçu" pour indiquer que ce n'est pas encore validé
    return `${type === 'devis' ? 'DEVIS' : 'FACTURE'} (Aperçu)`;
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
    // Si le document a été enregistré, afficher le numéro généré
    if (document?.document_number) {
      return document.document_number;
    }
    // Sinon, afficher "Aperçu" pour indiquer que ce n'est pas encore validé
    return `${type === 'devis' ? 'DEVIS' : 'FACTURE'} (Aperçu)`;
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

  // Fonction pour enregistrer le document avec numéro unique
  const handleSaveDocument = async () => {
    if (!agencyProfile?.user_id) {
      alert('Erreur : utilisateur non identifié');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log(`🔢 Génération numéro pour ${type}...`);
      
      // 1. Générer le numéro unique via RPC
      const documentNumber = await DocumentCounterService.generateDocumentNumber(
        type === 'devis' ? 'devis' : 'facture',
        agencyProfile.user_id
      );
      
      console.log(`✅ Numéro généré: ${documentNumber.formatted}`);
      
      // 2. Préparer les données du document
      const updatedDocument = {
        ...document,
        document_number: documentNumber.formatted,
        document_type: type,
        organization_id: agencyProfile.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'saved',
        // Ajouter le montant en lettres
        amount_in_words: DocumentCounterService.formatAmountInWords(
          document.total_amount,
          document.currency || 'EUR',
          true
        )
      };
      
      // 3. Sauvegarder dans la base de données
      const { data: savedDocument, error: saveError } = await supabase
        .from('documents')
        .insert(updatedDocument)
        .select()
        .single();
      
      if (saveError) {
        console.error('❌ Erreur sauvegarde document:', saveError);
        throw new Error('Erreur lors de la sauvegarde du document');
      }
      
      // 4. Mettre à jour l'état local
      setDocument(savedDocument);
      
      // 5. Nettoyer localStorage
      localStorage.removeItem(`document_${id}`);
      
      console.log(`✅ Document enregistré avec succès: ${documentNumber.formatted}`);
      alert(`Document enregistré avec succès !\nNuméro : ${documentNumber.formatted}`);
      
    } catch (error) {
      console.error('❌ Erreur enregistrement document:', error);
      alert(`Erreur lors de l'enregistrement : ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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
        console.log('Tentative de chargement du document:', id);
        console.log('Clé localStorage:', `document_${id}`);
        
        const storedData = localStorage.getItem(`document_${id}`);
        console.log('Données trouvées dans localStorage:', storedData ? 'OUI' : 'NON');
        
        if (storedData) {
          const data = JSON.parse(storedData);
          console.log('Données parsées:', data);
          
          setDocument(data.document);
          setAgencyProfile(data.agencyProfile);
          setLead(data.lead);
          
          // Vérifier si page 2 est nécessaire
          const hasManyItems = data.document?.financialData?.items?.length > 5;
          const hasLongNotes = data.document?.metadata?.notes?.length > 200;
          setShowPage2(hasManyItems || hasLongNotes);
          
          console.log('Document chargé avec succès');
        } else {
          console.warn('Aucune donnée trouvée dans localStorage pour:', id);
          console.log('Contenu actuel de localStorage:', Object.keys(localStorage));
          
          // Si pas de données, rediriger vers le dashboard avec un message
          alert('Document non trouvé. Veuillez générer un nouveau document.');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Erreur lors du chargement du document:', error);
        console.error('Détails de l\'erreur:', error.message);
        alert('Erreur lors du chargement du document. Veuillez réessayer.');
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
            
            {/* Bouton Enregistrer - seulement si le document n'a pas encore de numéro */}
            {!document?.document_number && (
              <button
                onClick={handleSaveDocument}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                </svg>
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            )}
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
