import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import {
  employesDansPortee, peutGererPolitique, validerCiblage, peutSuivrePolitique, Politique, statistiquesPolitiques,
} from '@/lib/politiques'
import { avertirPolitique } from '@/lib/politiques-courriels'
import { origineDepuis } from '@/lib/courriels'
import { estMediaPrive } from '@/lib/medias'

/**
 * Actions sur une politique :
 *  - modifier        : titre, description, clinique, départements (sans nouvelle confirmation)
 *  - nouvelle_version: nouveau document → tout le monde doit reconfirmer
 *  - archiver / reactiver
 *  - rappel          : courriel aux employés en attente (dans la portée de l'acteur)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data } = await sb.from('politiques').select('*').eq('id', id).single()
  const pol = data as Politique | null
  if (!pol || !peutSuivrePolitique(acteur, pol)) return NextResponse.json({ error: 'Politique introuvable' }, { status: 404 })

  const body = await request.json()
  const action = body.action as string
  const origine = origineDepuis(request)

  if (action === 'rappel') {
    const employes = await employesDansPortee(sb, acteur)
    const stat = (await statistiquesPolitiques(sb, [pol], employes))[pol.id]
    const enAttente = stat.vises.filter(e => !stat.confirmations[e.id])
    if (enAttente.length === 0) return NextResponse.json({ success: true, courriels: 0, message: 'Tout le monde a confirmé' })
    const envoi = await avertirPolitique(sb, pol, origine, 'rappel', enAttente)
    if (envoi.erreur === 'non_configure') return NextResponse.json({ error: 'L’envoi de courriels n’est pas encore configuré' }, { status: 400 })
    return NextResponse.json({ success: true, courriels: envoi.envoyes })
  }

  if (!peutGererPolitique(acteur, pol)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  if (action === 'modifier') {
    const v = await validerCiblage(acteur, body, sb)
    if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
    const { error } = await sb.from('politiques').update({ ...v.valeurs, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit({ acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE', description: `Politique modifiée : ${v.valeurs.titre}`, metadata: { politique_id: id }, ...ipEtAgent(request) })
    return NextResponse.json({ success: true })
  }

  if (action === 'nouvelle_version') {
    if (!estMediaPrive(body.fichier) || !String(body.fichier).startsWith('media:politiques/')) {
      return NextResponse.json({ error: 'Le nouveau document est obligatoire' }, { status: 400 })
    }
    const version = pol.version + 1
    const maintenant = new Date().toISOString()
    const maj = {
      version, fichier: body.fichier, nom_fichier: body.nom_fichier ?? null,
      note_version: String(body.note_version ?? '').trim() || null,
      publiee_le: maintenant, publiee_par: acteur.id, actif: true, updated_at: maintenant,
    }
    const { error } = await sb.from('politiques').update(maj).eq('id', id).eq('version', pol.version)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await sb.from('politiques_versions').insert({
      politique_id: id, version, fichier: maj.fichier, nom_fichier: maj.nom_fichier, note_version: maj.note_version,
      publiee_le: maintenant, publiee_par: acteur.id,
    })
    await logAudit({
      acteur_id: acteur.id, type_action: 'POLITIQUE_PUBLIEE',
      description: `Nouvelle version (v${version}) de la politique : ${pol.titre} — nouvelle confirmation demandee`,
      metadata: { politique_id: id, version }, ...ipEtAgent(request),
    })
    let courriels = 0
    if (body.notifier !== false) courriels = (await avertirPolitique(sb, { ...pol, ...maj }, origine, 'version')).envoyes
    return NextResponse.json({ success: true, version, courriels })
  }

  if (action === 'archiver' || action === 'reactiver') {
    const actif = action === 'reactiver'
    const { error } = await sb.from('politiques').update({ actif, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit({
      acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE',
      description: `Politique ${actif ? 'reactivee' : 'archivee'} : ${pol.titre}`, metadata: { politique_id: id }, ...ipEtAgent(request),
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
