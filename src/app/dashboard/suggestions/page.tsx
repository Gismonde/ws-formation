import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { empreinteAuteur, MAX_PAR_SEMAINE, STATUTS_SUGGESTION, TYPES_SUGGESTION, type Suggestion } from '@/lib/suggestions'
import FormulaireSuggestion from './FormulaireSuggestion'
import { i18n } from '@/lib/i18n/serveur'

// « Aidez-nous à nous améliorer » : envoyer une suggestion et suivre les siennes.
export default async function SuggestionsPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const empreinte = empreinteAuteur(acteur.id)
  const [{ data: miennes, error }, { data: assign }] = await Promise.all([
    sb.from('suggestions').select('*').eq('empreinte', empreinte).order('created_at', { ascending: false }).limit(50),
    sb.from('assignations').select('formations(id, titre)').eq('employe_id', acteur.id),
  ])
  const formations = (assign ?? []).map(a => (Array.isArray(a.formations) ? a.formations[0] : a.formations) as { id: string; titre: string } | null)
    .filter((f): f is { id: string; titre: string } => !!f).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  const semaine = Date.now() - 7 * 86_400_000
  const restantes = Math.max(0, MAX_PAR_SEMAINE - (miennes ?? []).filter(s => Date.parse(s.created_at) >= semaine).length)
  const titreFormation = (id: string | null) => formations.find(f => f.id === id)?.titre ?? ''

  return (
    <div style={{ maxWidth: '820px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1f36', margin: 0 }}>💡 {t('Aidez-nous à nous améliorer')}</h1>
      <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px', marginBottom: '20px' }}>{t('Une formation qui vous manque, un commentaire, une idée : chaque suggestion est lue par l’équipe.')}</p>
      {error ? (
        <p style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '12px', padding: '12px 16px', fontSize: '14px' }}>{t('Les suggestions seront bientôt disponibles.')}</p>
      ) : (
        <>
          <FormulaireSuggestion formations={formations} restantes={restantes} />
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>{t('Mes suggestions')}</h2>
          {(miennes ?? []).length === 0 ? <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('Aucune suggestion pour le moment.')}</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
              {(miennes as Suggestion[]).map(s => {
                const ty = TYPES_SUGGESTION.find(x => x.id === s.type)!
                const st = STATUTS_SUGGESTION.find(x => x.id === s.statut)!
                return (
                  <li key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
                      <span>{ty.icone}</span>
                      <strong style={{ color: '#111827' }}>{s.sujet || titreFormation(s.formation_id) || t(ty.libelle)}</strong>
                      <span className={st.couleur} style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>{t(st.libelle)}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#374151', margin: '6px 0 0', whiteSpace: 'pre-line' }}>{s.message}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '6px 0 0' }}>{new Date(s.created_at).toLocaleDateString(loc, { dateStyle: 'medium' })}{s.anonyme ? ' · ' + t('anonyme') : ''}</p>
                    {s.reponse && <p style={{ fontSize: '13px', background: '#f8fafc', borderLeft: '3px solid var(--accent-clinique, #4f46e5)', padding: '8px 12px', margin: '8px 0 0', borderRadius: '6px', color: '#1f2937' }}>💬 {s.reponse}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
