// Ajouts ciblés dans une formation en brouillon, sans toucher au reste du contenu
// (contrairement à l'import avec « remplacer_id », qui remplace tout).
//   blocs   : [{ lecon, apres?, bloc }]  — insère un bloc dans une leçon (après le bloc titré « apres », sinon à la fin)
//   modifs  : [{ lecon, bloc, champs }]   — modifie titre/contenu/url/metadata d'un bloc existant (repéré par son titre)
//   lecons  : [{ module, apres?, titre, description?, duree_minutes?, blocs }] — ajoute une leçon dans un module
//   reglages: { image_couverture?, acces_hors_assignation? } — réglages simples de la formation
//   publier : true                         — publie la formation à la fin (première version notée si besoin)
// La « clinique affichée » de l'espace Admin ne limite pas cette route (seulement les droits réels).
// Réservé aux administrateurs qui gèrent la clinique de la formation.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuGerablesToutes } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const TYPES = ['text', 'image', 'video', 'file', 'slide', 'quiz', 'interactif']
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
type Bloc = { type: string; titre?: string; contenu?: string; url?: string; metadata?: Record<string, unknown> }
const ligne = (b: Bloc) => ({
  type: b.type, titre: txt(b.titre, 300) || null, contenu: typeof b.contenu === 'string' ? b.contenu.slice(0, 20000) : null,
  url: txt(b.url, 2000) || null, metadata: b.metadata && typeof b.metadata === 'object' ? b.metadata : {},
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await getActeur()
  if (!a || (a.role !== 'super_admin' && a.role !== 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => null)
  if (!c) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, publiee, clinique').eq('id', id).maybeSingle()
  if (!f) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  if (!cliniquesContenuGerablesToutes(a).includes((f.clinique ?? 'LES_DEUX') as never)) return NextResponse.json({ error: 'Hors de votre périmètre' }, { status: 403 })
  if (f.publiee) return NextResponse.json({ error: 'Formation publiée : repassez-la en brouillon d’abord' }, { status: 409 })

  const { data: mods } = await sb.from('modules').select('id, titre, ordre').eq('formation_id', id).order('ordre')
  const modIds = (mods ?? []).map(m => m.id)
  const { data: lecs } = modIds.length ? await sb.from('lessons').select('id, titre, module_id, ordre').in('module_id', modIds).order('ordre') : { data: [] as { id: string; titre: string; module_id: string; ordre: number }[] }
  const lecon = (t: string) => (lecs ?? []).find(l => l.titre === t)
  const journal: string[] = []

  for (const r of (Array.isArray(c.lecons) ? c.lecons : []) as { module: string; apres?: string; titre: string; description?: string; duree_minutes?: number; blocs?: Bloc[] }[]) {
    const m = (mods ?? []).find(x => x.titre === r.module)
    if (!m) return NextResponse.json({ error: `Module introuvable : ${r.module}`, journal }, { status: 400 })
    if ((r.blocs ?? []).some(b => !TYPES.includes(b.type))) return NextResponse.json({ error: 'Type de bloc inconnu', journal }, { status: 400 })
    const soeurs = (lecs ?? []).filter(l => l.module_id === m.id).sort((x, y) => x.ordre - y.ordre)
    const i = r.apres ? soeurs.findIndex(l => l.titre === r.apres) : soeurs.length - 1
    if (r.apres && i < 0) return NextResponse.json({ error: `Leçon introuvable : ${r.apres}`, journal }, { status: 400 })
    for (const l of soeurs.slice(i + 1)) await sb.from('lessons').update({ ordre: l.ordre + 1 }).eq('id', l.id)
    const ordre = (soeurs[i]?.ordre ?? 0) + 1
    const { data: n, error } = await sb.from('lessons').insert({ module_id: m.id, titre: txt(r.titre, 300), description: txt(r.description, 2000) || null, ordre, duree_minutes: Number(r.duree_minutes) || 5 }).select('id, titre, module_id, ordre').single()
    if (error || !n) return NextResponse.json({ error: error?.message ?? 'Leçon', journal }, { status: 500 })
    const blocs = (r.blocs ?? []).map((b, k) => ({ ...ligne(b), lesson_id: n.id, ordre: k + 1 }))
    if (blocs.length) { const { error: eb } = await sb.from('content_blocks').insert(blocs); if (eb) return NextResponse.json({ error: eb.message, journal }, { status: 500 }) }
    lecs?.push(n)
    journal.push(`Leçon ajoutée : « ${n.titre} »`)
  }

  for (const r of (Array.isArray(c.blocs) ? c.blocs : []) as { lecon: string; apres?: string; bloc: Bloc }[]) {
    const l = lecon(r.lecon)
    if (!l) return NextResponse.json({ error: `Leçon introuvable : ${r.lecon}`, journal }, { status: 400 })
    if (!TYPES.includes(r.bloc?.type)) return NextResponse.json({ error: 'Type de bloc inconnu', journal }, { status: 400 })
    const { data: bl } = await sb.from('content_blocks').select('id, titre, ordre').eq('lesson_id', l.id).order('ordre')
    const liste = bl ?? []
    const i = r.apres ? liste.findIndex(b => b.titre === r.apres) : liste.length - 1
    if (r.apres && i < 0) return NextResponse.json({ error: `Bloc introuvable : ${r.apres} (${r.lecon})`, journal }, { status: 400 })
    // Renumérote pour laisser la place
    for (let k = liste.length - 1; k > i; k--) await sb.from('content_blocks').update({ ordre: k + 2 }).eq('id', liste[k].id)
    const { error } = await sb.from('content_blocks').insert({ ...ligne(r.bloc), lesson_id: l.id, ordre: i + 2 })
    if (error) return NextResponse.json({ error: error.message, journal }, { status: 500 })
    journal.push(`Bloc ajouté dans « ${l.titre} » : ${r.bloc.titre ?? r.bloc.type}`)
  }

  for (const r of (Array.isArray(c.modifs) ? c.modifs : []) as { lecon: string; bloc: string; champs: Partial<Bloc> }[]) {
    const l = lecon(r.lecon)
    if (!l) return NextResponse.json({ error: `Leçon introuvable : ${r.lecon}`, journal }, { status: 400 })
    const { data: b } = await sb.from('content_blocks').select('id').eq('lesson_id', l.id).eq('titre', r.bloc).maybeSingle()
    if (!b) return NextResponse.json({ error: `Bloc introuvable : ${r.bloc} (${r.lecon})`, journal }, { status: 400 })
    const maj: Record<string, unknown> = {}
    if (typeof r.champs.titre === 'string') maj.titre = txt(r.champs.titre, 300)
    if (typeof r.champs.contenu === 'string') maj.contenu = r.champs.contenu.slice(0, 20000)
    if (typeof r.champs.url === 'string') maj.url = txt(r.champs.url, 2000)
    if (r.champs.metadata && typeof r.champs.metadata === 'object') maj.metadata = r.champs.metadata
    const { error } = await sb.from('content_blocks').update(maj).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message, journal }, { status: 500 })
    journal.push(`Bloc modifié dans « ${l.titre} » : ${r.bloc}`)
  }

  if (c.reglages && typeof c.reglages === 'object') {
    const maj: Record<string, unknown> = {}
    if (typeof c.reglages.image_couverture === 'string') maj.image_couverture = txt(c.reglages.image_couverture, 1000) || null
    if (['aucun', 'libre', 'demande'].includes(c.reglages.acces_hors_assignation)) maj.acces_hors_assignation = c.reglages.acces_hors_assignation
    if (Object.keys(maj).length) {
      const { error } = await sb.from('formations').update(maj).eq('id', id)
      if (error) return NextResponse.json({ error: error.message, journal }, { status: 500 })
      journal.push('Réglages modifiés : ' + Object.keys(maj).join(', '))
    }
  }

  if (c.publier === true) {
    const { data: fr } = await sb.from('formations').select('*').eq('id', id).single()
    const { error } = await sb.from('formations').update({ publiee: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message, journal }, { status: 500 })
    if (fr && 'publiee_le' in fr && !fr.publiee_le) {
      const maintenant = new Date().toISOString()
      await sb.from('formations').update({ publiee_le: maintenant, version: 1, version_le: maintenant }).eq('id', id)
      await sb.from('formations_versions').insert({ formation_id: id, version: 1, publiee_le: maintenant, note: 'Publication initiale', publiee_par: a.id })
    }
    journal.push('Formation publiée')
  }

  if (journal.length) await logAudit({ acteur_id: a.id, formation_id: id, type_action: 'FORMATION_MODIFIEE', description: `Contenu complété : ${journal.join(' · ')}`.slice(0, 1000), metadata: { historique: true } })
  return NextResponse.json({ ok: true, journal })
}
