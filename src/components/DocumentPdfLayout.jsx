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
  // Format A4 constants
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PADDING_MM = 20;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - (2 * PADDING_MM);

  // Formater les montants
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  // Vérifier si page 2 est nécessaire
  const needsPage2 = () => {
    const itemCount = document?.financialData?.items?.length || 0;
    const hasLongNotes = document?.metadata?.notes?.length > 200;
    return itemCount > 5 || hasLongNotes;
  };

  // Générer le contenu PDF avec jsPDF natif
  const generatePdfContent = () => {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Ajouter la première page
        pdf.addPage();

        let yPosition = PADDING_MM;

        // Header
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(document?.type?.label?.toUpperCase() || 'DOCUMENT', A4_WIDTH_MM - PADDING_MM, yPosition, { align: 'right' });
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`N° ${Date.now().toString().slice(-6)}`, A4_WIDTH_MM - PADDING_MM, yPosition + 7, { align: 'right' });
        pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, A4_WIDTH_MM - PADDING_MM, yPosition + 14, { align: 'right' });
        pdf.text('Devise: EUR', A4_WIDTH_MM - PADDING_MM, yPosition + 21, { align: 'right' });

        // Logo et infos agence
        if (agencyProfile?.logo_url) {
          // Pour l'instant, on met le nom de l'agence
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(agencyProfile?.name || 'Agence', PADDING_MM, yPosition);
          yPosition += 10;
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        if (agencyProfile?.address) {
          pdf.text(agencyProfile.address, PADDING_MM, yPosition);
          yPosition += 5;
        }
        if (agencyProfile?.email) {
          pdf.text(agencyProfile.email, PADDING_MM, yPosition);
          yPosition += 5;
        }
        if (agencyProfile?.phone) {
          pdf.text(agencyProfile.phone, PADDING_MM, yPosition);
          yPosition += 5;
        }

        yPosition += 15;

        // Client
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CLIENT', PADDING_MM, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Nom: ${lead?.nom || 'Non spécifié'}`, PADDING_MM, yPosition);
        yPosition += 5;
        if (lead?.email) {
          pdf.text(`Email: ${lead.email}`, PADDING_MM, yPosition);
          yPosition += 5;
        }
        if (lead?.telephone) {
          pdf.text(`Tél: ${lead.telephone}`, PADDING_MM, yPosition);
          yPosition += 5;
        }
        pdf.text(`Projet: ${lead?.type_bien || 'Non spécifié'}`, PADDING_MM, yPosition);
        yPosition += 5;
        if (lead?.budget) {
          pdf.text(`Budget: ${formatAmount(lead.budget)}`, PADDING_MM, yPosition);
          yPosition += 5;
        }
        pdf.text('Source: Formulaire IA', PADDING_MM, yPosition);
        yPosition += 15;

        // Tableau financier
        if (document?.financialData) {
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('DÉTAILS FINANCIERS', PADDING_MM, yPosition);
          yPosition += 10;

          // En-têtes du tableau
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Description', PADDING_MM, yPosition);
          pdf.text('Qté', PADDING_MM + 100, yPosition);
          pdf.text('Total', A4_WIDTH_MM - PADDING_MM, yPosition, { align: 'right' });
          yPosition += 7;

          // Ligne de séparation
          pdf.setDrawColor(200, 200, 200);
          pdf.line(PADDING_MM, yPosition, A4_WIDTH_MM - PADDING_MM, yPosition);
          yPosition += 5;

          // Items
          pdf.setFont('helvetica', 'normal');
          document.financialData.items.forEach((item, index) => {
            if (yPosition > A4_HEIGHT_MM - 60) {
              pdf.addPage();
              yPosition = PADDING_MM;
            }

            pdf.text(item.description, PADDING_MM, yPosition);
            pdf.text(item.quantity || '1', PADDING_MM + 100, yPosition);
            pdf.text(formatAmount(item.amount), A4_WIDTH_MM - PADDING_MM, yPosition, { align: 'right' });
            yPosition += 7;
          });

          // Ligne de séparation pour les totaux
          pdf.setDrawColor(200, 200, 200);
          pdf.line(PADDING_MM, yPosition, A4_WIDTH_MM - PADDING_MM, yPosition);
          yPosition += 5;

          // Totaux
          document.financialData.totals.forEach((total, index) => {
            const isTotalTTC = total.label.includes('TOTAL TTC');
            
            if (isTotalTTC) {
              pdf.setDrawColor(59, 130, 246);
              pdf.line(PADDING_MM, yPosition - 2, A4_WIDTH_MM - PADDING_MM, yPosition - 2);
              pdf.setDrawColor(0, 0, 0);
            }

            pdf.setFont('helvetica', isTotalTTC ? 'bold' : 'normal');
            pdf.setFontSize(isTotalTTC ? 12 : 10);
            pdf.setTextColor(isTotalTTC ? 29 : 0, isTotalTTC ? 78 : 0, isTotalTTC ? 216 : 0);
            
            pdf.text(total.label, PADDING_MM, yPosition);
            pdf.text(formatAmount(total.amount), A4_WIDTH_MM - PADDING_MM, yPosition, { align: 'right' });
            
            pdf.setTextColor(0, 0, 0);
            yPosition += 8;
          });

          yPosition += 10;
        }

        // Métadonnées
        if (document?.metadata?.notes) {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.text('Notes:', PADDING_MM, yPosition);
          yPosition += 5;
          
          // Gérer les notes longues
          const notes = document.metadata.notes;
          const lines = pdf.splitTextToSize(notes, CONTENT_WIDTH_MM);
          lines.forEach(line => {
            if (yPosition > A4_HEIGHT_MM - 40) {
              pdf.addPage();
              yPosition = PADDING_MM;
            }
            pdf.text(line, PADDING_MM, yPosition);
            yPosition += 5;
          });
          yPosition += 10;
        }

        // Signature
        const totalsOnSamePage = !needsPage2();
        
        if (totalsOnSamePage && yPosition < A4_HEIGHT_MM - 60) {
          yPosition = A4_HEIGHT_MM - 50;
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Lignes de signature
          pdf.setDrawColor(0, 0, 0);
          pdf.line(PADDING_MM, yPosition, PADDING_MM + 60, yPosition);
          pdf.text('Signature agence', PADDING_MM, yPosition + 5);
          pdf.text(agencyProfile?.name || 'Agence', PADDING_MM, yPosition + 10);
          
          pdf.line(A4_WIDTH_MM - PADDING_MM - 60, yPosition, A4_WIDTH_MM - PADDING_MM, yPosition);
          pdf.text('Signature client', A4_WIDTH_MM - PADDING_MM - 60, yPosition + 5);
          pdf.text(lead?.nom || 'Client', A4_WIDTH_MM - PADDING_MM - 60, yPosition + 10);
          
          pdf.text(`Fait à Paris, le ${new Date().toLocaleDateString('fr-FR')}`, A4_WIDTH_MM / 2, yPosition + 20, { align: 'center' });
        }

        // Page 2 si nécessaire
        if (needsPage2()) {
          pdf.addPage();
          yPosition = PADDING_MM;
          
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('ANNEXE', PADDING_MM, yPosition);
          yPosition += 20;
          
          // Signature sur page 2
          yPosition = A4_HEIGHT_MM - 50;
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          pdf.setDrawColor(0, 0, 0);
          pdf.line(PADDING_MM, yPosition, PADDING_MM + 60, yPosition);
          pdf.text('Signature agence', PADDING_MM, yPosition + 5);
          pdf.text(agencyProfile?.name || 'Agence', PADDING_MM, yPosition + 10);
          
          pdf.line(A4_WIDTH_MM - PADDING_MM - 60, yPosition, A4_WIDTH_MM - PADDING_MM, yPosition);
          pdf.text('Signature client', A4_WIDTH_MM - PADDING_MM - 60, yPosition + 5);
          pdf.text(lead?.nom || 'Client', A4_WIDTH_MM - PADDING_MM - 60, yPosition + 10);
          
          pdf.text(`Fait à Paris, le ${new Date().toLocaleDateString('fr-FR')}`, A4_WIDTH_MM / 2, yPosition + 20, { align: 'center' });
        }

        resolve(pdf);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Imprimer le PDF
  const printPdf = async () => {
    try {
      const pdf = await generatePdfContent();
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
      
      if (onPrintReady) {
        onPrintReady();
      }
    } catch (error) {
      console.error('Erreur lors de l\'impression PDF:', error);
      alert('Erreur lors de l\'impression PDF');
    }
  };

  // Télécharger le PDF
  const downloadPdf = async () => {
    try {
      const pdf = await generatePdfContent();
      const filename = `${document?.type?.label || 'document'}_${Date.now()}.pdf`;
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
        print: printPdf,
        download: downloadPdf
      };
      onPdfGenerated(actions);
    }
  }, [onPdfGenerated]);

  // Le composant ne rend rien (invisible)
  return null;
};

export default DocumentPdfLayout;
