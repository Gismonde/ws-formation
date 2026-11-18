// Désassigner une formation d'un employé : la formation quitte « Mes formations », sans courriel.
// La progression, les tentatives et les certificats sont conservés (une réassignation reprend où l'employé en était).
// Une formation ouverte à tous reste visible dans « Formations disponibles ».
import type { SupabaseClient } from '@supabase/supabase-js'
import { peutGererEmploye, peutVoirContenu, type Acteur } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

export type ResultatDesassignation = { ok: true; retirees: number } | { ok: false; erreur: string; statut: number }

export async function desassignerFormation(
  sb: SupabaseClient, acteur: Acteur, employeId: string, formationId: string, meta: { ip_address?: string | null; user_agent?: string | null } = {},
): Promise<ResultatDesassignation> {
  const [{ data: emp }, { data: f }] = await Promise.all([
    sb.from('employes').select('id, prenom, nom, role, clinique, departement_id').eq('id', employeId).maybeSingle(),
    sb.from('formations').select('id, titre, clinique').eq('id', formationId).maybeSingle(),
  ])
  if (!emp || !f) return { ok: false, erreur: 'Employé ou formation introuvable.', statut: 404 }
  if (!peutGererEmploye(acteur, emp) || !peutVoirContenu(acteur, f.clinique)) return { ok: false, erreur: 'Vous ne pouvez pas modifier les formations de cet employé.', statut: 403 }

  const { data, error } = await sb.from('assignations').delete().eq('employe_id', employeId).eq('formation_id', formationId).select('id')
  if (error) return { ok: false, erreur: error.message, statut: 500 }
  const retirees = (data ?? []).length
  if (retirees === 0) return { ok: false, erreur: 'Cette formation n’est plus assignée à cet employé.', statut: 404 }

  await logAudit({
    acteur_id: acteur.id, cible_employe_id: emp.id, formation_id: f.id, type_action: 'FORMATION_DESASSIGNEE',
    description: `Formation « ${f.titre} » désassignée de ${[emp.prenom, emp.nom].filter(Boolean).join(' ')} (progression et certificats conservés)`,
    metadata: { formation_id: f.id }, ...meta,
  })
  return { ok: true, retirees }
}
