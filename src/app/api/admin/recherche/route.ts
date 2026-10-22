// Recherche globale de l'administration : employés, formations, politiques, journées, SOP et librairie,
// limitée au périmètre de la personne connectée. GET ?q=texte
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, filtrerEmployes, cliniquesContenuVisibles } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { peutSuivrePolitique, type Politique } from '@/lib/politiques'

export type ResultatRecherche = { type: 'employe' | 'formation' | 'politique' | 'journee' | 'sop' | 'librairie'; id: string; titre: string; detail: string; etat?: 'archive' | 'publiee' | 'brouillon' | 'modele'; href: string }

const PAR_TYPE = 6

/** Échappe les caractères spéciaux des filtres PostgREST (ilike + or). */
const motif = (q: string) => `%${q.replace(/[%_\\]/g, m => '\\' + m).replace(/[,()"]/g, ' ')}%`

export async function GET(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ resultats: [] })

  const sb = serviceClient()
  const m = motif(q)
  const visibles = cliniquesContenuVisibles(acteur)
  const mots = q.split(/\s+/).filter(Boolean)

  // Employés : le premier mot filtre en base, tous les mots doivent apparaître (prénom, nom, courriel ou poste)
  const m1 = motif(mots[0])
  const qe = filtrerEmployes(sb.from('employes').select('id, prenom, nom, email, poste, actif, clinique'), acteur)
    .or(`prenom.ilike.${m1},nom.ilike.${m1},email.ilike.${m1},poste.ilike.${m1}`)
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const [emp, form, pols, jour, sops, lib] = await Promise.all([
    qe.order('nom').limit(40),
    sb.from('formations').select('id, titre, clinique, publiee').in('clinique', visibles).ilike('titre', m).order('titre').limit(PAR_TYPE),
    sb.from('politiques').select('*').eq('actif', true).ilike('titre', m).order('titre').limit(20),
    sb.from('journees_formation').select('id, nom, modele, clinique').in('clinique', visibles).ilike('nom', m).order('nom').limit(PAR_TYPE),
    sb.from('sop').select('id, titre, clinique').in('clinique', visibles).ilike('titre', m).order('titre').limit(PAR_TYPE),
    sb.from('librairie').select('id, titre, type').eq('archive', false).in('clinique', visibles).ilike('titre', m).order('titre').limit(PAR_TYPE),
  ])

  const resultats: ResultatRecherche[] = [
    ...(emp.data ?? []).filter(e => mots.every(w => norm([e.prenom, e.nom, e.email, e.poste].join(' ')).includes(norm(w)))).slice(0, PAR_TYPE).map(e => ({ type: 'employe' as const, id: e.id, titre: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim(), detail: [e.email, e.poste].filter(Boolean).join(' · '), etat: e.actif ? undefined : 'archive' as const, href: `/admin/employes/${e.id}` })),
    ...(form.data ?? []).map(f => ({ type: 'formation' as const, id: f.id, titre: f.titre, detail: f.clinique ?? '', etat: f.publiee ? 'publiee' as const : 'brouillon' as const, href: `/admin/formations/${f.id}` })),
    ...((pols.data ?? []) as Politique[]).filter(p => peutSuivrePolitique(acteur, p)).slice(0, PAR_TYPE).map(p => ({ type: 'politique' as const, id: p.id, titre: p.titre, detail: p.clinique ?? '', href: `/admin/politiques/${p.id}` })),
    ...(jour.data ?? []).map(j => ({ type: 'journee' as const, id: j.id, titre: j.nom, detail: j.clinique ?? '', etat: j.modele ? 'modele' as const : undefined, href: '/admin/journees' })),
    ...(sops.data ?? []).map(s => ({ type: 'sop' as const, id: s.id, titre: s.titre, detail: s.clinique ?? '', href: '/admin/sop' })),
    ...(lib.data ?? []).map(l => ({ type: 'librairie' as const, id: l.id, titre: l.titre, detail: l.type ?? '', href: '/admin/librairie' })),
  ]
  return NextResponse.json({ resultats })
}
