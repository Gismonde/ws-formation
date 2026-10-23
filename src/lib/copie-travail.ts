// Copie de travail d'une formation publiée.
//   1. « Modifier sans déranger les employés » : copie complète en brouillon, liée à la formation (copie_de).
//   2. On modifie la copie, on l'envoie en validation (même circuit qu'une nouvelle formation).
//   3. Une fois approuvée, on l'applique : le contenu de la formation publiée est remplacé d'un coup,
//      la progression des employés est conservée (fonction SQL appliquer_copie_formation), version + 1.
import { serviceClient, peutCreerFormations, peutGererContenu, type Acteur } from '@/lib/permissions'
import { dupliquerFormation } from '@/lib/dupliquer-formation'
import { logAudit } from '@/lib/audit'
import { publicationPermise, type FormationValidation } from '@/lib/validation-formation'
import { refusModification } from '@/lib/droits-formation'
import type { CliniqueContenu } from '@/lib/cliniques'

type Resultat<T> = { ok: true; data: T } | { ok: false; erreur: string; statut?: number }

/** Réglages de la formation qui ne passent pas de la copie à l'original lors de l'application */
const NON_RECOPIES = new Set([
  'id', 'created_at', 'updated_at', 'copie_de', 'clinique', 'creee_par', 'publiee', 'publiee_le', 'version', 'version_le',
  'statut_validation', 'validateur_id', 'validation_demandee_le', 'validation_demandee_par', 'validation_le', 'validation_commentaire', 'validee_par',
])

/** Champs à recopier de la copie vers l'original (fonction pure, testée) */
export function reglagesARecopier(copie: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(copie).filter(([k]) => !NON_RECOPIES.has(k)))
}

/** La copie de travail en cours d'une formation (s'il y en a une) */
export async function copieEnCours(formationId: string): Promise<{ id: string; statut_validation: string | null; updated_at: string | null } | null> {
  const { data } = await serviceClient().from('formations').select('id, statut_validation, updated_at').eq('copie_de', formationId).maybeSingle()
  return (data as { id: string; statut_validation: string | null; updated_at: string | null } | null) ?? null
}

/** Crée la copie de travail (ou renvoie celle qui existe déjà). */
export async function creerCopieTravail(acteur: Acteur, formationId: string): Promise<Resultat<{ id: string; existante: boolean }>> {
  if (!peutCreerFormations(acteur)) return { ok: false, erreur: 'Accès refusé', statut: 403 }
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique, publiee, copie_de').eq('id', formationId).maybeSingle()
  if (!f) return { ok: false, erreur: 'Formation introuvable', statut: 404 }
  if (!('copie_de' in f)) return { ok: false, erreur: 'Exécutez d’abord supabase/migrations/copie_travail.sql dans Supabase.' }
  if (f.copie_de) return { ok: false, erreur: 'Cette formation est déjà une copie de travail.' }
  if (!peutGererContenu(acteur, f.clinique)) return { ok: false, erreur: 'Formation hors de votre périmètre', statut: 403 }
  { const refus = await refusModification(acteur, formationId); if (refus) return { ok: false, erreur: refus, statut: 403 } }
  const deja = await copieEnCours(formationId)
  if (deja) return { ok: true, data: { id: deja.id, existante: true } }
  try {
    const r = await dupliquerFormation(sb, formationId, { clinique: (f.clinique ?? 'LES_DEUX') as CliniqueContenu, titre: f.titre as string, creePar: acteur.id, copieDe: formationId })
    await logAudit({
      acteur_id: acteur.id, formation_id: formationId, type_action: 'FORMATION_MODIFIEE',
      description: 'Copie de travail créée : les modifications ne seront visibles des employés qu’après validation et application',
      metadata: { historique: true, copie: r.id },
    })
    return { ok: true, data: { id: r.id, existante: false } }
  } catch (e) {
    // Deux clics simultanés : l'index unique empêche une seconde copie
    const deja2 = await copieEnCours(formationId)
    if (deja2) return { ok: true, data: { id: deja2.id, existante: true } }
    return { ok: false, erreur: e instanceof Error ? e.message : 'Copie impossible' }
  }
}

