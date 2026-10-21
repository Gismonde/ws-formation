// Librairie : vidéos, liens et documents réutilisables dans les leçons.
// Un bloc de leçon y fait référence par metadata.librairie_id ; modifier l'élément met à jour ces blocs.
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Acteur, peutCreerFormations, peutVoirContenu, peutGererContenu, cliniquesContenuGerables } from '@/lib/permissions'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import type { CliniqueContenu } from '@/lib/cliniques'
import { TYPES_LIBRAIRIE, type ElementLibrairie, type TypeLibrairie, type Utilisation } from '@/lib/librairie-commun'
export * from '@/lib/librairie-commun'

export const CHAMPS_LIBRAIRIE = 'id, type, titre, description, url, nom_fichier, categorie, clinique, archive, source, modifie_le'

/** Voir la librairie : ceux qui peuvent créer des formations, pour les éléments de leurs cliniques. */
export function peutVoirLibrairie(a: Acteur | null, clinique?: string | null): boolean {
  return !!a && peutCreerFormations(a) && (clinique === undefined || peutVoirContenu(a, clinique))
}

/** Ajouter / modifier / archiver un élément de cette clinique. */
export function peutGererLibrairie(a: Acteur | null, clinique: string | null | undefined): boolean {
  return !!a && peutCreerFormations(a) && peutGererContenu(a, clinique)
}

export function cliniquesLibrairiePossibles(a: Acteur): CliniqueContenu[] {
  return cliniquesContenuGerables(a)
}

type Brut = Record<string, unknown>
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Valide les champs envoyés par le formulaire (création ou modification). */
export function validerElement(b: Brut, a: Acteur, existant?: Pick<ElementLibrairie, 'type'>): { erreur: string } | { valeurs: Omit<ElementLibrairie, 'id' | 'archive' | 'source' | 'modifie_le'> } {
  const type = (existant?.type ?? b.type) as TypeLibrairie
  if (!TYPES_LIBRAIRIE.includes(type)) return { erreur: 'Type invalide' }
  const titre = texte(b.titre, 300)
  if (!titre) return { erreur: 'Le titre est obligatoire.' }
  const url = texte(b.url, 2000)
  if (!url) return { erreur: type === 'document' ? 'Téléversez un document ou collez son adresse.' : 'L’adresse est obligatoire.' }
  if (!estMediaPrive(url)) {
    let ok = false
    try { ok = ['https:', 'http:'].includes(new URL(url).protocol) } catch { ok = false }
    if (!ok) return { erreur: 'Adresse invalide : elle doit commencer par https://' }
  } else if (type === 'lien') {
    return { erreur: 'Un lien doit être une adresse https://' }
  }
  if (type === 'video' && !estMediaPrive(url) && !analyserVideoEnLigne(url) && !/sharepoint\.com/i.test(url)) {
    return { erreur: 'Vidéo non reconnue : collez un lien YouTube, Vimeo ou SharePoint, ou téléversez un fichier.' }
  }
  const clinique = b.clinique as CliniqueContenu
  if (!cliniquesLibrairiePossibles(a).includes(clinique)) return { erreur: 'Clinique non autorisée' }
  return {
    valeurs: {
      type, titre, url, clinique,
      description: texte(b.description, 2000) || null,
      categorie: texte(b.categorie, 80) || null,
      nom_fichier: texte(b.nom_fichier, 200) || null,
    },
  }
}

// ---------------------------------------------------------------------------
// Utilisation dans les leçons


/** Blocs qui font référence aux éléments donnés, avec la formation correspondante. */
export async function utilisations(sb: SupabaseClient, ids?: string[]): Promise<Map<string, Utilisation[]>> {
  let q = sb.from('content_blocks').select('id, lesson_id, metadata').not('metadata->>librairie_id', 'is', null)
  if (ids?.length) q = q.in('metadata->>librairie_id', ids)
  const { data: blocs } = await q
  const res = new Map<string, Utilisation[]>()
  if (!blocs?.length) return res
  const leconIds = Array.from(new Set(blocs.map(b => b.lesson_id as string)))
  const { data: lecons } = await sb.from('lessons').select('id, titre, module_id').in('id', leconIds)
  const moduleIds = Array.from(new Set((lecons ?? []).map(l => l.module_id as string)))
  const { data: modules } = moduleIds.length ? await sb.from('modules').select('id, titre, formation_id').in('id', moduleIds) : { data: [] as { id: string; titre: string; formation_id: string }[] }
  const formationIds = Array.from(new Set((modules ?? []).map(m => m.formation_id as string)))
  const { data: formations } = formationIds.length ? await sb.from('formations').select('id, titre').in('id', formationIds) : { data: [] as { id: string; titre: string }[] }
  for (const b of blocs) {
    const lid = (b.metadata as { librairie_id?: string } | null)?.librairie_id
    if (!lid) continue
    const l = (lecons ?? []).find(x => x.id === b.lesson_id)
    const m = (modules ?? []).find(x => x.id === l?.module_id)
    const f = (formations ?? []).find(x => x.id === m?.formation_id)
    res.set(lid, [...(res.get(lid) ?? []), { bloc_id: b.id, lecon: l?.titre ?? '', module: m?.titre ?? '', formation_id: f?.id ?? '', formation: f?.titre ?? '' }])
  }
  return res
}

/** Répercute un élément modifié sur les blocs qui l'utilisent (adresse, nom du fichier, titre resté identique). */
export async function propagerAuxBlocs(sb: SupabaseClient, avant: ElementLibrairie, apres: ElementLibrairie): Promise<number> {
  const { data: blocs } = await sb.from('content_blocks').select('id, titre, metadata').eq('metadata->>librairie_id', apres.id)
  let n = 0
  for (const b of blocs ?? []) {
    const metadata = { ...((b.metadata as Record<string, unknown>) ?? {}), librairie_id: apres.id, ...(apres.nom_fichier ? { nom_fichier: apres.nom_fichier } : {}) }
    const maj: Record<string, unknown> = { url: apres.url, contenu: null, metadata }
    if (!b.titre || b.titre === avant.titre) maj.titre = apres.titre
    const { error } = await sb.from('content_blocks').update(maj).eq('id', b.id)
    if (!error) n++
  }
  return n
}
