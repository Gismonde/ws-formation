// Garde des prérequis : s'applique à toutes les pages d'une formation (présentation, leçons, modules,
// questionnaire, preuve). L'équipe (admin, gestionnaire) garde l'accès pour prévisualiser.
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { prerequisManquants } from '@/lib/prerequis'
import { i18n } from '@/lib/i18n/serveur'

export default async function GardePrerequis({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur || aAccesAdmin(acteur.role)) return <>{children}</>

  const sb = serviceClient()
  const manquants = await prerequisManquants(sb, acteur.id, id)
  if (manquants.length === 0) return <>{children}</>

  const { data: formation } = await sb.from('formations').select('titre').eq('id', id).maybeSingle()
  const { t } = await i18n()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">{t('← Tableau de bord')}</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">{formation?.titre ?? t('Formation verrouillée')}</h1>
          <p className="text-gray-600 mt-2">
            {manquants.length > 1
              ? t('Cette formation s’ouvrira lorsque vous aurez terminé les formations préalables suivantes :')
              : t('Cette formation s’ouvrira lorsque vous aurez terminé la formation préalable suivante :')}
          </p>
          <ul className="mt-5 space-y-3">
            {manquants.map(m => (
              <li key={m.id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-gray-900">{m.titre}</div>
                  <div className="text-xs text-gray-500 mt-1">{t(m.libelle_statut)} · {m.progression} %</div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-2">
                    <div className="h-1.5 rounded-full" style={{ width: `${m.progression}%`, background: 'var(--accent-clinique, #6366f1)' }} />
                  </div>
                </div>
                {m.assigne ? (
                  <Link href={`/formations/${m.id}`} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent-clinique, #4f46e5)' }}>
                    {m.progression > 0 ? t('Continuer') : t('Commencer')}
                  </Link>
                ) : (
                  <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t('Pas encore assignée : demandez-la à votre gestionnaire.')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
