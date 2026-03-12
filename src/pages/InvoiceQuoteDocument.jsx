import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/print.css';
import '../styles/invoice-quote.css';
import { DocumentCounterService } from '../services/documentCounterService';
import { downloadDocumentAsPdf } from '../components/DocumentTemplate';
import { supabase } from '../supabaseClient';

const InvoiceQuoteDocument = () => {
  const { id, type } = useParams(); // type = 'devis' ou 'facture'
  const navigate = useNavigate();
  const componentRef = useRef();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [document, setDocument] = useState(null);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPage2, setShowPage2] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAmountInWords, setShowAmountInWords] = useState(true); // Paramètre utilisateur

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

  // Téléchargement PDF via html2pdf.js (pixel-perfect, sans dialogue navigateur)
  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = DocumentCounterService.generatePdfFileName(
        document?.document_number,
        type
      );
      await downloadDocumentAsPdf('invoice-quote-print-area', filename);
    } catch (err) {
      console.error('❌ Erreur téléchargement PDF:', err);
      alert('Erreur lors du téléchargement PDF. Réessayez ou utilisez "Imprimer".');
    } finally {
      setIsDownloading(false);
    }
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDocumentNumber = () => {
    // 🎯 LOG CRITIQUE : Voir le contenu de document
    console.log("📋 InvoiceQuoteDocument - document complet =", document);
    console.log("📋 InvoiceQuoteDocument - document.number =", document?.number);
    console.log("📋 InvoiceQuoteDocument - document.document_number =", document?.document_number);
    
    // Si le document a été enregistré, afficher le numéro généré
    if (document?.number) {
      return document.number;
    }
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
    // 🛡️ PROTECTION ANTI-DOUBLE APPEL
    if (isSaving) {
      console.log("⏳ Enregistrement déjà en cours...");
      return;
    }
    
    if (document?.document_number) {
      console.log("⚠️ Document déjà enregistré, numéro:", document.document_number);
      return;
    }
    
    if (!agencyProfile?.agency_id) {
      alert('Erreur : agence non identifiée');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log(`🔢 Génération numéro pour ${type}...`);
      
      // 🎯 LOG CRITIQUE : Structure complète d'agencyProfile
      console.log("📋 agencyProfile complet =", agencyProfile);
      
      // 🎯 LOG CRITIQUE : UUID EXACT envoyé à la RPC
      console.log(
        "ORG_ID envoyé à generate_document_number =",
        agencyProfile.agency_id
      );
      
      // 1. GÉNÉRATION UNIQUE - UN SEUL APPEL
      const documentNumber = await DocumentCounterService.generateDocumentNumber(
        type === 'devis' ? 'devis' : 'facture',
        agencyProfile.agency_id
      );
      
      // 2. STOCKAGE LOCAL - RÉUTILISATION UNIQUE
      console.log(`📄 Numéro de document généré: ${documentNumber}`);
      
      // 3. PRÉPARATION DES DONNÉES
      const updatedDocument = {
        ...document,
        document_number: documentNumber,
        document_type: type,
        organization_id: agencyProfile.agency_id,
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
      
      // 🎯 LOG CRITIQUE : Vérifier la mise à jour de l'état
      console.log("🔄 État document mis à jour:", savedDocument);
      console.log("🔄 document.document_number après MAJ:", savedDocument?.document_number);
      
      // 5. Nettoyer localStorage
      localStorage.removeItem(`document_${id}`);
      
      console.log(`✅ Document enregistré avec succès: ${documentNumber}`);
      alert(`Document enregistré avec succès !\nNuméro : ${documentNumber}`);
      
    } catch (error) {
      console.error('❌ Erreur enregistrement document:', error);
      alert(`Erreur lors de l'enregistrement : ${error.message}`);
    } finally {
      setIsSaving(false);
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
      
      return formatted;
    } catch (error) {
      console.warn('⚠️ Erreur formatAmount avec devise:', currency, error);
      // Fallback en cas d'erreur
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
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
                style={{ maxHeight: '80px' }}
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

  const renderClientInfo = () => {
    return (
      <div className="client-info-section no-break">
        <div className="client-details">
          <h3>Informations Client</h3>
          <p><strong>Nom:</strong> {lead?.nom || 'N/A'}</p>
          <p><strong>Email:</strong> {lead?.email || 'N/A'}</p>
          <p><strong>Téléphone:</strong> {lead?.telephone || 'N/A'}</p>
          {lead?.adresse && <p><strong>Adresse:</strong> {lead.adresse}</p>}
        </div>
      </div>
    );
  };

  const renderItemsTable = () => {
    const items = document?.items || [];
    
    if (items.length === 0) {
      return (
        <div className="no-items">
          <p>Aucun article dans ce document</p>
        </div>
      );
    }

    return (
      <div className="items-table no-break">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatAmount(item.unit_price)}</td>
                <td>{formatAmount(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTotals = () => {
    const subtotal = document?.subtotal || 0;
    const taxRate = document?.tax_rate || 20;
    const taxAmount = document?.tax_amount || (subtotal * taxRate / 100);
    const total = document?.total_amount || (subtotal + taxAmount);

    return (
      <div className="totals-section no-break">
        <div className="totals-container">
          <div className="total-row">
            <span>Sous-total:</span>
            <span>{formatAmount(subtotal)}</span>
          </div>
          <div className="total-row">
            <span>TVA ({taxRate}%):</span>
            <span>{formatAmount(taxAmount)}</span>
          </div>
          <div className="total-row grand-total">
            <span>Total:</span>
            <span>{formatAmount(total)}</span>
          </div>
          
          {/* Montant en lettres - avec paramètre utilisateur */}
          {showAmountInWords && document?.amount_in_words && (
            <div className="amount-in-words">
              <p className="text-sm text-gray-600 italic">
                {document.amount_in_words}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Charger les données du document depuis localStorage ou API
    const loadDocument = () => {
      try {
        console.log('Tentative de chargement du document:', id);
        
        const storedData = localStorage.getItem(`document_${id}`);
        
        if (storedData) {
          const data = JSON.parse(storedData);
          console.log('Données parsées:', data);
          
          setDocument(data.document);
          setAgencyProfile(data.agencyProfile);
          setLead(data.lead);
          
        } else {
          console.error('Aucune donnée trouvée dans localStorage');
          navigate('/documents');
        }
        
      } catch (error) {
        console.error('Erreur chargement document:', error);
        navigate('/documents');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadDocument();
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (!document || !agencyProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Document non trouvé</p>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour aux documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Retour</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              {type === 'devis' ? 'DEVIS' : 'FACTURE'} N°{getDocumentNumber()}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* ⬇️ Télécharger PDF (html2pdf — sans dialogue navigateur) */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isDownloading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span>{isDownloading ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>

            {/* 🖨️ Imprimer (react-to-print) */}
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

            {/* Panneau de paramètres */}
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showAmountInWords}
                  onChange={(e) => setShowAmountInWords(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span>Montant en lettres</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu du document - plein écran */}
      <div className="document-content">
        <div
          id="invoice-quote-print-area"
          ref={componentRef}
          className="document-container invoice-quote-document bg-white max-w-4xl mx-auto shadow-lg print:shadow-none"
          style={{
            minHeight: '100vh',
            padding: '2rem',
          }}
        >
          {/* En-tête du document */}
          {renderHeader()}
          
          {/* Informations client */}
          {renderClientInfo()}
          
          {/* Tableau des articles */}
          {renderItemsTable()}
          
          {/* Totaux */}
          {renderTotals()}
          
          {/* Notes et conditions */}
          {document?.notes && (
            <div className="notes-section no-break">
              <h3>Notes</h3>
              <p>{document.notes}</p>
            </div>
          )}
          
          {document?.payment_terms && (
            <div className="payment-terms no-break">
              <h3>Conditions de paiement</h3>
              <p>{document.payment_terms}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceQuoteDocument;
