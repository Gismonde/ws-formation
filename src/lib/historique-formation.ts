// Historique des modifications d'une formation : chaque changement est noté au journal d'audit
// (FORMATION_MODIFIEE, formation_id). Les enregistrements automatiques répétés (contenu d'un bloc)
// sont regroupés : une seule ligne par personne, leçon et quart d'heure.
import { serviceClient, type Acteur } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { invaliderApprobation } from '@/lib/validation-formation'

const REGROUPEMENT_MS = 15 * 60 * 1000

export async function formationDuModule(moduleId: string) {
  const { data } = await serviceClient().from('modules').select('titre, formation_id').eq('id', moduleId).maybeSingle()
  return data ? { formationId: data.formation_id as string, module: data.titre as string } : null
}

export async function formationDeLaLecon(leconId: string) {
  const { data } = await serviceClient().from('lessons').select('titre, module_id, modules(titre, formation_id)').eq('id', leconId).maybeSingle()
  const m = data?.modules as { titre?: string; formation_id?: string } | { titre?: string; formation_id?: string }[] | null | undefined
  const mod = Array.isArray(m) ? m[0] : m
  return data && mod?.formation_id ? { formationId: mod.formation_id, lecon: data.titre as string, module: mod.titre ?? '' } : null
}

export async function formationDuBloc(blocId: string) {
  const { data } = await serviceClient().from('content_blocks').select('lesson_id').eq('id', blocId).maybeSingle()
  if (!data) return null
  const l = await formationDeLaLecon(data.lesson_id as string)
  return l ? { ...l, leconId: data.lesson_id as string } : null
}

/**
 * Note une modification. `regrouper` : clé d'un changement répété (ex. contenu d'une leçon) noté au plus une fois par quart d'heure.
 * Une modification remet une formation approuvée en brouillon (sauf `invalider: false`, ex. publication).
 */
export async function noterModification(acteur: Acteur, formationId: string | null | undefined, description: string, regrouper?: string, options: { invalider?: boolean } = {}) {
  if (!formationId) return
  if (options.invalider !== false) {
    try {
      if (await invaliderApprobation(formationId)) {
        await logAudit({ acteur_id: acteur.id, formation_id: formationId, type_action: 'FORMATION_MODIFIEE', description: 'Approbation annulée : la formation a été modifiée après sa validation', metadata: { historique: true, validation: 'invalidee' } })
      }
    } catch { /* colonne absente : validation non activée */ }
  }
  try {
    if (regrouper) {
      const depuis = new Date(Date.now() - REGROUPEMENT_MS).toISOString()
      const { data } = await serviceClient().from('audit_logs').select('id')
        .eq('acteur_id', acteur.id).eq('formation_id', formationId).eq('type_action', 'FORMATION_MODIFIEE')
        .eq('metadata->>regrouper', regrouper).gte('created_at', depuis).limit(1)
      if (data?.length) return
    }
    // Copie de travail : l'historique reste rattaché à la formation publiée une fois la copie appliquée
    const { data: f } = await serviceClient().from('formations').select('copie_de').eq('id', formationId).maybeSingle()
    const original = (f as { copie_de?: string | null } | null)?.copie_de ?? null
    await logAudit({ acteur_id: acteur.id, formation_id: formationId, type_action: 'FORMATION_MODIFIEE', description: original ? `[Copie de travail] ${description}` : description, metadata: { historique: true, ...(regrouper ? { regrouper } : {}), ...(original ? { formation_originale: original } : {}) } })
  } catch {
    // L'historique ne doit jamais bloquer une modification
  }
}

export type LigneHistorique = { id: string; quand: string; qui: string; quoi: string }

/** Dernières modifications d'une formation (création, réglages, contenu, questionnaire, publication…). */
export async function historiqueFormation(formationId: string, limite = 60): Promise<LigneHistorique[]> {
  const sb = serviceClient()
  const { data } = await sb.from('audit_logs').select('id, created_at, acteur_id, description, type_action')
    .or(`formation_id.eq.${formationId},metadata->>formation_originale.eq.${formationId}`).in('type_action', ['FORMATION_CREEE', 'FORMATION_MODIFIEE'])
    .order('created_at', { ascending: false }).limit(limite)
  const ids = Array.from(new Set((data ?? []).map(l => l.acteur_id as string).filter(Boolean)))
  const { data: emps } = ids.length ? await sb.from('employes').select('id, prenom, nom').in('id', ids) : { data: [] as { id: string; prenom: string | null; nom: string | null }[] }
  const nom = new Map((emps ?? []).map(e => [e.id, [e.prenom, e.nom].filter(Boolean).join(' ')]))
  return (data ?? []).map(l => ({ id: l.id as string, quand: l.created_at as string, qui: nom.get(l.acteur_id as string) || '—', quoi: l.description as string }))
}
