// Inscription de l'employé connecté. POST { seanceId } : s'inscrire (ou changer de séance). DELETE : se désinscrire.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { logAudit } from '@/lib/audit'
import { chargerEvenement, estInvite, peutSeDesinscrire, seanceOuverte } from '@/lib/evenements'
import { inscrire, desinscrire } from '@/lib/evenements-admin'
import { confirmerInscription, avertirPromotion } from '@/lib/evenements-courriels'

async function contexte(id: string) {
  const acteur = await getActeur()
  if (!acteur) return { erreur: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!d || d.ev.statut !== 'publie' || !estInvite(d.ev, acteur)) return { erreur: NextResponse.json({ error: 'Événement introuvable' }, { status: 404 }) }
  return { acteur, sb, ...d }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  const { seanceId } = await req.json().catch(() => ({})) as { seanceId?: string }
  const seance = c.seances.find(s => s.id === seanceId)
  if (!seance || !seanceOuverte(seance)) return NextResponse.json({ error: 'Cette séance n’est plus ouverte aux inscriptions.' }, { status: 400 })
  // Changer de séance : l'ancienne inscription doit encore pouvoir être annulée
  const actuelle = c.inscriptions.find(i => i.employe_id === c.acteur.id && i.statut !== 'annule' && i.seance_id !== seance.id)
  const ancienne = actuelle && c.seances.find(s => s.id === actuelle.seance_id)
  if (actuelle && ancienne && actuelle.statut === 'inscrit' && !peutSeDesinscrire(ancienne, c.ev.desinscription_heures)) {
    return NextResponse.json({ error: 'Il est trop tard pour changer de séance. Contactez le responsable de la formation.' }, { status: 400 })
  }
  try {
    const r = await inscrire(c.sb, c.ev, seance, c.acteur.id, c.inscriptions)
    const origine = origineDepuis(req)
    await confirmerInscription(c.sb, c.ev, seance, c.acteur.id, r.statut, origine)
    if (r.promu) {
      const s = c.seances.find(x => x.id === r.promu!.seance_id)
      if (s) await avertirPromotion(c.sb, c.ev, s, r.promu.employe_id, origine)
    }
    await logAudit({ acteur_id: c.acteur.id, type_action: 'FORMATION_DEBUT', description: `${r.statut === 'inscrit' ? 'Inscription' : 'Liste d’attente'} : ${c.ev.titre}`, metadata: { evenement_id: id, seance_id: seance.id }, ...ipEtAgent(req) })
    return NextResponse.json({ ok: true, statut: r.statut })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  const ins = c.inscriptions.find(i => i.employe_id === c.acteur.id && i.statut !== 'annule')
  if (!ins) return NextResponse.json({ error: 'Aucune inscription' }, { status: 404 })
  const s = c.seances.find(x => x.id === ins.seance_id)
  if (ins.statut === 'inscrit' && s && !peutSeDesinscrire(s, c.ev.desinscription_heures)) {
    return NextResponse.json({ error: 'La date limite de désinscription est passée. Contactez le responsable de la formation.' }, { status: 400 })
  }
  const { promu } = await desinscrire(c.sb, ins, c.inscriptions)
  if (promu && s) await avertirPromotion(c.sb, c.ev, s, promu.employe_id, origineDepuis(req))
  await logAudit({ acteur_id: c.acteur.id, type_action: 'FORMATION_MODIFIEE', description: `Désinscription : ${c.ev.titre}`, metadata: { evenement_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