/** Applique une copie approuvée à la formation publiée : contenu remplacé, version + 1, copie retirée. */
export async function appliquerCopieTravail(acteur: Acteur, copieId: string, note: string): Promise<Resultat<{ formationId: string; version: number | null }>> {
  if (!peutCreerFormations(acteur)) return { ok: false, erreur: 'Accès refusé', statut: 403 }
  const sb = serviceClient()
  const { data: copie } = await sb.from('formations').select('*').eq('id', copieId).maybeSingle()
  if (!copie?.copie_de) return { ok: false, erreur: 'Copie de travail introuvable', statut: 404 }
  if (!peutGererContenu(acteur, copie.clinique)) return { ok: false, erreur: 'Formation hors de votre périmètre', statut: 403 }
  if (!publicationPermise(acteur, copie as FormationValidation)) return { ok: false, erreur: 'La copie doit d’abord être approuvée par un validateur.' }
  { const refus = await refusModification(acteur, copie.copie_de as string); if (refus) return { ok: false, erreur: refus, statut: 403 } }
  const texte = note.trim().slice(0, 1000)
  if (!texte) return { ok: false, erreur: 'Décrivez ce qui a changé dans cette version.' }
  const origId = copie.copie_de as string
  const { data: orig } = await sb.from('formations').select('*').eq('id', origId).maybeSingle()
  if (!orig) return { ok: false, erreur: 'Formation d’origine introuvable', statut: 404 }

  // 1. Contenu et progression, en une transaction
  const { error: eRpc } = await sb.rpc('appliquer_copie_formation', { p_copie: copieId })
  if (eRpc) return { ok: false, erreur: eRpc.message }

  // 2. Réglages et approbation (portée par la copie)
  const maintenant = new Date().toISOString()
  const dejaPubliee = !!orig.publiee_le
  const version = dejaPubliee ? (Number(orig.version) || 1) + 1 : null
  const maj: Record<string, unknown> = {
    ...reglagesARecopier(copie),
    statut_validation: copie.statut_validation ?? null, validateur_id: copie.validateur_id ?? null,
    validation_demandee_par: copie.validation_demandee_par ?? null, validation_demandee_le: copie.validation_demandee_le ?? null,
    validation_le: copie.validation_le ?? null, validation_commentaire: copie.validation_commentaire ?? null, validee_par: copie.validee_par ?? null,
    ...(version ? { version, version_le: maintenant } : {}),
  }
  for (const k of Object.keys(maj)) if (!(k in orig)) delete maj[k]
  const { error: eMaj } = await sb.from('formations').update(maj).eq('id', origId)
  if (eMaj) return { ok: false, erreur: 'Contenu appliqué, mais réglages non recopiés : ' + eMaj.message }
  if (version) await sb.from('formations_versions').insert({ formation_id: origId, version, publiee_le: maintenant, note: texte, publiee_par: acteur.id })

  // 3. La copie (désormais vide) est retirée
  await sb.from('formations').delete().eq('id', copieId)
  await logAudit({
    acteur_id: acteur.id, formation_id: origId, type_action: 'FORMATION_MODIFIEE',
    description: version ? `Copie de travail appliquée — version ${version} : ${texte}` : `Copie de travail appliquée : ${texte}`,
    metadata: { historique: true, copie: copieId, version },
  })
  return { ok: true, data: { formationId: origId, version } }
}

/** Abandonne la copie de travail : la formation publiée reste telle quelle. */
export async function abandonnerCopieTravail(acteur: Acteur, copieId: string): Promise<Resultat<{ formationId: string }>> {
  if (!peutCreerFormations(acteur)) return { ok: false, erreur: 'Accès refusé', statut: 403 }
  const sb = serviceClient()
  const { data: copie } = await sb.from('formations').select('id, clinique, copie_de').eq('id', copieId).maybeSingle()
  if (!copie?.copie_de) return { ok: false, erreur: 'Copie de travail introuvable', statut: 404 }
  if (!peutGererContenu(acteur, copie.clinique)) return { ok: false, erreur: 'Formation hors de votre périmètre', statut: 403 }
  const { error } = await sb.from('formations').delete().eq('id', copieId)
  if (error) return { ok: false, erreur: error.message }
  await logAudit({
    acteur_id: acteur.id, formation_id: copie.copie_de as string, type_action: 'FORMATION_MODIFIEE',
    description: 'Copie de travail abandonnée : la formation publiée est inchangée', metadata: { historique: true, copie: copieId },
  })
  return { ok: true, data: { formationId: copie.copie_de as string } }
}
