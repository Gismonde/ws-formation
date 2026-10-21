// Import (idempotent) des vidéos et liens relevés dans la librairie GrS (education.grsmontreal.com), clinique CMC.
// Réservé aux administrateurs du CMC ; les éléments déjà présents (même type, même adresse) sont ignorés.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import donnees from '@/data/librairie-grs.json'

function categorie(titre: string): string {
  const t = titre.toLowerCase()
  if (/^(politique|pro\.|procédure|code |programme|manuel|guide|communiqué|aide-mémoire)/.test(t)) return 'Politiques et procédures'
  if (['cnesst', 'santé et sécurité', 'sécurité', 'manutention', 'incendie', 'asstsas', 'entretien ménager', 'infections', 'marchandises dangereuses'].some(k => t.includes(k))) return 'Santé et sécurité'
  if (['plastie', 'mastectomie', 'mammaire', 'chirurg', 'dilatation', 'postop', 'livret', 'brochure', 'general information', 'standards de soins', 'préopératoire', 'scrotale'].some(k => t.includes(k))) return 'Chirurgies et soins'
  if (['diversité', 'intersexe', 'inclusiv', 'genre'].some(k => t.includes(k))) return 'Diversité et inclusion'
  return 'Général'
}

export async function POST() {
  const acteur = await getActeur()
  if (!acteur || (acteur.role !== 'super_admin' && acteur.role !== 'admin') || !cliniquesAdministrees(acteur).includes('CMC')) {
    return NextResponse.json({ error: 'Réservé aux administrateurs du CMC' }, { status: 403 })
  }
  const sb = serviceClient()
  const { data: existants, error } = await sb.from('librairie').select('type, url')
  if (error) return NextResponse.json({ error: 'Exécutez d’abord supabase/migrations/librairie.sql dans Supabase.' }, { status: 503 })
  const deja = new Set((existants ?? []).map(e => `${e.type}|${e.url}`))
  const lignes = [
    ...donnees.videos.map(([titre, url]) => ({ type: 'video', titre, url })),
    ...donnees.liens.map(([titre, url]) => ({ type: 'lien', titre, url })),
  ].filter(l => !deja.has(`${l.type}|${l.url}`))
    .map(l => ({ ...l, categorie: categorie(l.titre), clinique: 'CMC', source: 'grs', cree_par: acteur.id }))
  if (lignes.length) {
    const { error: e2 } = await sb.from('librairie').insert(lignes)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : import GrS (${lignes.length} élément(s) ajouté(s))`, metadata: { importes: lignes.length } })
  return NextResponse.json({ importes: lignes.length, ignores: donnees.videos.length + donnees.liens.length - lignes.length })
}
