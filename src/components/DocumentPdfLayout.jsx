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

  // Formater les montants correctement
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Générer le PDF à partir du HTML
  const generatePdfFromHtml = () => {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Contenu HTML à convertir
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 170mm;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
              <div>
                <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${agencyProfile?.name || 'Agence'}</h2>
                <div style="font-size: 11px; color: #666;">
                  ${agencyProfile?.address || ''}
                  ${agencyProfile?.email || ''}
                  ${agencyProfile?.phone || ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
                  ${document?.type?.label?.toUpperCase() || 'DOCUMENT'}
                </div>
                <div style="font-size: 11px; color: #666;">
                  <div style="font-weight: 600;">N° ${Date.now().toString().slice(-6)}</div>
                  <div>Date: ${new Date().toLocaleDateString('fr-FR')}</div>
                  <div>Devise: EUR</div>
                </div>
              </div>
            </div>

            <!-- Client -->
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border: 1px solid #e0e0e0;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">CLIENT</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px;">
                <div>
                  <div style="margin-bottom: 5px;">
                    <span style="font-weight: 600; display: inline-block; width: 50px;">Nom:</span>
                    <span>${lead?.nom || 'Non spécifié'}</span>
                  </div>
                  ${lead?.email ? `
                    <div style="margin-bottom: 5px;">
                      <span style="font-weight: 600; display: inline-block; width: 50px;">Email:</span>
                      <span>${lead.email}</span>
                    </div>
                  ` : ''}
                  ${lead?.telephone ? `
                    <div style="margin-bottom: 5px;">
                      <span style="font-weight: 600; display: inline-block; width: 50px;">Tél:</span>
                      <span>${lead.telephone}</span>
                    </div>
                  ` : ''}
                </div>
                <div>
                  <div style="margin-bottom: 5px;">
                    <span style="font-weight: 600; display: inline-block; width: 60px;">Projet:</span>
                    <span>${lead?.type_bien || 'Non spécifié'}</span>
                  </div>
                  ${lead?.budget ? `
                    <div style="margin-bottom: 5px;">
                      <span style="font-weight: 600; display: inline-block; width: 60px;">Budget:</span>
                      <span>${formatAmount(lead.budget)}</span>
                    </div>
                  ` : ''}
                  <div style="margin-bottom: 5px;">
                    <span style="font-weight: 600; display: inline-block; width: 60px;">Source:</span>
                    <span>Formulaire IA</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tableau financier -->
            ${document?.financialData ? `
              <div style="margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                      <th style="padding: 10px; text-align: left; font-weight: 600;">Description</th>
                      <th style="padding: 10px; text-align: center; font-weight: 600; width: 60px;">Qté</th>
                      <th style="padding: 10px; text-align: right; font-weight: 600; width: 80px;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${document.financialData.items.map(item => `
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px; font-weight: 500;">${item.description}</td>
                        <td style="padding: 10px; text-align: center; color: #666;">${item.quantity || '1'}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600;">${formatAmount(item.amount)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    ${document.financialData.totals.map(total => {
                      const isTotalTTC = total.label.includes('TOTAL TTC');
                      const isBold = total.label.includes('TOTAL');
                      return `
                        <tr style="${isTotalTTC ? 'border-top: 2px solid #3b82f6; background-color: #f0f9ff;' : 'border-top: 1px solid #ddd;'}">
                          <td colspan="2" style="padding: 10px; font-weight: ${isTotalTTC ? 'bold' : isBold ? '600' : 'normal'}; font-size: ${isTotalTTC ? '14px' : '11px'}; color: ${isTotalTTC ? '#1d4ed8' : '#000'};">
                            ${total.label}
                          </td>
                          <td style="padding: 10px; text-align: right; font-weight: ${isTotalTTC ? 'bold' : isBold ? '600' : 'normal'}; font-size: ${isTotalTTC ? '14px' : '11px'}; color: ${isTotalTTC ? '#1d4ed8' : '#000'};">
                            ${formatAmount(total.amount)}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tfoot>
                </table>
              </div>
            ` : ''}

            <!-- Métadonnées -->
            ${document?.metadata?.notes ? `
              <div style="margin-bottom: 20px; padding: 10px; background-color: #fffbeb; border: 1px solid #fbbf24;">
                <div style="font-size: 10px; font-weight: 600; color: #92400e; margin-bottom: 5px;">
                  Notes:
                </div>
                <div style="font-size: 11px; color: #78350f;">
                  ${document.metadata.notes}
                </div>
              </div>
            ` : ''}

            <!-- Signature -->
            <div style="margin-top: 30px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="width: 45%;">
                  <div style="margin-bottom: 5px; font-size: 11px; font-weight: 600;">
                    Signature agence
                  </div>
                  <div style="border-bottom: 2px solid #000; width: 100%; height: 30px; margin-bottom: 5px;"></div>
                  <div style="font-size: 11px; color: #666;">
                    ${agencyProfile?.name || 'Agence'}
                  </div>
                </div>
                <div style="width: 45%;">
                  <div style="margin-bottom: 5px; font-size: 11px; font-weight: 600;">
                    Signature client
                  </div>
                  <div style="border-bottom: 2px solid #000; width: 100%; height: 30px; margin-bottom: 5px;"></div>
                  <div style="font-size: 11px; color: #666;">
                    ${lead?.nom || 'Client'}
                  </div>
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #666;">
                Fait à Paris, le ${new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        `;

        // Utiliser html2canvas pour capturer le HTML
        import('html2canvas').then(html2canvas => {
          // Créer un élément temporaire pour le HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent;
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.width = '210mm';
          document.body.appendChild(tempDiv);

          html2canvas.default(tempDiv, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 170; // 170mm pour le contenu
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);

            // Nettoyer l'élément temporaire
            document.body.removeChild(tempDiv);

            resolve(pdf);
          }).catch(error => {
            document.body.removeChild(tempDiv);
            reject(error);
          });
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Télécharger le PDF
  const downloadPdf = async () => {
    try {
      const pdf = await generatePdfFromHtml();
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
        download: downloadPdf
      };
      onPdfGenerated(actions);
    }
  }, [onPdfGenerated]);

  // Le composant ne rend rien (invisible)
  return null;
};

export default DocumentPdfLayout;
