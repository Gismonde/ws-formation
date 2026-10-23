// Recherche du portail employé : formations (titre, description, contenu des leçons), politiques et SOP.
// Insensible aux accents et à la casse ; tous les mots doivent être présents.
import type { SupabaseClient } from '@supabase/supabase-js'
import { politiquesDeLEmploye } from '@/lib/politiques'
import type { Clinique, CliniqueContenu } from '@/lib/cliniques'

export const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const sansMarques = (s: string) => s.replace(/\*\*|\*|^[-•]\s|^\d+\.\s/gm, '')

export function motsDe(q: string): string[] {
  return Array.from(new Set(normaliser(q).split(/[^a-z0-9]+/).filter(m => m.length >= 2))).slice(0, 8)
}

/** Le texte contient-il tous les mots ? (fonction pure, testée) */
export function correspondA(texte: string, mots: string[]): boolean {
  const n = normaliser(texte)
  return mots.length > 0 && mots.every(m => n.includes(m))
}

/** Extrait autour du premier mot trouvé (fonction pure, testée) */
export function extrait(texte: string, mots: string[], largeur = 80): string {
  const propre = sansMarques(texte).replace(/\s+/g, ' ').trim()
  const n = normaliser(propre)
  const i = Math.min(...mots.map(m => n.indexOf(m)).filter(x => x >= 0))
  if (!Number.isFinite(i)) return propre.slice(0, largeur * 2)
  const debut = Math.max(0, i - largeur)
  return (debut > 0 ? '…' : '') + propre.slice(debut, i + largeur) + (i + largeur < propre.length ? '…' : '')
}

export type ResultatRecherche = { type: 'formation' | 'lecon' | 'politique' | 'sop'; id: string; titre: string; sousTitre?: string; extrait?: string; lien: string }

export async function rechercher(
  sb: SupabaseClient, sbUtilisateur: SupabaseClient, q: string,
  e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null },
  espace: { actif: Clinique | null; cliniquesContenu: CliniqueContenu[] },
): Promise<ResultatRecherche[]> {
  const mots = motsDe(q)
  if (!mots.length) return []
  const res: ResultatRecherche[] = []

  // Formations publiées de l'espace
  const { data: fs } = await sb.from('formations').select('id, titre, description, categorie').eq('publiee', true).is('copie_de', null).in('clinique', espace.cliniquesContenu)
  const formations = (fs ?? []) as { id: string; titre: string; description: string | null; categorie: string | null }[]
  for (const f of formations) {
    const texte = `${f.titre} ${f.categorie ?? ''} ${f.description ?? ''}`
    if (correspondA(texte, mots)) res.push({ type: 'formation', id: f.id, titre: f.titre, sousTitre: f.categorie ?? undefined, extrait: f.description ? extrait(f.description, mots) : undefined, lien: `/formations/${f.id}` })
  }
  // Contenu des leçons (titres, textes)
  if (formations.length) {
    const { data: mods } = await sb.from('modules').select('id, formation_id').in('formation_id', formations.map(f => f.id))
    const { data: lecons } = (mods ?? []).length ? await sb.from('lessons').select('id, titre, module_id').in('module_id', (mods ?? []).map(m => m.id)) : { data: [] }
    const { data: blocs } = (lecons ?? []).length
      ? await sb.from('content_blocks').select('lesson_id, titre, contenu').eq('type', 'text').in('lesson_id', (lecons ?? []).map(l => l.id))
      : { data: [] }
    const formationDe = new Map((mods ?? []).map(m => [m.id as string, m.formation_id as string]))
    const vues = new Set<string>()
    for (const l of (lecons ?? []) as { id: string; titre: string; module_id: string }[]) {
      const textes = (blocs ?? []).filter(b => b.lesson_id === l.id).map(b => `${b.titre ?? ''} ${b.contenu ?? ''}`)
      const tout = `${l.titre} ${textes.join(' ')}`
      if (!correspondA(tout, mots) || vues.has(l.id)) continue
      vues.add(l.id)
      const f = formations.find(x => x.id === formationDe.get(l.module_id))
      if (!f) continue
      const passage = textes.find(x => correspondA(x, mots.slice(0, 1))) ?? l.titre
      res.push({ type: 'lecon', id: l.id, titre: l.titre, sousTitre: f.titre, extrait: extrait(passage, mots), lien: `/formations/${f.id}/lecon/${l.id}` })
    }
  }
  // Politiques visées pour l'employé
  try {
    for (const p of await politiquesDeLEmploye(sb, e, espace.actif)) {
      if (correspondA(`${p.titre} ${p.description ?? ''}`, mots)) res.push({ type: 'politique', id: p.id, titre: p.titre, extrait: p.description ? extrait(p.description, mots) : undefined, lien: `/dashboard/politiques/${p.id}` })
    }
  } catch { /* table absente */ }
  // SOP accessibles (le RLS filtre selon le rôle)
  const { data: sops } = await sbUtilisateur.from('sop').select('id, titre, description, categorie').in('clinique', espace.cliniquesContenu)
  for (const s of (sops ?? []) as { id: string; titre: string; description: string | null; categorie: string | null }[]) {
    if (correspondA(`${s.titre} ${s.categorie ?? ''} ${s.description ?? ''}`, mots)) res.push({ type: 'sop', id: s.id, titre: s.titre, sousTitre: s.categorie ?? undefined, extrait: s.description ? extrait(s.description, mots) : undefined, lien: '/dashboard/sop' })
  }
  return res.slice(0, 60)
}
