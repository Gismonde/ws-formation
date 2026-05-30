import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function getStatutValidite(dateExpiration: string | null, validiteMois: number | null) {
  if (!validiteMois || !dateExpiration) return 'permanent'
  const now = new Date()
  const expDate = new Date(dateExpiration)
  const joursRestants = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (joursRestants < 0) return 'expire'
  if (joursRestants <= 30) return 'bientot_expire'
  return 'valide'
}

function formatValidite(validiteMois: number | null): string {
  if (!validiteMois) return 'Permanent'
  if (validiteMois >= 12) {
    const ans = Math.floor(validiteMois / 12)
    const mois = validiteMois % 12
    return mois > 0 ? ans + ' an(s) et ' + mois + ' mois' : ans + ' an(s)'
  }
  return validiteMois + ' mois'
}

export default async function CertificatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: employe } = await supabase.from('employes').select('id, prenom, nom').eq('auth_user_id', user.id).single()
  const { data: certificats } = await supabase
    .from('certificats')
    .select('*, formations(titre, categorie, niveau, validite_mois)')
    .eq('employe_id', employe?.id ?? '')
    .order('date_emission', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">&larr; Dashboard</Link>
          <h1 className="font-semibold text-gray-900">Mes certificats</h1>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {!certificats?.length ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">&#x1F393;</div>
            <p className="text-gray-500">Vous n&apos;avez pas encore de certificats.</p>
            <Link href="/formations"><button className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Voir les formations</button></Link>
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
              const badgeLabel = isPermanent ? 'Permanent' : isValide ? 'Valide' : isBientotExpire ? 'Expire bientot' : 'Expire'
              const infoBg = isPermanent ? 'bg-blue-50 text-blue-700' : isValide ? 'bg-green-50 text-green-700' : isBientotExpire ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'

              return (
                <div key={cert.id} className={'bg-white border-2 ' + cardBorder + ' rounded-2xl p-6'}>
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{isExpire ? '&#x274C;' : '&#x1F3C6;'}</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">{cert.numero_certificat}</span>
                      <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + badgeBg}>{badgeLabel}</span>
                    </div>
                  </div>
                  <p className="text-xs text-purple-500 font-medium uppercase tracking-wide mb-1">Certificat de comp&eacute;tence</p>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{cert.formations?.titre}</h3>
                  <p className="text-sm text-gray-500 mb-4">{cert.formations?.categorie}</p>
                  <div className="border-t border-gray-100 pt-4 mb-4 space-y-2">
                    <p className="text-sm text-gray-600">D&eacute;livr&eacute; le <span className="font-medium">{new Date(cert.date_emission).toLocaleDateString('fr-CA')}</span></p>
                    {validiteMois ? (
                      <div className={'text-xs px-3 py-2 rounded-lg ' + infoBg}>
                        <span className="font-semibold">Valide {formatValidite(validiteMois)}</span>
                        {cert.date_expiration && (
                          <span className="block mt-0.5">
                            {isExpire
                              ? 'Expir&eacute; le ' + new Date(cert.date_expiration).toLocaleDateString('fr-CA')
                              : 'Valide jusqu&apos;au ' + new Date(cert.date_expiration).toLocaleDateString('fr-CA')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700">
                        <span className="font-semibold">Validit&eacute; permanente &mdash; aucune expiration</span>
                      </div>
                    )}
                    {cert.note_finale && <p className="text-xs text-green-600 font-medium">Note : {cert.note_finale}/100</p>}
                  </div>
                  <Link
                    href={'/certificat/' + cert.id}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 transition-colors font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    T&eacute;l&eacute;charger le certificat PDF
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
