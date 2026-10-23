// Envoi d'une suggestion par l'employé (3 par semaine au plus). Anonyme : le nom n'est pas enregistré.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { lireSuggestion, empreinteAuteur, MAX_PAR_SEMAINE } from '@/lib/suggestions'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const v = lireSuggestion(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const sb = serviceClient()
  const empreinte = empreinteAuteur(acteur.id)
  const depuis = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count, error: eC } = await sb.from('suggestions').select('id', { count: 'exact', head: true }).eq('empreinte', empreinte).gte('created_at', depuis)
  if (eC) return NextResponse.json({ error: 'Les suggestions ne sont pas encore activées.' }, { status: 503 })
  if ((count ?? 0) >= MAX_PAR_SEMAINE) return NextResponse.json({ error: `Vous avez déjà envoyé ${MAX_PAR_SEMAINE} suggestions cette semaine. Merci ! Vous pourrez en envoyer d’autres bientôt.` }, { status: 429 })
  const { error } = await sb.from('suggestions').insert({
    ...v.valeurs, empreinte, employe_id: v.valeurs.anonyme ? null : acteur.id,
    clinique: acteur.clinique ?? 'LES_DEUX',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
