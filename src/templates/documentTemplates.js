/**
 * Templates de documents professionnels pour IMMO et SMMA
 * Structure clé/valeur pour usage IA futur
 * Conforme aux réglementations françaises
 */

// ========================================
// PARTIE 1 - IMMOBILIER (IMMO)
// ========================================

/**
 * Template pour Mandat Immobilier
 */
export const MANDAT_IMMO_TEMPLATE = {
  type: 'mandat',
  title: 'Mandat de Vente',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      agency_address: '{{adresse_legale}}',
      agency_phone: '{{telephone}}',
      agency_email: '{{email}}',
      registration_number: '{{numero_enregistrement}}'
    },
    title: {
      text: 'MANDAT DE VENTE',
      type: 'vente' // 'vente' | 'location'
    },
    parties: {
      mandant: {
        nom: '{{lead.nom}}',
        email: '{{lead.email}}',
        telephone: '{{lead.telephone}}',
        adresse: '{{lead.adresse}}'
      },
      mandataire: {
        nom: '{{nom_legal}}',
        email: '{{email}}',
        telephone: '{{telephone}}',
        adresse: '{{adresse_legale}}'
      }
    },
    bien: {
      type: '{{bien_type}}', // 'appartement', 'maison', 'terrain', 'local'
      adresse: '{{bien_adresse}}',
      ville: '{{bien_ville}}',
      code_postal: '{{bien_code_postal}}',
      surface: '{{bien_surface}}',
      description: '{{bien_description}}',
      diagnostics: '{{bien_diagnostics}}'
    },
    conditions_financieres: {
      prix_vente: '{{prix}}',
      devise: '{{devise}}',
      commission: '{{commission}}',
      commission_type: '{{commission_type}}', // 'pourcentage' | 'fixe'
      honoraires: '{{honoraires}}',
      qui_paie_honoraires: '{{qui_paie_honoraires}}' // 'vendeur' | 'acheteur' | 'partage'
    },
    duree: {
      duree_mandat: '{{duree}}', // en mois
      date_debut: '{{date_debut}}',
      date_fin: '{{date_fin}}'
    },
    exclusivite: {
      exclusivite: '{{exclusivite}}', // true | false
      texte_exclusivite: '{{texte_exclusivite}}'
    },
    obligations: {
      obligations_mandant: '{{obligations_mandant}}',
      obligations_mandataire: '{{obligations_mandataire}}'
    },
    mentions_legales: {
      mention_1: '{{mention_legale_1}}',
      mention_2: '{{mention_legale_2}}',
      loi_alur: '{{loi_alur}}',
      droit_preemption: '{{droit_preemption}}'
    },
    signatures: {
      lieu_signature: '{{lieu_signature}}',
      date_signature: '{{date_signature}}',
      signature_mandant: '{{signature_mandant}}',
      signature_mandataire: '{{signature_mandataire}}'
    }
  },
  // Données structurées pour IA
  structured_data: {
    bien_type: '{{bien_type}}',
    prix: '{{prix}}',
    commission: '{{commission}}',
    duree: '{{duree}}',
    exclusivite: '{{exclusivite}}',
    risque_juridique: 'medium', // Calculé automatiquement
    score_lead: null // Calculé automatiquement
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'medium'
  }
};

/**
 * Template pour Compromis de Vente
 */
