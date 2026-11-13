import { createClient as createServiceClient } from '@supabase/supabase-js'

export type AuditActionType =
    // Actions employés
  | 'CONNEXION'
  | 'DECONNEXION'
  | 'CONNEXION_ECHOUEE'
  | 'FORMATION_DEBUT'
  | 'FORMATION_FIN'
  | 'MODULE_PROGRESSION'
  | 'QUESTIONNAIRE_REPONSE'
  | 'CERTIFICAT_OBTENU'
  | 'CERTIFICAT_ECHOUE'
  // Actions administrateurs
  | 'FORMATION_CREEE'
  | 'FORMATION_MODIFIEE'
  | 'FORMATION_SUPPRIMEE'
  | 'FORMATION_ASSIGNEE'
  | 'SEUIL_MODIFIE'
  | 'CERTIFICAT_EMIS_MANUELLEMENT'
  | 'EMPLOYE_CREE'
  | 'EMPLOYE_MODIFIE'
  | 'EMPLOYE_SUPPRIME'
  // Événements système
  | 'EXPORT_DONNEES'
  | 'PARAMETRE_MODIFIE'
  | 'PREUVE_SOUMISE'
  | 'PREUVE_VALIDEE'
  | 'PREUVE_REFUSEE'
  | 'ATTESTATION_LECTURE'
  | 'LECON_TERMINEE'
  | 'INVITATION_ENVOYEE'
  | 'POLITIQUE_PUBLIEE'
  | 'POLITIQUE_MODIFIEE'
  | 'POLITIQUE_CONFIRMEE'
  | 'FORMULAIRE_CREE'
  | 'FORMULAIRE_MODIFIE'
  | 'FORMULAIRE_SOUMIS'
  | 'FORMULAIRE_TRAITE'
  | 'CONSULTATION_DOSSIER'
  // Formations disponibles hors assignation
  | 'INSCRIPTION_VOLONTAIRE'
  | 'DEMANDE_ACCES_ENVOYEE'
  | 'DEMANDE_ACCES_TRAITEE'
  | 'FORMATION_DESASSIGNEE'

/** Type existant utilisé si un nouveau type n'est pas encore dans l'énumération de la base */
const TYPES_DE_REPLI: Partial<Record<AuditActionType, AuditActionType>> = {
  INSCRIPTION_VOLONTAIRE: 'FORMATION_ASSIGNEE',
  DEMANDE_ACCES_ENVOYEE: 'FORMATION_ASSIGNEE',
  DEMANDE_ACCES_TRAITEE: 'FORMATION_ASSIGNEE',
  FORMATION_DESASSIGNEE: 'FORMATION_ASSIGNEE',
}

export interface LogAuditParams {
    acteur_id: string
    type_action: AuditActionType
    description: string
    formation_id?: string | null
    cible_employe_id?: string | null
    metadata?: Record<string, any> | null
    ip_address?: string | null
    user_agent?: string | null
}

  /**
 * Enregistre une entrée dans l'audit log.
 * Utilise le service role key pour contourner les RLS et garantir l'immuabilité.
 * Les logs ne sont jamais modifiés ou supprimés.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
    try {
          const serviceClient = createServiceClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
                )

      const ligne = {
                      acteur_id: params.acteur_id,
                      type_action: params.type_action as string,
                      description: params.description,
                      formation_id: params.formation_id ?? null,
                      cible_employe_id: params.cible_employe_id ?? null,
                      metadata: params.metadata ?? null,
                      ip_address: params.ip_address ?? null,
                      user_agent: params.user_agent ?? null,
            }
      let { error } = await serviceClient.from('audit_logs').insert(ligne)
      // Type pas encore ajouté à l'énumération de la base (migration non exécutée) : on garde la trace sous un type voisin
      const repli = TYPES_DE_REPLI[params.type_action]
      if (error && repli && /enum|invalid input value/i.test(error.message)) {
              ({ error } = await serviceClient.from('audit_logs').insert({ ...ligne, type_action: repli, metadata: { ...(ligne.metadata ?? {}), type_prevu: params.type_action } }))
      }

      if (error) {
              console.error('[AuditLog] Erreur lors de l\'enregistrement:', error.message)
      }
    } catch (err) {
          // Ne jamais bloquer le flux principal à cause d'un log
      console.error('[AuditLog] Exception:', err)
    }
}
