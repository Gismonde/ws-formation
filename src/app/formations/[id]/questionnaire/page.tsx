import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerEtatQuestionnaire } from '@/lib/questionnaire-serveur'
import QuestionnaireClient, { QuestionAffichee } from './QuestionnaireClient'
import { i18n } from '@/lib/i18n/serveur'

function Encadre({ titre, texte, id, icone, retour }: { titre: string; texte: string; id: string; icone: string; retour: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-3">{icone}</div>
        <h2 className="text-xl font-bold mb-2 text-gray-900">{titre}</h2>
        <p className="text-gray-600 text-sm mb-6">{texte}</p>
        <Link href={`/formations/${id}`} className="inline-block px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">{retour}</Link>
      </div>
    </div>
  )
}

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t } = await i18n()
  const retour = t('Retour à la formation')

  const sb = serviceClient()
  const [{ data: formation }, { data: assignation }] = await Promise.all([
    sb.from('formations').select('id, titre, publiee').eq('id', id).single(),
    sb.from('assignations').select('id').eq('employe_id', acteur.id).eq('formation_id', id).limit(1).maybeSingle(),
  ])
  if (!formation || !formation.publiee) notFound()
  if (!assignation) {
    return <Encadre id={id} retour={retour} icone="🔒" titre={t('Formation non assignée')} texte={t('Le questionnaire n’est accessible qu’aux employés à qui cette formation est assignée.')} />
  }

  const etat = await chargerEtatQuestionnaire(sb, acteur.id, id)
  const q = etat.questionnaire
  if (!q) return <Encadre id={id} retour={retour} icone="📭" titre={t('Pas de questionnaire')} texte={t('Aucun questionnaire n’est disponible pour cette formation.')} />

  if (etat.certificatValide) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h2 className="text-xl font-bold mb-2 text-gray-900">{t('Formation déjà certifiée')}</h2>
          <p className="text-gray-600 text-sm mb-6">{t('Votre certificat {numero} est valide.', { numero: etat.certificat?.numero_certificat ?? '' })}</p>
          <div className="flex gap-3 justify-center">
            <Link href={`/formations/${id}`} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">{t('Retour')}</Link>
            <Link href={`/certificat/${etat.certificat?.id}`} className="px-4 py-2 bg-green-600 text-white rounded-lg">{t('Voir le certificat')}</Link>
          </div>
        </div>
      </div>
    )
  }
  if (!etat.formationTerminee) {
    return <Encadre id={id} retour={retour} icone="📘" titre={t('Terminez d’abord la formation')} texte={t('Le questionnaire se débloque une fois toutes les leçons terminées (vous êtes à {pct} %).', { pct: etat.progressionPct })} />
  }
  if (etat.tentativesRestantes === 0) {
    return <Encadre id={id} retour={retour} icone="⛔" titre={t('Plus de tentatives disponibles')} texte={t('Vous avez utilisé vos {max} tentatives (meilleur score : {score} %). Contactez votre gestionnaire pour en obtenir de nouvelles.', { max: q.nb_tentatives_max ?? 0, score: etat.meilleure ?? 0 })} />
  }

  // Questions SANS l'indication de la bonne réponse
  const { data: questions } = await sb.from('questions')
    .select('id, texte, ordre, reponses_possibles(id, texte, ordre)')
    .eq('questionnaire_id', q.id).order('ordre')
  const affichees: QuestionAffichee[] = (questions ?? []).map(x => ({
    id: x.id,
    texte: x.texte,
    reponses: [...(x.reponses_possibles ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map(r => ({ id: r.id, texte: r.texte })),
  }))
  if (affichees.length === 0) return <Encadre id={id} retour={retour} icone="📭" titre={t('Questionnaire vide')} texte={t('Ce questionnaire ne contient pas encore de questions.')} />

  return (
    <QuestionnaireClient
      formationId={id}
      titre={q.titre}
      seuil={q.note_passage}
      tentativesRestantes={etat.tentativesRestantes}
      tentativesFaites={etat.tentatives.length}
      questions={affichees}
    />
  )
}