export const COMPROMIS_VENTE_TEMPLATE = {
  type: 'compromis',
  title: 'Compromis de Vente',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      agency_address: '{{adresse_legale}}',
      agency_phone: '{{telephone}}',
      agency_email: '{{email}}'
    },
    parties_contractantes: {
      vendeur: {
        nom: '{{lead.nom}}',
        email: '{{lead.email}}',
        telephone: '{{lead.telephone}}',
        adresse: '{{lead.adresse}}'
      },
      acquereur: {
        nom: '{{acquereur_nom}}',
        email: '{{acquereur_email}}',
        telephone: '{{acquereur_telephone}}',
        adresse: '{{acquereur_adresse}}'
      }
    },
    bien_designation: {
      type: '{{bien_type}}',
      adresse_complete: '{{bien_adresse_complete}}',
      titre_foncier: '{{titre_foncier}}',
      surface_habitable: '{{surface_habitable}}',
      surface_terrain: '{{surface_terrain}}',
      description: '{{bien_description}}'
    },
    prix_vente: {
      montant: '{{prix}}',
      devise: '{{devise}}',
      frais_notaire: '{{frais_notaire}}',
      frais_agence: '{{frais_agence}}',
      total_pour_acquereur: '{{total_pour_acquereur}}'
    },
    conditions_suspensives: {
      condition_financement: '{{condition_financement}}',
      delai_financement: '{{delai_financement}}',
      condition_permis: '{{condition_permis}}',
      condition_diagnostic: '{{condition_diagnostic}}'
    },
    depot_garantie: {
      montant: '{{depot_garantie}}',
      devise: '{{devise}}',
      compte_garantie: '{{compte_garantie}}'
    },
    dates: {
      date_compromis: '{{date_compromis}}',
      date_signature_definitive: '{{date_signature_definitive}}',
      delai_retractation: '{{delai_retractation}}'
    },
    clause_penale: {
      montant_penalite: '{{montant_penalite}}',
      pourcentage_penalite: '{{pourcentage_penalite}}'
    },
    mentions_legales: {
      mention_delai_retractation: '{{mention_delai_retractation}}',
      mention_diagnostique: '{{mention_diagnostique}}',
      mention_assurance: '{{mention_assurance}}'
    },
    signatures: {
      lieu: '{{lieu_signature}}',
      date: '{{date_signature}}',
      signature_vendeur: '{{signature_vendeur}}',
      signature_acquereur: '{{signature_acquereur}}'
    }
  },
  structured_data: {
    bien_type: '{{bien_type}}',
    prix: '{{prix}}',
    conditions_suspensives: '{{conditions_suspensives}}',
    risque_juridique: 'high',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'high'
  }
};

/**
 * Template pour Bon de Visite
 */
export const BON_VISITE_TEMPLATE = {
  type: 'bon_visite',
  title: 'Bon de Visite',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      agency_address: '{{adresse_legale}}',
      agency_phone: '{{telephone}}',
      agency_email: '{{email}}'
    },
    client: {
      nom: '{{lead.nom}}',
      email: '{{lead.email}}',
      telephone: '{{lead.telephone}}',
      adresse: '{{lead.adresse}}'
    },
    bien_visite: {
      type: '{{bien_type}}',
      adresse: '{{bien_adresse}}',
      ville: '{{bien_ville}}',
      reference: '{{reference_bien}}'
    },
    visite: {
      date_visite: '{{date_visite}}',
      heure_visite: '{{heure_visite}}',
      duree_estimee: '{{duree_estimee}}',
      agent_present: '{{agent_present}}'
    },
    engagement: {
      texte_non_contournement: '{{texte_non_contournement}}',
      duree_engagement: '{{duree_engagement}}',
      penalite_contournement: '{{penalite_contournement}}'
    },
    signatures: {
      lieu: '{{lieu_signature}}',
      date: '{{date_signature}}',
      signature_client: '{{signature_client}}',
      signature_agent: '{{signature_agent}}'
    }
  },
  structured_data: {
    bien_type: '{{bien_type}}',
    date_visite: '{{date_visite}}',
    engagement: '{{engagement}}',
    risque_juridique: 'low',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'low'
  }
};

/**
 * Template pour Contrat de Gestion Immobilière
 */
