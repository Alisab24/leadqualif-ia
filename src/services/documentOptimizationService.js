import { supabase } from '../supabaseClient';

class DocumentOptimizationService {
  // Analyser et optimiser un document avec l'IA
  static async optimizeDocument(documentId, leadData) {
    try {
      console.log('Optimisation IA du document:', documentId);
      
      // Récupérer le document existant
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document non trouvé:', docError);
        return null;
      }

      // Analyse IA du contenu
      const aiAnalysis = await this.analyzeDocumentContent(document, leadData);
      
      // Génération de contenu optimisé
      const optimizedContent = await this.generateOptimizedContent(document, leadData, aiAnalysis);
      
      // Mise à jour du document avec contenu optimisé
      const { data: updatedDoc, error: updateError } = await supabase
        .from('documents')
        .update({
          content: optimizedContent,
          metadata: {
            ...document.metadata,
            ai_optimized: true,
            ai_analysis: aiAnalysis,
            optimization_date: new Date().toISOString(),
            optimization_score: aiAnalysis.score
          },
          status: 'Optimisé',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select()
        .single();

      if (updateError) {
        console.error('Erreur mise à jour document:', updateError);
        return null;
      }

      // Créer l'événement d'optimisation
      await this.createOptimizationEvent(documentId, leadData, aiAnalysis);

      console.log('Document optimisé avec succès:', updatedDoc);
      return updatedDoc;

    } catch (error) {
      console.error('Erreur optimisation document:', error);
      return null;
    }
  }

  // Analyser le contenu du document avec l'IA
  static async analyzeDocumentContent(document, leadData) {
    try {
      // Simulation d'analyse IA (à remplacer par vraie API IA)
      const analysis = {
        score: 0,
        suggestions: [],
        improvements: [],
        completeness: 0,
        professionalism: 0
      };

      // Analyse du type de document
      switch (document.type) {
        case 'Mandat':
          analysis.score = this.analyzeMandat(document, leadData);
          analysis.suggestions = this.getMandatSuggestions(document, leadData);
          break;
        case 'Devis':
          analysis.score = this.analyzeDevis(document, leadData);
          analysis.suggestions = this.getDevisSuggestions(document, leadData);
          break;
        case 'Facture':
          analysis.score = this.analyzeFacture(document, leadData);
          analysis.suggestions = this.getFactureSuggestions(document, leadData);
          break;
        case 'Bon de visite':
          analysis.score = this.analyzeBonVisite(document, leadData);
          analysis.suggestions = this.getBonVisiteSuggestions(document, leadData);
          break;
      }

      // Calcul du score global
      analysis.completeness = this.calculateCompleteness(document, leadData);
      analysis.professionalism = this.calculateProfessionalism(document);
      analysis.score = Math.round((analysis.completeness + analysis.professionalism) / 2);

      return analysis;

    } catch (error) {
      console.error('Erreur analyse IA:', error);
      return {
        score: 50,
        suggestions: ['Erreur lors de l\'analyse'],
        improvements: [],
        completeness: 50,
        professionalism: 50
      };
    }
  }

  // Analyser un mandat
  static analyzeMandat(document, leadData) {
    let score = 50;
    
    // Vérification des champs obligatoires
    if (leadData.nom) score += 10;
    if (leadData.budget) score += 10;
    if (leadData.type_bien) score += 10;
    if (document.content?.duree) score += 10;
    if (document.content?.commission) score += 10;

    return Math.min(score, 100);
  }

  // Analyser un devis
  static analyzeDevis(document, leadData) {
    let score = 50;
    
    if (leadData.budget) score += 15;
    if (document.content?.honoraires) score += 15;
    if (document.content?.prestations) score += 10;
    if (document.content?.delai) score += 10;

    return Math.min(score, 100);
  }

  // Analyser une facture
  static analyzeFacture(document, leadData) {
    let score = 50;
    
    if (document.content?.numero_facture) score += 15;
    if (document.content?.montant_ht) score += 15;
    if (document.content?.tva) score += 10;
    if (document.content?.montant_ttc) score += 10;

    return Math.min(score, 100);
  }

  // Analyser un bon de visite
  static analyzeBonVisite(document, leadData) {
    let score = 50;
    
    if (leadData.nom) score += 15;
    if (document.content?.date_visite) score += 15;
    if (document.content?.adresse_bien) score += 10;
    if (document.content?.agent) score += 10;

    return Math.min(score, 100);
  }

  // Suggestions pour mandat
  static getMandatSuggestions(document, leadData) {
    const suggestions = [];
    
    if (!document.content?.duree) {
      suggestions.push('Ajouter une durée de mandat recommandée (3 mois)');
    }
    if (!document.content?.commission) {
      suggestions.push('Préciser le taux de commission (généralement 3-5%)');
    }
    if (!leadData.type_bien) {
      suggestions.push('Compléter le type de bien dans les informations du lead');
    }

    return suggestions;
  }

  // Suggestions pour devis
  static getDevisSuggestions(document, leadData) {
    const suggestions = [];
    
    if (!document.content?.details_prestations) {
      suggestions.push('Détaillez les prestations incluses');
    }
    if (!document.content?.conditions_paiement) {
      suggestions.push('Ajouter les conditions de paiement');
    }
    if (!document.content?.validite) {
      suggestions.push('Préciser la durée de validité du devis');
    }

    return suggestions;
  }

  // Suggestions pour facture
  static getFactureSuggestions(document, leadData) {
    const suggestions = [];
    
    if (!document.content?.echeance) {
      suggestions.push('Ajouter une date d\'échéance');
    }
    if (!document.content?.modalites_paiement) {
      suggestions.push('Préciser les modalités de paiement');
    }
    if (!document.content?.penalites_retard) {
      suggestions.push('Ajouter les pénalités de retard');
    }

    return suggestions;
  }

  // Suggestions pour bon de visite
  static getBonVisiteSuggestions(document, leadData) {
    const suggestions = [];
    
    if (!document.content?.points_visite) {
      suggestions.push('Lister les points à vérifier lors de la visite');
    }
    if (!document.content?.materiel) {
      suggestions.push('Préciser le matériel à apporter');
    }
    if (!document.content?.contact_urgence) {
      suggestions.push('Ajouter un contact d\'urgence');
    }

    return suggestions;
  }

  // Calculer le score de complétude
  static calculateCompleteness(document, leadData) {
    let score = 0;
    let totalFields = 0;

    // Champs à vérifier selon le type
    const requiredFields = this.getRequiredFields(document.type);
    
    requiredFields.forEach(field => {
      totalFields++;
      if (this.hasField(document, leadData, field)) {
        score++;
      }
    });

    return totalFields > 0 ? Math.round((score / totalFields) * 100) : 0;
  }

  // Calculer le score de professionnalisme
  static calculateProfessionalism(document) {
    let score = 50; // Score de base

    // Éléments de professionnalisme
    if (document.content?.en_tete) score += 10;
    if (document.content?.pied_page) score += 10;
    if (document.content?.logo) score += 10;
    if (document.content?.coordonnees) score += 10;
    if (document.content?.mentions_legales) score += 10;

    return Math.min(score, 100);
  }

  // Obtenir les champs requis selon le type
  static getRequiredFields(documentType) {
    const fields = {
      'Mandat': ['nom', 'budget', 'type_bien', 'duree', 'commission'],
      'Devis': ['nom', 'budget', 'honoraires', 'prestations'],
      'Facture': ['nom', 'montant_ht', 'tva', 'montant_ttc'],
      'Bon de visite': ['nom', 'date_visite', 'adresse_bien']
    };

    return fields[documentType] || [];
  }

  // Vérifier si un champ existe
  static hasField(document, leadData, field) {
    // Vérifier dans le document
    if (document.content && document.content[field]) return true;
    
    // Vérifier dans les données du lead
    if (leadData && leadData[field]) return true;
    
    return false;
  }

  // Générer du contenu optimisé
  static async generateOptimizedContent(document, leadData, aiAnalysis) {
    try {
      const optimizedContent = {
        ...document.content,
        ai_optimized: true,
        optimization_date: new Date().toISOString(),
        ai_suggestions: aiAnalysis.suggestions,
        ai_score: aiAnalysis.score
      };

      // Optimisations spécifiques selon le type
      switch (document.type) {
        case 'Mandat':
          return this.optimizeMandatContent(optimizedContent, leadData, aiAnalysis);
        case 'Devis':
          return this.optimizeDevisContent(optimizedContent, leadData, aiAnalysis);
        case 'Facture':
          return this.optimizeFactureContent(optimizedContent, leadData, aiAnalysis);
        case 'Bon de visite':
          return this.optimizeBonVisiteContent(optimizedContent, leadData, aiAnalysis);
      }

      return optimizedContent;

    } catch (error) {
      console.error('Erreur génération contenu optimisé:', error);
      return document.content;
    }
  }

  // Optimiser contenu mandat
  static optimizeMandatContent(content, leadData, analysis) {
    return {
      ...content,
      en_tete: {
        agence: "LeadQualif IA",
        adresse: "Adresse de l'agence",
        telephone: "Téléphone de l'agence",
        email: "email@agence.com",
        siret: "12345678901234"
      },
      duree: content.duree || "3 mois",
      commission: content.commission || "5% du prix de vente",
      exclusivite: "Oui",
      prix_estime: leadData.budget || "À définir",
      type_bien: leadData.type_bien || "À préciser",
      suggestions_amelioration: analysis.suggestions
    };
  }

  // Optimiser contenu devis
  static optimizeDevisContent(content, leadData, analysis) {
    return {
      ...content,
      en_tete: {
        agence: "LeadQualif IA",
        numero_devis: `DEV-${Date.now()}`,
        date_emission: new Date().toLocaleDateString(),
        validite: "1 mois"
      },
      client: {
        nom: leadData.nom || "Client",
        email: leadData.email || "",
        telephone: leadData.telephone || ""
      },
      prestations: content.prestations || [
        "Accompagnement à la vente",
        "Estimation immobilière",
        "Marketing du bien",
        "Gestion des visites"
      ],
      honoraires: content.honoraires || `${Math.round((leadData.budget || 0) * 0.03).toLocaleString()} €`,
      conditions_paiement: "50% à la signature, 50% à la vente",
      suggestions_amelioration: analysis.suggestions
    };
  }

  // Optimiser contenu facture
  static optimizeFactureContent(content, leadData, analysis) {
    const montantHT = Math.round((leadData.budget || 0) * 0.03);
    const tva = Math.round(montantHT * 0.2);
    const montantTTC = montantHT + tva;

    return {
      ...content,
      en_tete: {
        agence: "LeadQualif IA",
        numero_facture: `FAC-${Date.now()}`,
        date_emission: new Date().toLocaleDateString(),
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
      },
      client: {
        nom: leadData.nom || "Client",
        adresse: "Adresse du client"
      },
      montant_ht: `${montantHT.toLocaleString()} €`,
      tva: `${tva.toLocaleString()} € (20%)`,
      montant_ttc: `${montantTTC.toLocaleString()} €`,
      modalites_paiement: "Virement bancaire",
      suggestions_amelioration: analysis.suggestions
    };
  }

  // Optimiser contenu bon de visite
  static optimizeBonVisiteContent(content, leadData, analysis) {
    return {
      ...content,
      en_tete: {
        agence: "LeadQualif IA",
        numero_visite: `VIS-${Date.now()}`,
        date_visite: content.date_visite || new Date().toLocaleDateString(),
        heure_visite: content.heure_visite || "10:00"
      },
      client: {
        nom: leadData.nom || "Client",
        telephone: leadData.telephone || ""
      },
      bien: {
        type: leadData.type_bien || "À préciser",
        adresse: content.adresse_bien || "Adresse du bien"
      },
      points_visite: content.points_visite || [
        "État général du bien",
        "Équipements disponibles",
        "Travaux nécessaires",
        "Conformité normes"
      ],
      materiel: content.materiel || [
        "Clés du bien",
        "Appareil photo",
        "Mètre ruban",
        "Lampe torche"
      ],
      suggestions_amelioration: analysis.suggestions
    };
  }

  // Créer l'événement d'optimisation
  static async createOptimizationEvent(documentId, leadData, analysis) {
    try {
      const { error } = await supabase
        .from('crm_events')
        .insert([{
          lead_id: leadData.id,
          agency_id: leadData.agency_id,
          type: 'document_optimized',
          description: `Document optimisé par IA - Score: ${analysis.score}%`,
          metadata: {
            documentId: documentId,
            optimization_score: analysis.score,
            suggestions_count: analysis.suggestions.length,
            improvements_count: analysis.improvements.length,
            analysis_details: analysis
          },
          agency_id: leadData.agency_id
        }]);

      if (error) {
        console.error('Erreur création événement optimisation:', error);
      }
    } catch (error) {
      console.error('Erreur création événement optimisation:', error);
    }
  }

  // Optimiser automatiquement tous les documents d'un lead
  static async optimizeLeadDocuments(leadId, agencyId) {
    try {
      // Récupérer tous les documents du lead
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .eq('agency_id', agencyId);

      if (error) {
        console.error('Erreur récupération documents lead:', error);
        return [];
      }

      // Récupérer les données du lead
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (!lead) {
        console.error('Lead non trouvé');
        return [];
      }

      // Optimiser chaque document
      const optimizedDocs = [];
      for (const document of documents || []) {
        if (!document.metadata?.ai_optimized) {
          const optimized = await this.optimizeDocument(document.id, lead);
          if (optimized) {
            optimizedDocs.push(optimized);
          }
        }
      }

      return optimizedDocs;

    } catch (error) {
      console.error('Erreur optimisation documents lead:', error);
      return [];
    }
  }
}

export default DocumentOptimizationService;
