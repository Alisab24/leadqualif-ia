import { supabase } from "../supabaseClient";

export const DocumentCounterService = {
  async generateDocumentNumber(type, agencyId) {
    if (!agencyId) {
      throw new Error("Agency / Organization ID manquant");
    }

    const docType = type === "facture" ? "FAC" : "DEV";

    console.log("🔢 Appel RPC generate_document_number", {
      p_organization_id: agencyId,
      p_type: docType
    });

    const { data, error } = await supabase.rpc(
      "generate_document_number",
      {
        p_organization_id: agencyId,
        p_type: docType
      }
    );

    if (error || !data) {
      console.error("❌ Erreur RPC generate_document_number:", error);
      throw new Error("Impossible de générer le numéro du document");
    }

    console.log("📄 Numéro de document généré:", data);
    return data;
  },

  /**
   * Génère le nom du fichier PDF professionnel
   * Format : Facture_FAC-2026-000001.pdf ou Devis_DEV-2026-000001.pdf
   */
  generatePdfFileName(documentNumber, documentType) {
    try {
      if (!documentNumber) {
        return 'Document.pdf';
      }

      // Déterminer le préfixe du nom de fichier
      const prefix = documentType === 'facture' ? 'Facture' : 
                    documentType === 'devis' ? 'Devis' : 'Document';
      
      // Nettoyer le numéro de document pour le nom de fichier
      const cleanNumber = documentNumber.replace(/[^A-Z0-9-]/g, '_');
      
      return `${prefix}_${cleanNumber}.pdf`;
    } catch (error) {
      console.error('❌ Erreur génération nom fichier PDF:', error);
      return 'Document.pdf';
    }
  }
};