export const CONTRAT_GESTION_IMMO_TEMPLATE = {
  type: 'contrat_gestion',
  title: 'Contrat de Gestion Immobilière',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      agency_address: '{{adresse_legale}}',
      agency_phone: '{{telephone}}',
      agency_email: '{{email}}'
    },
    objet_contrat: {
      texte_objet: '{{texte_objet}}',
      type_gestion: '{{type_gestion}}' // 'location', 'copropriete', 'syndic'
    },
    duree: {
      date_debut: '{{date_debut}}',
      date_fin: '{{date_fin}}',
      duree_mois: '{{duree_mois}}',
      renouvellement: '{{renouvellement}}'
    },
    prestations: {
      gestion_locative: '{{gestion_locative}}',
      encaissement_loyers: '{{encaissement_loyers}}',
      suivi_impayes: '{{suivi_impayes}}',
      entretien: '{{entretien}}',
      comptabilite: '{{comptabilite}}',
      declarations_fiscales: '{{declarations_fiscales}}'
    },
    remuneration: {
      type_remuneration: '{{type_remuneration}}', // 'pourcentage_loyer', 'fixe', 'mixte'
      taux_honoraires: '{{taux_honoraires}}',
      montant_fixe: '{{montant_fixe}}',
      frais_annexes: '{{frais_annexes}}'
    },
    resolution: {
      preavis: '{{preavis}}',
      motifs_resolution: '{{motifs_resolution}}',
      penalites_resolution: '{{penalites_resolution}}'
    },
    responsabilites: {
      responsabilites_agence: '{{responsabilites_agence}}',
      responsabilites_client: '{{responsabilites_client}}',
      assurance_rc: '{{assurance_rc}}'
    },
    droit_applicable: {
      droit: '{{droit_applicable}}',
      juridiction: '{{juridiction_competente}}'
    },
    signatures: {
      lieu: '{{lieu_signature}}',
      date: '{{date_signature}}',
      signature_client: '{{signature_client}}',
      signature_agence: '{{signature_agence}}'
    }
  },
  structured_data: {
    type_gestion: '{{type_gestion}}',
    duree: '{{duree_mois}}',
    remuneration: '{{remuneration}}',
    risque_juridique: 'medium',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'medium'
  }
};

// ========================================
// PARTIE 2 - SMMA / AGENCE MARKETING
// ========================================

/**
 * Template pour Contrat de Prestation SMMA
 */
export const CONTRAT_PRESTATION_SMMA_TEMPLATE = {
  type: 'contrat_prestation',
  title: 'Contrat de Prestation Marketing Digitale',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      agency_address: '{{adresse_legale}}',
      agency_phone: '{{telephone}}',
      agency_email: '{{email}}'
    },
    objet: {
      texte_objet: '{{texte_objet}}',
      type_prestation: '{{type_prestation}}' // 'community_management', 'ads', 'funnels', 'complet'
    },
    services_inclus: {
      ads: {
        plateformes: '{{ads_plateformes}}', // 'facebook', 'instagram', 'google', 'linkedin'
        budget_publicitaire: '{{budget_publicitaire}}',
        creation_contenus: '{{creation_contenus}}',
        optimisation_campagnes: '{{optimisation_campagnes}}'
      },
      community_management: {
        plateformes: '{{cm_plateformes}}',
        frequence_publication: '{{frequence_publication}}',
        creation_contenus: '{{cm_creation_contenus}}',
        moderation_commentaires: '{{moderation_commentaires}}',
        reporting_mensuel: '{{reporting_mensuel}}'
      },
      funnels: {
        type_funnel: '{{type_funnel}}', // 'vente', 'lead', 'inscription'
        pages_vente: '{{pages_vente}}',
        emails_automatises: '{{emails_automatises}}',
        suivi_conversion: '{{suivi_conversion}}'
      }
    },
    duree: {
      date_debut: '{{date_debut}}',
      date_fin: '{{date_fin}}',
      duree_mois: '{{duree_mois}}',
      renouvellement_tacite: '{{renouvellement_tacite}}'
    },
    prix_modalites: {
      montant_mensuel: '{{montant_mensuel}}',
      devise: '{{devise}}',
      modalites_paiement: '{{modalites_paiement}}',
      date_echeance: '{{date_echeance}}',
      frais_mise_en_place: '{{frais_mise_en_place}}'
    },
    resultats_non_garantis: {
      clause_performance: '{{clause_performance}}',
      facteurs_exterieurs: '{{facteurs_exterieurs}}',
      engagement_moyens: '{{engagement_moyens}}'
    },
    confidentialite: {
      clause_confidentialite: '{{clause_confidentialite}}',
      donnees_confidentielles: '{{donnees_confidentielles}}',
      duree_confidentialite: '{{duree_confidentialite}}'
    },
    resolution: {
      preavis: '{{preavis}}',
      motifs_resolution: '{{motifs_resolution}}',
      penalites_resolution: '{{penalites_resolution}}'
    },
    mentions_legales: {
      propriete_intellectuelle: '{{propriete_intellectuelle}}',
      rgpd: '{{rgpd}}',
      loi_informatique: '{{loi_informatique}}'
    },
    signatures: {
      lieu: '{{lieu_signature}}',
      date: '{{date_signature}}',
      signature_client: '{{signature_client}}',
      signature_agence: '{{signature_agence}}'
    }
  },
  structured_data: {
    type_prestation: '{{type_prestation}}',
    duree: '{{duree_mois}}',
    montant_mensuel: '{{montant_mensuel}}',
    services: '{{services_inclus}}',
    risque_juridique: 'medium',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'medium'
  }
};

