// Libellés et regroupements des événements d'audit (utilisables côté navigateur).

export const LIBELLES_AUDIT: Record<string, { label: string; color: string; bg: string }> = {
  CONNEXION: { label: 'Connexion', color: '#16a34a', bg: '#dcfce7' },
  DECONNEXION: { label: 'Déconnexion', color: '#6b7280', bg: '#f3f4f6' },
  CONNEXION_ECHOUEE: { label: 'Connexion échouée', color: '#dc2626', bg: '#fee2e2' },
  FORMATION_DEBUT: { label: 'Début de formation', color: '#2563eb', bg: '#dbeafe' },
  FORMATION_FIN: { label: 'Fin de formation', color: '#7c3aed', bg: '#ede9fe' },
  MODULE_PROGRESSION: { label: 'Progression de module', color: '#0891b2', bg: '#cffafe' },
  LECON_TERMINEE: { label: 'Leçon terminée', color: '#0891b2', bg: '#cffafe' },
  ATTESTATION_LECTURE: { label: 'Attestation « lu et compris »', color: '#7c3aed', bg: '#ede9fe' },
  QUESTIONNAIRE_REPONSE: { label: 'Réponse au questionnaire', color: '#d97706', bg: '#fef3c7' },
  CERTIFICAT_OBTENU: { label: 'Certificat obtenu', color: '#16a34a', bg: '#dcfce7' },
  CERTIFICAT_ECHOUE: { label: 'Certificat échoué', color: '#dc2626', bg: '#fee2e2' },
  CERTIFICAT_EMIS_MANUELLEMENT: { label: 'Certificat émis manuellement', color: '#16a34a', bg: '#dcfce7' },
  FORMATION_CREEE: { label: 'Formation créée', color: '#2563eb', bg: '#dbeafe' },
  FORMATION_MODIFIEE: { label: 'Formation modifiée', color: '#d97706', bg: '#fef3c7' },
  FORMATION_SUPPRIMEE: { label: 'Formation supprimée', color: '#dc2626', bg: '#fee2e2' },
  FORMATION_ASSIGNEE: { label: 'Formation assignée', color: '#7c3aed', bg: '#ede9fe' },
  SEUIL_MODIFIE: { label: 'Seuil modifié', color: '#d97706', bg: '#fef3c7' },
  EMPLOYE_CREE: { label: 'Employé créé', color: '#2563eb', bg: '#dbeafe' },
  EMPLOYE_MODIFIE: { label: 'Employé modifié', color: '#d97706', bg: '#fef3c7' },
  EMPLOYE_SUPPRIME: { label: 'Employé supprimé', color: '#dc2626', bg: '#fee2e2' },
  INVITATION_ENVOYEE: { label: 'Invitation envoyée', color: '#2563eb', bg: '#dbeafe' },
  CONSULTATION_DOSSIER: { label: 'Consultation de dossier', color: '#6b7280', bg: '#f3f4f6' },
  EXPORT_DONNEES: { label: 'Export de données', color: '#0891b2', bg: '#cffafe' },
  PARAMETRE_MODIFIE: { label: 'Paramètre modifié', color: '#d97706', bg: '#fef3c7' },
  PREUVE_SOUMISE: { label: 'Preuve soumise', color: '#2563eb', bg: '#dbeafe' },
  PREUVE_VALIDEE: { label: 'Preuve validée', color: '#16a34a', bg: '#dcfce7' },
  PREUVE_REFUSEE: { label: 'Preuve refusée', color: '#dc2626', bg: '#fee2e2' },
  POLITIQUE_PUBLIEE: { label: 'Politique publiée', color: '#2563eb', bg: '#dbeafe' },
  POLITIQUE_MODIFIEE: { label: 'Politique modifiée', color: '#d97706', bg: '#fef3c7' },
  POLITIQUE_CONFIRMEE: { label: 'Politique confirmée', color: '#16a34a', bg: '#dcfce7' },
}

export const GROUPES_AUDIT: { nom: string; types: string[] }[] = [
  { nom: 'Connexions', types: ['CONNEXION', 'CONNEXION_ECHOUEE', 'DECONNEXION'] },
  { nom: 'Suivi des formations', types: ['FORMATION_DEBUT', 'FORMATION_FIN', 'MODULE_PROGRESSION', 'LECON_TERMINEE', 'ATTESTATION_LECTURE', 'QUESTIONNAIRE_REPONSE'] },
  { nom: 'Certificats et preuves', types: ['CERTIFICAT_OBTENU', 'CERTIFICAT_ECHOUE', 'CERTIFICAT_EMIS_MANUELLEMENT', 'PREUVE_SOUMISE', 'PREUVE_VALIDEE', 'PREUVE_REFUSEE'] },
  { nom: 'Gestion des formations', types: ['FORMATION_CREEE', 'FORMATION_MODIFIEE', 'FORMATION_SUPPRIMEE', 'FORMATION_ASSIGNEE', 'SEUIL_MODIFIE'] },
  { nom: 'Employés', types: ['EMPLOYE_CREE', 'EMPLOYE_MODIFIE', 'EMPLOYE_SUPPRIME', 'INVITATION_ENVOYEE', 'CONSULTATION_DOSSIER'] },
  { nom: 'Politiques', types: ['POLITIQUE_PUBLIEE', 'POLITIQUE_MODIFIEE', 'POLITIQUE_CONFIRMEE'] },
  { nom: 'Système et exports', types: ['EXPORT_DONNEES', 'PARAMETRE_MODIFIE'] },
]

export const libelleAudit = (t: string) => LIBELLES_AUDIT[t]?.label ?? t

export type LigneAudit = {
  id: string
  created_at: string
  type_action: string
  description: string
  formation_id: string | null
  acteur_id: string | null
  cible_employe_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  acteur: { id: string; prenom: string; nom: string; email: string; role: string; clinique: string | null } | null
  cible: { id: string; prenom: string; nom: string; email: string } | null
}
