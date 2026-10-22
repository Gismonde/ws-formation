// Gestion d'un événement. PATCH { action, ... } — auteur ou administrateur de ses cliniques.
//   modifier | publier | annuler | ajouter_seance | modifier_seance | annuler_seance | presence | retirer_inscription
// DELETE : supprimer un brouillon.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { origineDepuis } from '@/lib/courriels'
import { chargerEvenement, seanceOuverte } from '@/lib/evenements'
import { peutGererEvenement, validerEvenement, validerSeance, promouvoirListeAttente, enregistrerPresence, desinscrire } from '@/lib/evenements-admin'
import { annoncerEvenement, avertirChangementSeance, avertirAnnulationEvenement, avertirPromotion } from '@/lib/evenements-courriels'

async function contexte(id: string) {
  const acteur = await getActeur()
  if (!acteur) return { erreur: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!d || !peutGererEvenement(acteur, d.ev)) return { erreur: NextResponse.json({ error: 'Événement introuvable' }, { status: 404 }) }
  return { acteur, sb, ...d }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  const { acteur, sb, ev, seances, inscriptions } = c
  const corps = await req.json().catch(() => ({})) as Record<string, unknown>
  const origine = origineDepuis(req)
  const journal = (description: string) => logAudit({ acteur_id: acteur.id, type_action: 'FORMATION_MODIFIEE', description, metadata: { evenement_id: id }, ...ipEtAgent(req) })
  const seance = seances.find(s => s.id === corps.seanceId)

  switch (corps.action) {
    case 'modifier': {
      const v = validerEvenement(acteur, corps)
      if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
      const { error } = await sb.from('evenements').update({ ...v.valeurs, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await journal(`Événement modifié : ${v.valeurs.titre}`)
      return NextResponse.json({ ok: true })
    }
    case 'publier': {
      if (ev.statut !== 'brouillon') return NextResponse.json({ error: 'Déjà publié.' }, { status: 400 })
      if (!seances.some(s => seanceOuverte(s))) return NextResponse.json({ error: 'Ajoutez au moins une séance à venir avant de publier.' }, { status: 400 })
      await sb.from('evenements').update({ statut: 'publie', publie_le: new Date().toISOString() }).eq('id', id)
      const courriels = corps.notifier === false ? 0 : await annoncerEvenement(sb, { ...ev, statut: 'publie' }, seances, origine)
      await journal(`Événement publié : ${ev.titre} (${courriels} courriel(s))`)
      return NextResponse.json({ ok: true, courriels })
    }
    case 'annuler': {
      await sb.from('evenements').update({ statut: 'annule' }).eq('id', id)
      const courriels = await avertirAnnulationEvenement(sb, ev, inscriptions, origine)
      await sb.from('evenements_inscriptions').update({ statut: 'annule', annule_le: new Date().toISOString() }).eq('evenement_id', id).neq('statut', 'annule')
      await journal(`Événement annulé : ${ev.titre}`)
      return NextResponse.json({ ok: true, courriels })
    }
    case 'ajouter_seance': {
      const v = validerSeance(corps)
      if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
      const { error } = await sb.from('evenements_seances').insert({ ...v.valeurs, evenement_id: id })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await journal(`Séance ajoutée à « ${ev.titre} »`)
      return NextResponse.json({ ok: true })
    }
    case 'modifier_seance': {
      if (!seance) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
      const v = validerSeance(corps)
      if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
      const inscrits = inscriptions.filter(i => i.seance_id === seance.id && i.statut === 'inscrit').length
      if (v.valeurs.places < inscrits) return NextResponse.json({ error: `Il y a déjà ${inscrits} inscrit(s) : impossible de descendre sous ce nombre de places.` }, { status: 400 })
      await sb.from('evenements_seances').update({ ...v.valeurs, rappel_envoye: false }).eq('id', seance.id)
      const nouvelle = { ...seance, ...v.valeurs }
      const promus = await promouvoirListeAttente(sb, nouvelle, inscriptions)
      for (const p of promus) await avertirPromotion(sb, ev, nouvelle, p.employe_id, origine)
      const dateChangee = v.valeurs.debut !== seance.debut || v.valeurs.fin !== seance.fin || (v.valeurs.lieu ?? null) !== (seance.lieu ?? null)
      if (dateChangee && ev.statut === 'publie') await avertirChangementSeance(sb, ev, nouvelle, inscriptions, 'modifiee', origine)
      await journal(`Séance modifiée (« ${ev.titre} »)${promus.length ? ` — ${promus.length} personne(s) inscrite(s) depuis la liste d’attente` : ''}`)
      return NextResponse.json({ ok: true, promus: promus.length })
    }
    case 'annuler_seance': {
      if (!seance) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
      await sb.from('evenements_seances').update({ annulee: true }).eq('id', seance.id)
      const courriels = ev.statut === 'publie' ? await avertirChangementSeance(sb, ev, seance, inscriptions, 'annulee', origine) : 0
      await sb.from('evenements_inscriptions').update({ statut: 'annule', annule_le: new Date().toISOString() }).eq('seance_id', seance.id).neq('statut', 'annule')
      await journal(`Séance annulée (« ${ev.titre} »)`)
      return NextResponse.json({ ok: true, courriels })
    }
    case 'presence': {
      if (!seance) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
      const inscritsSeance = new Set(inscriptions.filter(i => i.seance_id === seance.id && i.statut === 'inscrit').map(i => i.employe_id))
      const presents = (Array.isArray(corps.presents) ? corps.presents.map(String) : []).filter(x => inscritsSeance.has(x))
      const absents = Array.from(inscritsSeance).filter(x => !presents.includes(x))
      const r = await enregistrerPresence(sb, ev, seance.id, presents, absents, acteur.id)
      await journal(`Présences enregistrées (« ${ev.titre} ») : ${presents.length} présent(s), ${absents.length} absent(s)${r.certificats ? `, ${r.certificats} certificat(s)` : ''}`)
      return NextResponse.json({ ok: true, ...r })
    }
    case 'retirer_inscription': {
      const ins = inscriptions.find(i => i.id === corps.inscriptionId && i.statut !== 'annule')
      if (!ins) return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 })
      const { promu } = await desinscrire(sb, ins, inscriptions)
      const s = seances.find(x => x.id === ins.seance_id)
      if (promu && s) await avertirPromotion(sb, ev, s, promu.employe_id, origine)
      await journal(`Inscription retirée (« ${ev.titre} »)`)
      return NextResponse.json({ ok: true })
    }
  }
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  if (c.ev.statut !== 'brouillon') return NextResponse.json({ error: 'Seul un brouillon peut être supprimé ; annulez plutôt l’événement.' }, { status: 400 })
  await c.sb.from('evenements').delete().eq('id', id)
  await logAudit({ acteur_id: c.acteur.id, type_action: 'FORMATION_SUPPRIMEE', description: `Brouillon d’événement supprimé : ${c.ev.titre}`, metadata: { evenement_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
