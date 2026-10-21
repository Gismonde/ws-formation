// Suppression définitive d'employés archivés. POST { ids: string[], raison: string } — administrateurs globaux seulement.
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { peutSupprimerEmployes, lireRaison, supprimerEmploye, RAISON_MIN } from '@/lib/suppression-employes'

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutSupprimerEmployes(acteur)) return NextResponse.json({ error: 'Réservé aux administrateurs globaux' }, { status: 403 })
  const corps = await request.json().catch(() => ({}))
  const raison = lireRaison(corps.raison)
  if (!raison) return NextResponse.json({ error: `Indiquez la raison de la suppression (${RAISON_MIN} caractères minimum).` }, { status: 400 })
  const ids: string[] = Array.isArray(corps.ids) ? Array.from(new Set(corps.ids.filter((x: unknown) => typeof x === 'string'))).slice(0, 100) as string[] : []
  if (!ids.length) return NextResponse.json({ error: 'Aucun employé choisi' }, { status: 400 })

  const sb = serviceClient()
  const { data: employes } = await sb.from('employes').select('id, auth_user_id, prenom, nom, email, role, clinique, actif').in('id', ids)
  const meta = ipEtAgent(request)
  const resultats: { id: string; nom: string; erreur?: string }[] = []
  for (const e of employes ?? []) {
    const nom = [e.prenom, e.nom].filter(Boolean).join(' ') || e.email || e.id
    const r = await supprimerEmploye(sb, acteur, e, raison)
    if ('erreur' in r) { resultats.push({ id: e.id, nom, erreur: r.erreur }); continue }
    resultats.push({ id: e.id, nom })
    await logAudit({
      acteur_id: acteur.id, type_action: 'EMPLOYE_SUPPRIME',
      description: `Suppression définitive de ${nom} (${e.email ?? 'sans courriel'}) — raison : ${raison}`,
      metadata: { employe_id: e.id, raison }, ...meta,
    })
  }
  return NextResponse.json({ supprimes: resultats.filter(r => !r.erreur).length, resultats })
}
