// Journées de formation. POST : enregistre un modèle (modele: true) ou lance une journée pour des employés :
// enregistre la journée ; si elle est d'aujourd'hui ou sans date, l'ouvre tout de suite (assignations + un courriel par employé),
// sinon elle s'ouvrira le matin du jour prévu (voir lib/journees-ouverture).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent, cliniquesContenuVisibles } from '@/lib/permissions'
import { peutPublierPolitiques } from '@/lib/politiques'
import { employesDeLaCible } from '@/lib/assignations-groupees'
import { origineDepuis } from '@/lib/courriels'
import { lireJournee, peutGererJournees, CHAMPS_JOURNEE, type Journee } from '@/lib/journees'
import { estProgrammee, ouvrirJournee } from '@/lib/journees-ouverture'
import { logAudit } from '@/lib/audit'

const tableAbsente = (m: string) => /journees_formation/.test(m)

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutGererJournees(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const v = lireJournee(corps, cliniquesContenuVisibles(acteur))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const j = v.valeurs
  if (j.politique_ids.length && !peutPublierPolitiques(acteur)) {
    return NextResponse.json({ error: 'Les politiques sont gérées par les administrateurs : retirez-les ou demandez à un administrateur.' }, { status: 403 })
  }
  const sb = serviceClient()
  const meta = ipEtAgent(req)

  if (j.modele) {
    const { data, error } = await sb.from('journees_formation').insert({ ...j, cree_par: acteur.id }).select(CHAMPS_JOURNEE).single()
    if (error) return NextResponse.json({ error: tableAbsente(error.message) ? 'Exécutez d’abord supabase/migrations/journees_formation.sql dans Supabase.' : error.message }, { status: 500 })
    await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Modèle de journée de formation « ${j.nom} » enregistré`, metadata: { journee_id: data.id }, ...meta })
    return NextResponse.json({ journee: data })
  }

  const { employes, erreur } = await employesDeLaCible(sb, acteur, { type: 'employes', ids: j.employe_ids })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 403 })
  if (employes.length === 0) return NextResponse.json({ error: 'Aucun employé actif dans votre périmètre parmi ceux choisis.' }, { status: 400 })

  // Journée datée dans le futur : enregistrée seulement ; elle s'ouvre le matin du jour prévu (tâche quotidienne)
  const programmee = estProgrammee(j.date_journee)
  const notifier = corps.notifier !== false
  const ligne = { ...j, employe_ids: employes.map(e => e.id), cree_par: acteur.id }
  let res = await sb.from('journees_formation').insert({ ...ligne, ouverte_le: programmee ? null : new Date().toISOString(), notifier }).select('*').single()
  let colonnes = true
  if (res.error && /ouverte_le|notifier/.test(res.error.message)) {
    // Migration journees_ouverture.sql pas encore exécutée : ouverture immédiate, comme avant
    colonnes = false
    res = await sb.from('journees_formation').insert(ligne).select('*').single()
  }
  if (res.error) return NextResponse.json({ error: tableAbsente(res.error.message) ? 'Exécutez d’abord supabase/migrations/journees_formation.sql dans Supabase.' : res.error.message }, { status: 500 })
  const journee = res.data as Journee

  if (programmee && colonnes) {
    await logAudit({
      acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE',
      description: `Journée de formation « ${j.nom} » programmée le ${j.date_journee} pour ${employes.length} employé(s) : rien n’est assigné ni envoyé avant ce jour`,
      metadata: { journee_id: journee.id, employes: employes.map(e => e.id), date_journee: j.date_journee }, ...meta,
    })
    return NextResponse.json({ journee, employes: employes.length, programmee: true, formations: [], politiques: [], courriels: 0 })
  }

  try {
    const r = await ouvrirJournee(sb, acteur, journee, origineDepuis(req), { notifier, meta })
    if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: r.statut })
    return NextResponse.json({ journee, ...r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
