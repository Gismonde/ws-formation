import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { i18n } from '@/lib/i18n/serveur'
import { formulairePourEmploye, numeroReponse, STATUTS, type Formulaire, type StatutReponse } from '@/lib/formulaires'

export default async function MesFormulairesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const [{ data: fs, error }, { data: envois }] = await Promise.all([
    sb.from('formulaires').select('*').eq('actif', true).eq('archive', false).order('titre'),
    sb.from('formulaire_reponses').select('*').eq('employe_id', acteur.id).order('soumis_le', { ascending: false }).limit(50),
  ])
  const disponibles = ((fs ?? []) as Formulaire[]).filter(f => formulairePourEmploye(f, espace.actif, acteur.role === 'super_admin' ? 'LES_DEUX' : acteur.clinique))

  return (
    <div style={{ maxWidth: '860px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>{t('Formulaires')}</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 24px' }}>
        {t('Remplissez ici les formulaires de la clinique (déclarations, demandes…). Ils sont transmis directement à la personne responsable, de façon confidentielle. Vous êtes avisé(e) à chaque étape du traitement.')}
      </p>
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>📝 {t('Formulaires disponibles à remplir')}</h2>

      {error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">{t('Les formulaires ne sont pas encore disponibles.')}</div>
      ) : disponibles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">{t('Aucun formulaire à remplir pour le moment.')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {disponibles.map(f => (
            <Link key={f.id} href={`/dashboard/formulaires/${f.id}`} className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow">
              <div className="flex items-start gap-3">
                {f.image
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.image} alt="" className="h-28 w-20 flex-shrink-0 rounded-md border border-gray-200 bg-white object-cover object-top shadow-sm transition group-hover:shadow-md" />
                  : <span className="text-2xl" aria-hidden>📝</span>}
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-indigo-700">{f.titre}</div>
                  {f.code && <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{f.code}</div>}
                  {f.description && <p className="mt-1 line-clamp-3 text-sm text-gray-600">{f.description}</p>}
                  <span className="mt-3 inline-block text-sm font-semibold text-indigo-600">{t('Remplir →')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {(envois ?? []).length > 0 && (
        <section style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t('Mes formulaires envoyés')}</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {(envois ?? []).map(r => {
              const s = STATUTS[r.statut as StatutReponse] ?? STATUTS.recu
              return (
                <Link key={r.id} href={`/dashboard/formulaires/envois/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="font-mono text-xs text-gray-500">{numeroReponse(r.numero)}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{(r.definition as { titre?: string })?.titre}</span>
                  <span className="text-xs text-gray-500">{new Date(r.soumis_le).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {r.reponse_employe && <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">💬 {t('Réponse reçue')}</span>}
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: s.fond, color: s.couleur }}>{t(s.libelle)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
