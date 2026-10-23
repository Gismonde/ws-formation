import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getEspace } from '@/lib/espace'
import { rechercher, type ResultatRecherche } from '@/lib/recherche-employe'
import { i18n } from '@/lib/i18n/serveur'

const GROUPES: { type: ResultatRecherche['type']; icone: string; titre: string }[] = [
  { type: 'formation', icone: '🎓', titre: 'Formations' },
  { type: 'lecon', icone: '📖', titre: 'Dans les leçons' },
  { type: 'politique', icone: '📜', titre: 'Politiques' },
  { type: 'sop', icone: '📋', titre: 'SOP' },
]

export default async function RecherchePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t } = await i18n()
  const q = ((await searchParams).q ?? '').slice(0, 100)
  const sb = serviceClient()
  const { data: e } = await sb.from('employes').select('id, clinique, role, departement_id, poste').eq('id', acteur.id).single()
  const espace = await getEspace(e)
  const resultats = e && q.trim() ? await rechercher(sb, await createClient(), q, e, espace) : []
  return (
    <div style={{ maxWidth: '820px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1f36', margin: '0 0 4px' }}>{q ? t('Résultats pour « {q} »', { q }) : t('Recherche')}</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }}>{q ? t('{n} résultat(s)', { n: resultats.length }) : t('Tapez un mot dans la barre de recherche ci-dessus.')}</p>
      {q && resultats.length === 0 && <p style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', fontSize: '14px', color: '#6b7280' }}>{t('Aucun résultat. Essayez un autre mot, ou proposez une formation dans « Aidez-nous à nous améliorer ».')} <Link href="/dashboard/suggestions" style={{ color: 'var(--accent-clinique)', fontWeight: 600 }}>💡 →</Link></p>}
      {GROUPES.map(g => {
        const liste = resultats.filter(r => r.type === g.type)
        if (!liste.length) return null
        return (
          <section key={g.type} style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>{g.icone} {t(g.titre)} ({liste.length})</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
              {liste.map(r => (
                <li key={r.type + r.id}>
                  <Link href={r.lien} style={{ display: 'block', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', textDecoration: 'none', color: '#111827' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{r.titre}</span>
                    {r.sousTitre && <span style={{ fontSize: '12px', color: '#6b7280' }}> · {r.sousTitre}</span>}
                    {r.extrait && <span style={{ display: 'block', fontSize: '13px', color: '#4b5563', marginTop: '4px', lineHeight: 1.5 }}>{r.extrait}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
