import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { i18n } from '@/lib/i18n/serveur'
import type { Traducteur } from '@/lib/i18n/base'

function getStatutValidite(dateExpiration: string | null, validiteMois: number | null) {
  if (!validiteMois || !dateExpiration) return 'permanent'
  const now = new Date()
  const expDate = new Date(dateExpiration)
  const joursRestants = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (joursRestants < 0) return 'expire'
  if (joursRestants <= 30) return 'bientot_expire'
  return 'valide'
}

function formatValidite(validiteMois: number | null, t: Traducteur): string {
  if (!validiteMois) return t('Permanent')
  if (validiteMois >= 12) {
    const ans = Math.floor(validiteMois / 12)
    const mois = validiteMois % 12
    return mois > 0 ? t('{ans} an(s) et {mois} mois', { ans, mois }) : t('{ans} an(s)', { ans })
  }
  return t('{mois} mois', { mois: validiteMois })
}

export default async function CertificatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, loc } = await i18n()
  const jour = (d: string) => new Date(d).toLocaleDateString(loc)
  const { data: employe } = await supabase.from('employes').select('id, prenom, nom').eq('auth_user_id', user.id).single()
  const { data: certificats } = await supabase
    .from('certificats')
    .select('*, formations(titre, categorie, niveau, validite_mois)')
    .eq('employe_id', employe?.id ?? '')
    .order('date_emission', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard/accueil" className="text-gray-500 hover:text-gray-900 text-sm">{t('← Accueil')}</Link>
          <h1 className="font-semibold text-gray-900">{t('Mes certificats')}</h1>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {!certificats?.length ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">&#x1F393;</div>
            <p className="text-gray-500">{t('Vous n’avez pas encore de certificats.')}</p>
            <Link href="/formations"><button className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t('Voir les formations')}</button></Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {certificats.map((cert: any) => {
              const validiteMois = cert.formations?.validite_mois ?? null
              const statut = getStatutValidite(cert.date_expiration, validiteMois)
              const isPermanent = statut === 'permanent'
              const isValide = statut === 'valide'
              const isBientotExpire = statut === 'bientot_expire'
              const isExpire = statut === 'expire'
              const cardBorder = isExpire ? 'border-red-200' : isBientotExpire ? 'border-amber-200' : 'border-purple-200'
              const badgeBg = isPermanent ? 'bg-blue-50 text-blue-700' : isValide ? 'bg-green-50 text-green-700' : isBientotExpire ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              const badgeLabel = isPermanent ? t('Permanent') : isValide ? t('Valide') : isBientotExpire ? t('Expire bientôt') : t('Expiré')
              const infoBg = isPermanent ? 'bg-blue-50 text-blue-700' : isValide ? 'bg-green-50 text-green-700' : isBientotExpire ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'

              return (
                <div key={cert.id} className={'bg-white border-2 ' + cardBorder + ' rounded-2xl p-6'}>
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{isExpire ? '❌' : '🏆'}</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">{cert.numero_certificat}</span>
                      <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + badgeBg}>{badgeLabel}</span>
                    </div>
                  </div>
                  <p className="text-xs text-purple-500 font-medium uppercase tracking-wide mb-1">{t('Certificat de compétence')}</p>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{cert.formations?.titre}</h3>
                  <p className="text-sm text-gray-500 mb-4">{cert.formations?.categorie}</p>
                  <div className="border-t border-gray-100 pt-4 mb-4 space-y-2">
                    <p className="text-sm text-gray-600">{t('Délivré le')} <span className="font-medium">{jour(cert.date_emission)}</span></p>
                    {validiteMois ? (
                      <div className={'text-xs px-3 py-2 rounded-lg ' + infoBg}>
                        <span className="font-semibold">{t('Validité : {duree}', { duree: formatValidite(validiteMois, t) })}</span>
                        {cert.date_expiration && (
                          <span className="block mt-0.5">
                            {isExpire
                              ? t('Expiré le {date}', { date: jour(cert.date_expiration) })
                              : t('Valide jusqu’au {date}', { date: jour(cert.date_expiration) })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700">
                        <span className="font-semibold">{t('Validité permanente — aucune expiration')}</span>
                      </div>
                    )}
                    {cert.note_finale && <p className="text-xs text-green-600 font-medium">{t('Note : {note}/100', { note: cert.note_finale })}</p>}
                  </div>
                  <Link
                    href={'/certificat/' + cert.id}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 transition-colors font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t('Télécharger le certificat PDF')}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
