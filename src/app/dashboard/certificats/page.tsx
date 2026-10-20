import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { i18n } from '@/lib/i18n/serveur'

export default async function CertificatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, loc } = await i18n()

  const { data: employe } = await supabase
    .from('employes')
    .select('id, prenom, nom')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  const { data: certificats } = await supabase
    .from('certificats')
    .select('*, formations(titre, categorie)')
    .eq('employe_id', employe.id)
    .order('date_emission', { ascending: false })

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>{t('Mes certificats')}</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>{t('Vos certificats de formation obtenus')}</p>
      </div>

      {!certificats || certificats.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>{t('Aucun certificat obtenu pour l’instant.')}</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>{t('Terminez une formation pour obtenir votre premier certificat.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {certificats.map((cert: any) => (
            <div key={cert.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  🏆
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: '#1a1f36', fontSize: '15px', margin: 0 }}>{cert.formations?.titre ?? t('Formation')}</p>
                  <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>
                    {t('Obtenu le {date}', { date: cert.date_emission ? new Date(cert.date_emission).toLocaleDateString(loc) : '—' })}{cert.date_expiration ? t(' · valide jusqu’au {date}', { date: new Date(cert.date_expiration + 'T12:00:00').toLocaleDateString(loc) }) : ''}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px' }}>
                  {cert.numero_certificat}
                </span>
                <div style={{ marginTop: '8px' }}>
                  <a href={'/certificat/' + cert.id} style={{ fontSize: '13px', color: 'var(--accent-clinique)', textDecoration: 'none' }}>{t('Voir / imprimer')} →</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