/**
 * Template pour Briefing Client SMMA (interne)
 */
export const BRIEFING_CLIENT_SMMA_TEMPLATE = {
  type: 'briefing_client',
  title: 'Briefing Client - Stratégie Marketing',
  interne: true, // Document interne non contractuel
  sections: {
    presentation_client: {
      nom_entreprise: '{{nom_entreprise}}',
      secteur_activite: '{{secteur_activite}}',
      site_web: '{{site_web}}',
      reseaux_sociaux_actuels: '{{reseaux_sociaux_actuels}}'
    },
    objectifs_marketing: {
      objectif_principal: '{{objectif_principal}}', // 'vente', 'leads', 'notoriete', 'engagement'
      objectifs_secondaires: '{{objectifs_secondaires}}',
      kpi_principaux: '{{kpi_principaux}}',
      cible_conversion: '{{cible_conversion}}'
    },
    cibles: {
      client_ideal: '{{client_ideal}}',
      demographie: '{{demographie}}',
      centres_interet: '{{centres_interet}}',
    },
    offres_services: {
      produits_services: '{{produits_services}}',
      avantages_concurrentiels: '{{avantages_concurrentiels}}',
      positionnement_prix: '{{positionnement_prix}}'
    },
    budget: {
      budget_mensuel: '{{budget_mensuel}}',
      devise: '{{devise}}',
      repartition_budget: '{{repartition_budget}}'
    },
    delais: {
      date_lancement: '{{date_lancement}}',
      premier_resultat_attendu: '{{premier_resultat_attendu}}',
      rythme_reporting: '{{rythme_reporting}}'
    },
    contraintes: {
      contraintes_techniques: '{{contraintes_techniques}}',
      contraintes_budgetaires: '{{contraintes_budgetaires}}',
      contraintes_reglementaires: '{{contraintes_reglementaires}}'
    }
  },
  structured_data: {
    secteur_activite: '{{secteur_activite}}',
    objectif_principal: '{{objectif_principal}}',
    budget_mensuel: '{{budget_mensuel}}',
    delai_lancement: '{{date_lancement}}',
    risque_juridique: 'low',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'high'
  }
};

/**
 * Template pour Rapport de Performance SMMA
 */
