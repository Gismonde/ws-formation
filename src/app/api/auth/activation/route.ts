// Activation du compte (mot de passe choisi) : envoie les courriels « formation assignée » retenus
// pendant que le compte n'était pas encore activé. Un seul courriel, qui liste les formations à suivre.
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { courrielsActifs, envoyerCourriels, origineDepuis, type Courriel } from '@/lib/courriels'
import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'

export async function POST(req: Request) {
  const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jeton) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: u } = await sb.auth.getUser(jeton)
  if (!u?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!courrielsActifs()) return NextResponse.json({ envoyes: 0 })

  const { data: e } = await sb.from('employes').select('id, prenom, nom, email, clinique, actif').eq('auth_user_id', u.user.id).maybeSingle()
  if (!e?.email || e.actif === false) return NextResponse.json({ envoyes: 0 })

  const { data: assign } = await sb.from('assignations').select('formation_id, date_echeance, formations(id, titre, publiee)').eq('employe_id', e.id)
  const lignes = (assign ?? []).map(a => ({ ...a, f: (Array.isArray(a.formations) ? a.formations[0] : a.formations) as { id: string; titre: string; publiee: boolean } | null }))
    .filter(a => a.f?.publiee)
  if (!lignes.length) return NextResponse.json({ envoyes: 0 })
  const etat = await chargerEtatsFormations(sb, [e.id], lignes.map(a => a.formation_id as string))
  const aFaire = lignes.filter(a => !estComplete(etat(e.id, a.formation_id as string).statut))
  if (!aFaire.length) return NextResponse.json({ envoyes: 0 })

  const origine = origineDepuis(req)
  const echeances = aFaire.map(a => a.date_echeance as string | null).filter(Boolean).sort() as string[]
  const echeance = echeances[0] ? new Date(echeances[0].slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' }) : null
  const cfg = await chargerNotifications(sb)
  const c = composerNotification(cfg, 'inscription_cours_assignation', {
    a: e.email, origine, clinique: e.clinique, prenom: e.prenom, nom: e.nom,
    vars: {
      activite: aFaire.map(a => a.f!.titre).join(', '), date: echeance ?? '',
      echeance: echeance ? `Première échéance : ${echeance}.` : 'Vous pouvez les suivre dès maintenant, à votre rythme.',
    },
    lien: aFaire.length === 1 ? `${origine}/formations/${aFaire[0].formation_id}` : `${origine}/dashboard`,
  })
  const r = c ? await envoyerCourriels([c as Courriel]) : { envoyes: 0 }
  return NextResponse.json({ envoyes: r.envoyes })
}
