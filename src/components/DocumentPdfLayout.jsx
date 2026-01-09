import React, { useRef, useEffect } from 'react';
import jsPDF from 'jspdf';

const DocumentPdfLayout = ({ 
  document, 
  agencyProfile, 
  lead, 
  onPdfGenerated,
  onPrintReady 
}) => {
  const pdfRef = useRef(null);

  // Format A4 constants
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PADDING_MM = 20;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - (2 * PADDING_MM);

  // Conversion mm to pixels (96 DPI)
  const mmToPx = (mm) => (mm * 96) / 25.4;

  // Styles A4 stricts
  const a4Styles = {
    width: `${mmToPx(A4_WIDTH_MM)}px`,
    minHeight: `${mmToPx(A4_HEIGHT_MM)}px`,
    padding: `${mmToPx(PADDING_MM)}px`,
    backgroundColor: 'white',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#000000',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden'
  };

  // Styles pour éviter les sauts de page
  const noBreakStyles = {
    pageBreakInside: 'avoid',
    pageBreakBefore: 'auto',
    pageBreakAfter: 'auto'
  };

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

  // Générer le PDF
  const generatePdf = () => {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Ajouter la première page
        pdf.addPage();

        // Contenu de la première page
        const content = pdfRef.current;
        if (!content) {
          reject(new Error('Contenu PDF non trouvé'));
          return;
        }

        // Utiliser html2canvas pour capturer le contenu
        import('html2canvas').then(html2canvas => {
          html2canvas.default(content, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = CONTENT_WIDTH_MM;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', PADDING_MM, PADDING_MM, imgWidth, imgHeight);

            // Si page 2 nécessaire
            if (needsPage2()) {
              pdf.addPage();
              // Ajouter le contenu de la page 2 ici
              pdf.setFontSize(12);
              pdf.text('Page 2 - Annexes', PADDING_MM, PADDING_MM + 10);
            }

            // Callback pour le PDF généré
            if (onPdfGenerated) {
              onPdfGenerated(pdf);
            }

            resolve(pdf);
          }).catch(reject);
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Imprimer le PDF
  const printPdf = async () => {
    try {
      const pdf = await generatePdf();
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
      
      if (onPrintReady) {
        onPrintReady();
      }
    } catch (error) {
      console.error('Erreur lors de l\'impression PDF:', error);
    }
  };

  // Télécharger le PDF
  const downloadPdf = async () => {
    try {
      const pdf = await generatePdf();
      const filename = `${document?.type?.label || 'document'}_${Date.now()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Erreur lors du téléchargement PDF:', error);
    }
  };

  // Exposer les fonctions au parent
  useEffect(() => {
    if (onPdfGenerated) {
      onPdfGenerated({
        print: printPdf,
        download: downloadPdf
      });
    }
  }, []);

  // Calculer si les totaux doivent être sur la même page
  const totalsOnSamePage = !needsPage2();

  return (
    <div style={{ display: 'none' }}>
      {/* Page 1 */}
      <div 
        ref={pdfRef}
        style={{
          ...a4Styles,
          marginBottom: needsPage2() ? '20px' : '0'
        }}
      >
        {/* Header */}
        <div style={{ ...noBreakStyles, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              {agencyProfile?.logo_url && (
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '1px solid #ddd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={agencyProfile.logo_url} 
                    alt="Logo agence" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  {agencyProfile?.name || 'Agence'}
                </h2>
                <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.3' }}>
                  {agencyProfile?.address && <div>{agencyProfile.address}</div>}
                  {agencyProfile?.email && <div>{agencyProfile.email}</div>}
                  {agencyProfile?.phone && <div>{agencyProfile.phone}</div>}
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
                {document?.type?.label?.toUpperCase() || 'DOCUMENT'}
              </div>
              <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.3' }}>
                <div style={{ fontWeight: '600' }}>N° {Date.now().toString().slice(-6)}</div>
                <div>Date: {new Date().toLocaleDateString('fr-FR')}</div>
                <div>Devise: EUR</div>
              </div>
            </div>
          </div>
        </div>

        {/* Client */}
        <div style={{ ...noBreakStyles, marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>CLIENT</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                <span style={{ fontWeight: '600', display: 'inline-block', width: '50px' }}>Nom:</span>
                <span>{lead?.nom || 'Non spécifié'}</span>
              </div>
              {lead?.email && (
                <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                  <span style={{ fontWeight: '600', display: 'inline-block', width: '50px' }}>Email:</span>
                  <span>{lead.email}</span>
                </div>
              )}
              {lead?.telephone && (
                <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                  <span style={{ fontWeight: '600', display: 'inline-block', width: '50px' }}>Tél:</span>
                  <span>{lead.telephone}</span>
                </div>
              )}
            </div>
            <div>
              <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                <span style={{ fontWeight: '600', display: 'inline-block', width: '60px' }}>Projet:</span>
                <span>{lead?.type_bien || 'Non spécifié'}</span>
              </div>
              {lead?.budget && (
                <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                  <span style={{ fontWeight: '600', display: 'inline-block', width: '60px' }}>Budget:</span>
                  <span>{formatAmount(lead.budget)}</span>
                </div>
              )}
              <div style={{ marginBottom: '5px', fontSize: '11px' }}>
                <span style={{ fontWeight: '600', display: 'inline-block', width: '60px' }}>Source:</span>
                <span>Formulaire IA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau financier */}
        {document?.financialData && (
          <div style={{ ...noBreakStyles, marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                  <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', width: '60px' }}>Qté</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', width: '80px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {document.financialData.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontWeight: '500' }}>{item.description}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                      {item.quantity || '1'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                      {formatAmount(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {document.financialData.totals.map((total, index) => {
                  const isTotalTTC = total.label.includes('TOTAL TTC');
                  const isBold = total.label.includes('TOTAL');
                  
                  return (
                    <tr key={index} style={{
                      borderTop: isTotalTTC ? '2px solid #3b82f6' : '1px solid #ddd',
                      backgroundColor: isTotalTTC ? '#f0f9ff' : 'transparent'
                    }}>
                      <td 
                        colSpan="2" 
                        style={{ 
                          padding: '10px',
                          fontWeight: isTotalTTC ? 'bold' : isBold ? '600' : 'normal',
                          fontSize: isTotalTTC ? '14px' : '11px',
                          color: isTotalTTC ? '#1d4ed8' : '#000'
                        }}
                      >
                        {total.label}
                      </td>
                      <td style={{ 
                        padding: '10px',
                        textAlign: 'right',
                        fontWeight: isTotalTTC ? 'bold' : isBold ? '600' : 'normal',
                        fontSize: isTotalTTC ? '14px' : '11px',
                        color: isTotalTTC ? '#1d4ed8' : '#000'
                      }}>
                        {formatAmount(total.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tfoot>
            </table>
          </div>
        )}

        {/* Métadonnées */}
        {document?.metadata && (
          <div style={{ ...noBreakStyles, marginBottom: '20px', padding: '10px', backgroundColor: '#fffbeb', border: '1px solid #fbbf24' }}>
            {document.metadata.notes && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#92400e', marginBottom: '5px' }}>
                  Notes:
                </div>
                <div style={{ fontSize: '11px', color: '#78350f' }}>
                  {document.metadata.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signature */}
        {totalsOnSamePage && (
          <div style={{ ...noBreakStyles, marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ width: '45%' }}>
                <div style={{ marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                  Signature agence
                </div>
                <div style={{ borderBottom: '2px solid #000', width: '100%', height: '30px', marginBottom: '5px' }}></div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {agencyProfile?.name || 'Agence'}
                </div>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                  Signature client
                </div>
                <div style={{ borderBottom: '2px solid #000', width: '100%', height: '30px', marginBottom: '5px' }}></div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {lead?.nom || 'Client'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#666' }}>
              Fait à Paris, le {new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
        )}
      </div>

      {/* Page 2 (si nécessaire) */}
      {needsPage2() && (
        <div style={a4Styles}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px' }}>
            ANNEXE
          </div>
          
          {/* Signature sur page 2 si nécessaire */}
          <div style={{ ...noBreakStyles, marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ width: '45%' }}>
                <div style={{ marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                  Signature agence
                </div>
                <div style={{ borderBottom: '2px solid #000', width: '100%', height: '30px', marginBottom: '5px' }}></div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {agencyProfile?.name || 'Agence'}
                </div>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                  Signature client
                </div>
                <div style={{ borderBottom: '2px solid #000', width: '100%', height: '30px', marginBottom: '5px' }}></div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {lead?.nom || 'Client'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#666' }}>
              Fait à Paris, le {new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPdfLayout;
