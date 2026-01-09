import React, { useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const DocumentPdfLayout = ({ 
  document, 
  agencyProfile, 
  lead, 
  onPdfGenerated,
  onPrintReady 
}) => {
  const pdfRef = useRef(null);

  // Générer un numéro de document auto-incrémenté
  const generateDocumentNumber = async () => {
    try {
      // Pour l'instant, générer un numéro basé sur timestamp et agence
      const agencyId = agencyProfile?.id || 'unknown';
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `${agencyId.toUpperCase()}-${timestamp.toString().slice(-6)}-${random}`;
    } catch (error) {
      console.error('Erreur génération numéro document:', error);
      return `DOC-${Date.now().toString().slice(-6)}`;
    }
  };

  // Formater les montants correctement
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Convertir le montant en lettres (optionnel)
  const amountToWords = (amount) => {
    if (!amount) return '';
    
    // Implémentation simple pour les montants en euros
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    const euros = Math.floor(amount);
    const centimes = Math.round((amount - euros) * 100);
    
    let result = '';
    
    if (euros === 0) {
      result = 'zéro';
    } else if (euros < 10) {
      result = units[euros];
    } else if (euros < 20) {
      result = teens[euros - 10];
    } else if (euros < 100) {
      const ten = Math.floor(euros / 10);
      const unit = euros % 10;
      result = tens[ten];
      if (unit > 0) {
        result += '-' + units[unit];
      }
    } else {
      // Simplification pour les centaines
      const hundred = Math.floor(euros / 100);
      const remainder = euros % 100;
      if (hundred === 1) {
        result = 'cent';
      } else {
        result = units[hundred] + ' cent';
      }
      if (remainder > 0) {
        result += ' ' + amountToWords(remainder);
      }
    }
    
    result += ' euro' + (euros > 1 ? 's' : '');
    
    if (centimes > 0) {
      result += ' et ' + centimes + ' centime' + (centimes > 1 ? 's' : '');
    }
    
    return result;
  };

  // Générer le PDF à partir du HTML EXACT de la preview
  const generatePdfFromHtml = () => {
    return new Promise(async (resolve, reject) => {
      try {
        const docNumber = await generateDocumentNumber();
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Récupérer le contenu HTML EXACT de la preview
        const previewElement = document.querySelector('.document-preview-content');
        if (!previewElement) {
          reject(new Error('Contenu preview non trouvé'));
          return;
        }

        // Utiliser html2canvas pour capturer le HTML EXACT
        import('html2canvas').then(html2canvas => {
          html2canvas.default(previewElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: previewElement.scrollWidth,
            height: previewElement.scrollHeight
          }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 170; // 170mm pour le contenu
            const imgHeight = Math.min((canvas.height * imgWidth) / canvas.width, 257); // Max 257mm pour A4

            pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);

            // Ajouter le numéro de document en en-tête si nécessaire
            pdf.setFontSize(8);
            pdf.setTextColor(128, 128, 128);
            pdf.text(`N°: ${docNumber}`, 20, 15);

            resolve(pdf);
          }).catch(error => {
            console.error('Erreur html2canvas:', error);
            reject(error);
          });
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Télécharger le PDF avec nom formaté
  const downloadPdf = async () => {
    try {
      const docNumber = await generateDocumentNumber();
      const pdf = await generatePdfFromHtml();
      
      // Nom de fichier formaté selon les spécifications
      const docType = document?.type?.label || 'Document';
      const clientName = lead?.nom || 'Client';
      const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${docType}_${docNumber}_${cleanClientName}.pdf`;
      
      pdf.save(filename);
    } catch (error) {
      console.error('Erreur lors du téléchargement PDF:', error);
      alert('Erreur lors du téléchargement PDF');
    }
  };

  // Exposer les fonctions au parent
  useEffect(() => {
    if (onPdfGenerated) {
      const actions = {
        download: downloadPdf
      };
      onPdfGenerated(actions);
    }
  }, [onPdfGenerated]);

  // Le composant ne rend rien (invisible)
  return null;
};

export default DocumentPdfLayout;
