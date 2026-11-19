// POST { sujet, message, fichiers } : un employé propose une idée ou des photos pour La Passerelle.
// Un courriel prévient chaque personne choisie pour recevoir les propositions (comptes activés seulement).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { envoyerCourriels, courrielsActifs, gabarit, origineDepuis } from '@/lib/courriels'
import { chargerDestinataires, lireProposition, peutProposer } from '@/lib/passerelle-propositions'
import { CLINIQUE_PASSERELLE } from '@/lib/passerelle'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!peutProposer(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const lu = lireProposition(await req.json().catch(() => ({})), acteur!.id)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  const sb = serviceClient()
  // Garde-fou : 10 propositions par employé et par jour (chaque proposition envoie un courriel à l'équipe)
  const { count: duJour } = await sb.from('passerelle_propositions').select('id', { count: 'exact', head: true })
    .eq('employe_id', acteur!.id).gte('cree_le', new Date(Date.now() - 86400_000).toISOString())
  if ((duJour ?? 0) >= 10) return NextResponse.json({ error: 'Vous avez déjà envoyé 10 propositions aujourd’hui. Réessayez demain.' }, { status: 429 })
  const { data: p, error } = await sb.from('passerelle_propositions').insert({ ...lu.valeurs, employe_id: acteur!.id }).select('id').single()
  if (error) return NextResponse.json({ error: /passerelle_propositions/.test(error.message) ? 'Exécutez d’abord supabase/migrations/passerelle_propositions.sql dans Supabase.' : error.message }, { status: 500 })

  // Courriel aux personnes choisies (sauf l'auteur lui-même)
  const ids = (await chargerDestinataires(sb)).filter(id => id !== acteur!.id)
  if (ids.length && courrielsActifs()) {
    const { data: dest } = await sb.from('employes').select('prenom, email').in('id', ids).eq('actif', true)
    const origine = origineDepuis(req)
    const auteur = [acteur!.prenom, acteur!.nom].filter(Boolean).join(' ') || acteur!.email || 'Un employé'
    const n = lu.valeurs.fichiers.length
    const courriels = (dest ?? []).filter(d => d.email).map(d => ({
      a: d.email as string,
      sujet: `La Passerelle : nouvelle proposition de ${auteur}`,
      ...gabarit({
        origine, clinique: CLINIQUE_PASSERELLE, titre: 'Nouvelle proposition pour La Passerelle',
        paragraphes: [
          `Bonjour ${d.prenom ?? ''},`.replace(' ,', ','),
          `${auteur} a envoyé une proposition pour La Passerelle : « ${lu.valeurs.sujet} ».`,
          n ? `${n} fichier(s) joint(s).` : '',
        ].filter(Boolean),
        bouton: { libelle: 'Voir la proposition', lien: `${origine}/dashboard/passerelle/propositions` },
      }),
    }))
    await envoyerCourriels(courriels).catch(e => console.error('[Passerelle] Courriel de proposition', e))
  }
  return NextResponse.json({ id: p.id })
}