export const RAPPORT_PERFORMANCE_SMMA_TEMPLATE = {
  type: 'rapport_performance',
  title: 'Rapport de Performance Marketing',
  sections: {
    header: {
      agency_logo: '{{agency_logo_url}}',
      agency_name: '{{nom_legal}}',
      periode_analyse: '{{periode_analyse}}',
      date_rapport: '{{date_rapport}}'
    },
    objectifs: {
      objectifs_initiaux: '{{objectifs_initiaux}}',
      kpi_cibles: '{{kpi_cibles}}',
      budget_alloue: '{{budget_alloue}}'
    },
    resultats_cles: {
      tableau_resultats: {
        portee_totale: '{{portee_totale}}',
        engagement_total: '{{engagement_total}}',
        clics_website: '{{clics_website}}',
        leads_generes: '{{leads_generes}}',
        conversions: '{{conversions}}',
        cout_par_lead: '{{cout_par_lead}}',
        retour_sur_investissement: '{{retour_sur_investissement}}'
      },
      performance_par_plateforme: '{{performance_par_plateforme}}'
    },
    graphiques: {
        graphique_engagement: '{{graphique_engagement}}',
        graphique_croissance: '{{graphique_croissance}}',
        graphique_demographie: '{{graphique_demographie}}'
    },
    analyse: {
        points_forts: '{{points_forts}}',
        points_amelioration: '{{points_amelioration}}',
        apprentissages: '{{apprentissages}}'
    },
    recommandations_ia: {
        recommandation_automatique: '{{recommandation_automatique}}',
        score_performance: '{{score_performance}}',
        actions_suggerees: '{{actions_suggerees}}'
    }
  },
  structured_data: {
    periode_analyse: '{{periode_analyse}}',
    leads_generes: '{{leads_generes}}',
    conversions: '{{conversions}}',
    cout_par_lead: '{{cout_par_lead}}',
    risque_juridique: 'low',
    score_lead: null
  },
  ai_metadata: {
    score_lead: null,
    risque_juridique: null,
    recommandation: null,
    priorite: 'medium'
  }
};

// ========================================
// PARTIE 3 - UTILITAIRES
// ========================================

/**
 * Map des templates par type
 */
export const DOCUMENT_TEMPLATES = {
  // IMMO
  mandat: MANDAT_IMMO_TEMPLATE,
  compromis: COMPROMIS_VENTE_TEMPLATE,
  bon_visite: BON_VISITE_TEMPLATE,
  contrat_gestion: CONTRAT_GESTION_IMMO_TEMPLATE,
  
  // SMMA
  contrat_prestation: CONTRAT_PRESTATION_SMMA_TEMPLATE,
  briefing_client: BRIEFING_CLIENT_SMMA_TEMPLATE,
  rapport_performance: RAPPORT_PERFORMANCE_SMMA_TEMPLATE
};

/**
 * Fonction pour récupérer un template par type
 */
export const getDocumentTemplate = (type, subtype = null) => {
  const template = DOCUMENT_TEMPLATES[type];
  if (!template) {
    throw new Error(`Template non trouvé pour le type: ${type}`);
  }
  return template;
};

/**
 * Fonction pour remplacer les variables dans un template
 */
export const remplacerVariablesTemplate = (template, data) => {
  let result = JSON.stringify(template);
  
  // Remplacer les variables agency
  if (data.agency) {
    Object.keys(data.agency).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data.agency[key] || '');
    });
  }
  
  // Remplacer les variables lead
  if (data.lead) {
    Object.keys(data.lead).forEach(key => {
      const regex = new RegExp(`{{lead\\.${key}}}`, 'g');
      result = result.replace(regex, data.lead[key] || '');
    });
  }
  
  // Remplacer les variables personnalisées
  if (data.custom) {
    Object.keys(data.custom).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data.custom[key] || '');
    });
  }
  
  return JSON.parse(result);
};

export default {
  DOCUMENT_TEMPLATES,
  getDocumentTemplate,
  remplacerVariablesTemplate
};
