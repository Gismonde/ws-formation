// Export Excel des réponses d'un formulaire (ex. registre des incidents) : une ligne par envoi, une colonne par question.
// ?du=AAAA-MM-JJ&au=AAAA-MM-JJ (facultatif) ; administrateurs : avec statut et note interne.
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { classeurExcel, nomFichier, reponseFichier, type Colonne } from '@/lib/export-tableur'
import {
  peutVoirReponses, voitTout, champsAvecReserve, estSaisissable, valeurLisible, numeroReponse, STATUTS,
  type Champ, type Formulaire, type Reponses, type StatutReponse,
} from '@/lib/formulaires'

type Ligne = {
  numero: number; soumis_le: string; anonyme: boolean; employe: string; poste: string; courriel: string
  statut: StatutReponse; statut_le: string | null; complete_le: string | null; complete_par: string
  reponse_employe: string | null; note_interne: string | null; reponses: Reponses; reserve: Reponses
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await getActeur()
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', id).maybeSingle()
  const f = data as Formulaire | null
  if (!a || !f || !peutVoirReponses(a, f)) return new Response('Introuvable', { status: 404 })
  const admin = voitTout(a, f)

  const url = new URL(req.url)
  let q = sb.from('formulaire_reponses').select('*').eq('formulaire_id', f.id).order('numero')
  const du = url.searchParams.get('du'), au = url.searchParams.get('au')
  if (du && /^\d{4}-\d{2}-\d{2}$/.test(du)) q = q.gte('soumis_le', du + 'T00:00:00')
  if (au && /^\d{4}-\d{2}-\d{2}$/.test(au)) q = q.lte('soumis_le', au + 'T23:59:59')
  const { data: reps } = await q
  const lignesBrutes = (reps ?? []) as Record<string, unknown>[]

  // Colonnes : questions du formulaire actuel, puis celles des anciennes versions qui n'existent plus
  const champs: (Champ & { estReserve: boolean })[] = champsAvecReserve(f.champs).filter(estSaisissable)
  for (const r of lignesBrutes) {
    for (const c of champsAvecReserve(((r.definition as { champs?: Champ[] })?.champs ?? [])).filter(estSaisissable)) {
      if (!champs.some(x => x.id === c.id)) champs.push(c)
    }
  }

  const ids = Array.from(new Set(lignesBrutes.flatMap(r => [r.employe_id, r.reserve_complete_par]).filter(Boolean))) as string[]
  const { data: emps } = ids.length ? await sb.from('employes').select('id, prenom, nom, email, poste').in('id', ids) : { data: [] }
  const e = new Map((emps ?? []).map(x => [x.id as string, x]))
  const nom = (i: unknown) => { const p = e.get(i as string); return p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() : '' }
  const date = (iso: string | null | undefined, heure = true) => iso ? new Date(iso).toLocaleString('fr-CA', { dateStyle: 'short', ...(heure ? { timeStyle: 'short' } : {}), timeZone: 'America/Toronto' }) : ''

  const lignes: Ligne[] = lignesBrutes.map(r => {
    const p = e.get(r.employe_id as string)
    const anonyme = r.anonyme === true || !r.employe_id
    return {
      numero: r.numero as number, soumis_le: r.soumis_le as string, anonyme,
      employe: anonyme ? 'Anonyme' : nom(r.employe_id), poste: anonyme ? '' : (p?.poste ?? ''), courriel: anonyme ? '' : (p?.email ?? ''),
      statut: (r.statut as StatutReponse) ?? 'recu', statut_le: (r.statut_le as string | null) ?? null,
      complete_le: (r.reserve_complete_le as string | null) ?? null, complete_par: nom(r.reserve_complete_par),
      reponse_employe: (r.reponse_employe as string | null) ?? null, note_interne: (r.note_interne as string | null) ?? null,
      reponses: (r.reponses as Reponses) ?? {}, reserve: (r.reserve as Reponses) ?? {},
    }
  })

  const colonnes: Colonne<Ligne>[] = [
    { titre: 'No', valeur: l => numeroReponse(l.numero), largeur: 10 },
    { titre: 'Envoyé le', valeur: l => date(l.soumis_le), largeur: 18 },
    { titre: 'Envoyé par', valeur: l => l.employe, largeur: 24 },
    { titre: 'Poste', valeur: l => l.poste, largeur: 20 },
    { titre: 'Courriel', valeur: l => l.courriel, largeur: 28 },
    ...(admin ? [
      { titre: 'Statut', valeur: (l: Ligne) => STATUTS[l.statut]?.libelle ?? l.statut, largeur: 14 },
      { titre: 'Statut mis à jour le', valeur: (l: Ligne) => date(l.statut_le), largeur: 18 },
    ] : []),
    { titre: 'Section réservée complétée le', valeur: l => date(l.complete_le), largeur: 20 },
    { titre: 'Complétée par', valeur: l => l.complete_par, largeur: 22 },
    ...champs.map(c => ({
      titre: (c.estReserve ? '🔒 ' : '') + c.libelle.slice(0, 120),
      valeur: (l: Ligne) => valeurLisible(c, c.estReserve ? l.reserve : l.reponses),
      largeur: c.type === 'texte_long' || c.type === 'tableau' ? 50 : c.type === 'choix_multiple' ? 36 : 22,
    })),
    { titre: 'Réponse à l’employé', valeur: l => l.reponse_employe ?? '', largeur: 40 },
    ...(admin ? [{ titre: 'Note interne', valeur: (l: Ligne) => l.note_interne ?? '', largeur: 40 }] : []),
  ]

  const buf = await classeurExcel([{ nom: f.code || f.titre, colonnes, lignes }], { titre: f.titre, auteur: 'WS Formation' })
  await logAudit({
    acteur_id: a.id, type_action: 'EXPORT_DONNEES',
    description: `Export Excel du formulaire « ${f.titre} » : ${lignes.length} réponse(s)${du || au ? ` (${du ?? '…'} → ${au ?? '…'})` : ''}`,
    metadata: { formulaire_id: f.id, nombre: lignes.length }, ...ipEtAgent(req),
  })
  return reponseFichier(buf, nomFichier(`registre-${f.code || f.titre}`, 'xlsx'))
}
