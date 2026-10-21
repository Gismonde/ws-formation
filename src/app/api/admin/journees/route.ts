// Journées de formation. POST : enregistre un modèle (modele: true) ou lance une journée pour des employés :
// assigne les formations et les politiques, enregistre la journée et prévient chaque employé par un seul courriel.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent, cliniquesContenuVisibles } from '@/lib/permissions'
import { peutPublierPolitiques } from '@/lib/politiques'
import { employesDeLaCible, assignerFormations, assignerPolitiques } from '@/lib/assignations-groupees'
import { courrielsActifs, envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'
import { lireJournee, peutGererJournees, contenuJournee, CHAMPS_JOURNEE } from '@/lib/journees'
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

  // La journée est enregistrée d'abord (si la table manque, rien n'est assigné)
  const { data: journee, error: errJ } = await sb.from('journees_formation')
    .insert({ ...j, employe_ids: employes.map(e => e.id), cree_par: acteur.id }).select(CHAMPS_JOURNEE).single()
  if (errJ) return NextResponse.json({ error: tableAbsente(errJ.message) ? 'Exécutez d’abord supabase/migrations/journees_formation.sql dans Supabase.' : errJ.message }, { status: 500 })

  try {
    const formations = j.formation_ids.length ? await assignerFormations(sb, acteur, j.formation_ids, employes, j.date_echeance) : null
    const politiques = j.politique_ids.length ? await assignerPolitiques(sb, acteur, j.politique_ids, { type: 'employes', ids: employes.map(e => e.id) }, employes) : null
    if (politiques?.migrationRequise) {
      return NextResponse.json({ error: 'Exécutez d’abord supabase/migrations/politiques_employes.sql dans Supabase.' }, { status: 503 })
    }

    await logAudit({
      acteur_id: acteur.id, type_action: 'FORMATION_ASSIGNEE',
      description: `Journée de formation « ${j.nom} » lancée pour ${employes.length} employé(s) : ${j.formation_ids.length} formation(s), ${j.politique_ids.length} politique(s), ${j.librairie_ids.length} élément(s) à visionner`,
      metadata: { journee_id: journee.id, raison: j.raison, employes: employes.map(e => e.id) }, ...meta,
    })

    // Un seul courriel par employé, qui présente toute la journée
    let courriels = 0
    if (corps.notifier !== false && courrielsActifs()) {
      const origine = origineDepuis(req)
      const c = await contenuJournee(sb, j)
      const echeance = j.date_echeance ? new Date(j.date_echeance + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' }) : null
      const jour = j.date_journee ? new Date(j.date_journee + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' }) : null
      const lignes = [
        ...c.formations.map(f => `• Formation : ${f.titre}`),
        ...c.politiques.map(p => `• Politique à lire et confirmer : ${p.titre}`),
        ...c.librairie.map(l => `• À visionner : ${l.titre}`),
      ]
      const envoi = await envoyerCourriels(employes.filter(e => e.email).map(e => {
        const { html, texte } = gabarit({
          origine, clinique: e.clinique,
          titre: `Journée de formation — ${j.nom}`,
          paragraphes: [
            `Bonjour ${e.prenom ?? ''},`.replace(' ,', ','),
            `Une journée de formation (${j.raison})${jour ? ` est prévue le ${jour}` : ' vous a été attribuée'}. Voici ce que vous aurez à compléter dans votre portail :`,
            ...lignes,
            ...(j.note ? [j.note] : []),
            echeance ? `À compléter avant le ${echeance}.` : 'Vous pouvez commencer dès maintenant.',
          ],
          bouton: { libelle: 'Voir ma journée de formation', lien: `${origine}/dashboard/journees/${journee.id}` },
        })
        return { a: e.email!, sujet: `Journée de formation — ${j.nom}`, html, texte }
      }))
      courriels = envoi.envoyes
    }

    return NextResponse.json({
      journee,
      employes: employes.length,
      formations: formations?.resultats ?? [],
      politiques: politiques?.resultats ?? [],
      courriels,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
