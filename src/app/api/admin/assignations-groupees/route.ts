// Assignation groupée de formations ou de politiques.
// POST { quoi: 'formations' | 'politiques', ids: string[], cible: Cible, dateEcheance?: 'AAAA-MM-JJ', notifier?: boolean }
import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import type { Courriel } from '@/lib/courriels'
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { peutPublierPolitiques } from '@/lib/politiques'
import { avertirPolitique } from '@/lib/politiques-courriels'
import { lireCible, employesDeLaCible, assignerFormations, assignerPolitiques } from '@/lib/assignations-groupees'
import { courrielsActifs, envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'
import { logAudit } from '@/lib/audit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const corps = await req.json().catch(() => ({}))
  const quoi = corps.quoi === 'politiques' ? 'politiques' : corps.quoi === 'formations' ? 'formations' : null
  const ids: string[] = Array.isArray(corps.ids) ? Array.from(new Set(corps.ids.filter((x: unknown) => typeof x === 'string' && UUID.test(x)))) : []
  const cible = lireCible(corps.cible)
  if (!quoi || ids.length === 0 || ids.length > 100) return NextResponse.json({ error: 'Choisissez entre 1 et 100 éléments à assigner.' }, { status: 400 })
  if (!cible) return NextResponse.json({ error: 'Choisissez à qui assigner.' }, { status: 400 })
  if (quoi === 'politiques' && !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Les politiques sont gérées par les administrateurs.' }, { status: 403 })
  const dateEcheance = typeof corps.dateEcheance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corps.dateEcheance) ? corps.dateEcheance : null

  const sb = serviceClient()
  const { employes, erreur } = await employesDeLaCible(sb, acteur, cible)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 403 })
  if (employes.length === 0 && cible.type !== 'clinique') return NextResponse.json({ error: 'Aucun employé actif dans cette sélection.' }, { status: 400 })

  const { ip_address, user_agent } = ipEtAgent(req)
  const origine = origineDepuis(req)
  const notifier = corps.notifier !== false && courrielsActifs()

  try {
    if (quoi === 'formations') {
      const { resultats, nouvelles } = await assignerFormations(sb, acteur, ids, employes, dateEcheance)
      const audits = Array.from(nouvelles).flatMap(([employeId, fids]) => fids.map((fid: string) => logAudit({
        acteur_id: acteur.id, type_action: 'FORMATION_ASSIGNEE', description: 'Formation assignée (assignation groupée)',
        formation_id: fid, cible_employe_id: employeId, metadata: { groupe: true, cible: cible.type }, ip_address, user_agent,
      })))
      for (let i = 0; i < audits.length; i += 50) await Promise.all(audits.slice(i, i + 50))

      // Un seul courriel par employé, qui liste toutes ses nouvelles formations
      let courriels = 0
      if (notifier && nouvelles.size) {
        const titres = new Map(resultats.map(r => [r.formation_id, r.titre]))
        const echeance = dateEcheance ? new Date(dateEcheance + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' }) : null
        const cfg = await chargerNotifications(sb)
        const envoi = await envoyerCourriels(employes.filter(e => e.email && nouvelles.has(e.id)).map(e => {
          const ids = nouvelles.get(e.id)!
          const liste = ids.map(fid => titres.get(fid) ?? 'Formation')
          return composerNotification(cfg, 'inscription_cours_assignation', {
            a: e.email, origine, clinique: e.clinique, prenom: e.prenom, nom: e.nom,
            vars: {
              activite: liste.join(', '), date: echeance ?? '',
              echeance: echeance ? `À compléter avant le ${echeance}.` : 'Vous pouvez les suivre dès maintenant, à votre rythme.',
            },
            lien: liste.length === 1 ? `${origine}/formations/${ids[0]}` : `${origine}/dashboard`,
          })
        }).filter((c): c is Courriel => !!c))
        courriels = envoi.envoyes
      }
      return NextResponse.json({ quoi, employes: employes.length, resultats, courriels })
    }

    const { resultats, nouvelles, migrationRequise } = await assignerPolitiques(sb, acteur, ids, cible, employes)
    if (migrationRequise) {
      return NextResponse.json({ error: 'Pour assigner une politique à des employés précis, exécutez d’abord supabase/migrations/politiques_employes.sql dans Supabase. (Départements et clinique entière fonctionnent déjà.)', resultats }, { status: 503 })
    }
    for (const r of resultats.filter(x => !x.refusee && (x.ajoutes || x.elargie))) {
      await logAudit({
        acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE',
        description: `Politique « ${r.titre} » assignée (${cible.type === 'clinique' ? 'clinique ' + cible.clinique : cible.type === 'departements' ? cible.ids.length + ' département(s)' : cible.ids.length + ' employé(s)'})`,
        metadata: { politique_id: r.politique_id, ajoutes: r.ajoutes, elargie: !!r.elargie, groupe: true }, ip_address, user_agent,
      })
    }
    let courriels = 0
    if (notifier) {
      for (const n of nouvelles) {
        const envoi = await avertirPolitique(sb, n.politique, origine, 'nouvelle', n.employes)
        courriels += envoi.envoyes
      }
    }
    return NextResponse.json({ quoi, employes: employes.length, resultats, courriels })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
