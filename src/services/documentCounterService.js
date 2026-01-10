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
  }
};
