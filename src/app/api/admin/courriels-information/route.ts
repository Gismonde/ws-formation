// Courriel d'information. POST { action, objet, contenu, bouton_libelle, bouton_lien, cible, envoi_prevu? }
//  - action « compter » : nombre de destinataires (et de comptes pas encore activés, qui ne recevront rien)
//  - action « apercu » : HTML du courriel tel qu'il sera reçu
//  - action « test » : l'envoie à l'administrateur seulement
//  - action « envoyer » : enregistre et envoie maintenant, ou à la date prévue (programmation)
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { origineDepuis, envoyerCourriels } from '@/lib/courriels'
import { adressesNonActivees } from '@/lib/comptes-actives'
import { logAudit } from '@/lib/audit'
import { composer, destinataires, envoyerInformation, lireCourrielInfo, peutEnvoyerInformation, type CourrielInfo } from '@/lib/courriels-information'

export async function POST(req: Request) {
  const acteurVue = await getActeur()
  if (!peutEnvoyerInformation(acteurVue)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  // La clinique affichée dans l'admin ne restreint pas les destinataires : seul le périmètre de l'administrateur compte
  const acteur = { ...acteurVue!, vue: null }
  const corps = await req.json().catch(() => ({}))
  const v = lireCourrielInfo(corps)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const sb = serviceClient()
  const origine = origineDepuis(req)
  const action = String(corps.action ?? '')

  if (action === 'compter') {
    const liste = await destinataires(sb, acteur, v.valeurs.cible)
    const non = await adressesNonActivees(sb, liste.map(d => d.email!)).catch(() => new Set<string>())
    return NextResponse.json({ destinataires: liste.length, nonActives: non.size })
  }
  if (action === 'apercu') {
    return NextResponse.json({ html: composer(v.valeurs, { prenom: acteur.prenom, clinique: acteur.clinique }, origine).html })
  }
  if (action === 'test') {
    if (!acteur.email) return NextResponse.json({ error: 'Votre fiche n’a pas de courriel.' }, { status: 400 })
    const { html, texte } = composer(v.valeurs, { prenom: acteur.prenom, clinique: acteur.clinique }, origine)
    const r = await envoyerCourriels([{ a: acteur.email, sujet: '[TEST] ' + v.valeurs.objet, html, texte }], { avantActivation: true })
    return r.envoyes ? NextResponse.json({ ok: true, a: acteur.email }) : NextResponse.json({ error: 'Envoi du test impossible' + (r.erreur ? ` (${r.erreur})` : '') }, { status: 500 })
  }
  if (action !== 'envoyer') return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })

  const programme = new Date(v.valeurs.envoi_prevu).getTime() > Date.now() + 60_000
  const { data, error } = await sb.from('courriels_information').insert({ ...v.valeurs, statut: programme ? 'programme' : 'envoi', cree_par: acteur.id }).select('*').single()
  if (error) return NextResponse.json({ error: /courriels_information/.test(error.message) ? 'Exécutez d’abord supabase/migrations/courriels_information.sql dans Supabase.' : error.message }, { status: 500 })
  if (programme) {
    await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Courriel d’information « ${v.valeurs.objet} » programmé`, metadata: { courriel_information_id: data.id, envoi_prevu: v.valeurs.envoi_prevu }, ...ipEtAgent(req) })
    return NextResponse.json({ programme: true, courriel: data })
  }
  const r = await envoyerInformation(sb, data as CourrielInfo, origine)
  return NextResponse.json({ programme: false, ...r })
}
