// Brancher la librairie : remplace les blocs « … à ajouter : « Titre » … » d'une formation
// par l'élément de la librairie qui porte ce titre (vidéo, lien ou document).
import type { SupabaseClient } from '@supabase/supabase-js'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import type { ElementLibrairie } from '@/lib/librairie-commun'

export type BlocAttente = { id: string; lecon: string; module: string; texte: string }
export type Correspondance = {
  bloc_id: string; module: string; lecon: string; cherche: string
  element: Pick<ElementLibrairie, 'id' | 'titre' | 'type' | 'url' | 'nom_fichier'> | null
}

/** Titre entre guillemets dans un bloc « à ajouter », sinon null. */
export function titreAttendu(texte: string | null | undefined): string | null {
  if (!texte || !/à ajouter/i.test(texte)) return null
  const m = texte.match(/«\s*([^»]+?)\s*»/)
  return m ? m[1] : null
}

export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[·’'"«»():\-–_,.!?/]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Meilleur élément pour un titre : identique, sinon l'un contient l'autre (le plus proche en longueur). */
export function meilleurElement<T extends { titre: string }>(cherche: string, elements: T[]): T | null {
  const n = normaliser(cherche)
  if (!n) return null
  const exact = elements.find(e => normaliser(e.titre) === n)
  if (exact) return exact
  const proches = elements
    .map(e => ({ e, t: normaliser(e.titre) }))
    .filter(({ t }) => t.length >= 8 && n.length >= 8 && (t.includes(n) || n.includes(t)))
    .sort((a, b) => Math.abs(a.t.length - n.length) - Math.abs(b.t.length - n.length))
  return proches[0]?.e ?? null
}

/** Bloc prêt à enregistrer à partir d'un élément de la librairie (même règle que l'éditeur). */
export function blocDepuisElement(e: Pick<ElementLibrairie, 'id' | 'titre' | 'type' | 'url' | 'nom_fichier'>) {
  const integrable = e.type === 'video' && (estMediaPrive(e.url) || !!analyserVideoEnLigne(e.url))
  return {
    type: integrable ? 'video' : 'file',
    titre: e.titre,
    url: e.url,
    contenu: null,
    metadata: { librairie_id: e.id, ...(e.nom_fichier ? { nom_fichier: e.nom_fichier } : {}) },
  }
}

/** Blocs « à ajouter » d'une formation, dans l'ordre des modules et leçons. */
export async function blocsEnAttente(sb: SupabaseClient, formationId: string): Promise<BlocAttente[]> {
  const { data: modules } = await sb.from('modules').select('id, titre, ordre').eq('formation_id', formationId).order('ordre')
  if (!modules?.length) return []
  const { data: lecons } = await sb.from('lessons').select('id, titre, ordre, module_id').in('module_id', modules.map(m => m.id)).order('ordre')
  if (!lecons?.length) return []
  const { data: blocs } = await sb.from('content_blocks').select('id, lesson_id, type, contenu, ordre')
    .in('lesson_id', lecons.map(l => l.id)).eq('type', 'text').ilike('contenu', '%à ajouter%').order('ordre')
  const res: BlocAttente[] = []
  for (const m of modules) for (const l of lecons.filter(x => x.module_id === m.id)) {
    for (const b of (blocs ?? []).filter(x => x.lesson_id === l.id)) {
      res.push({ id: b.id, lecon: l.titre, module: m.titre, texte: b.contenu ?? '' })
    }
  }
  return res
}

export function correspondances(blocs: BlocAttente[], elements: Pick<ElementLibrairie, 'id' | 'titre' | 'type' | 'url' | 'nom_fichier'>[]): Correspondance[] {
  return blocs.map(b => {
    const cherche = titreAttendu(b.texte) ?? b.lecon
    return { bloc_id: b.id, module: b.module, lecon: b.lecon, cherche, element: meilleurElement(cherche, elements) }
  })
}
