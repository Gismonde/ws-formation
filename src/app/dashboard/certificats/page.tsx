import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CertificatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
    .order('date_obtention', { ascending: false })

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Mes certificats</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Vos certificats de formation obtenus</p>
      </div>

      {!certificats || certificats.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>Aucun certificat obtenu pour l&apos;instant.</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>Terminez une formation pour obtenir votre premier certificat.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {certificats.map((cert: any) => (
            <div key={cert.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  🏆
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: '#1a1f36', fontSize: '15px', margin: 0 }}>{cert.formations?.titre ?? 'Formation'}</p>
                  <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>
                    Obtenu le {cert.date_obtention ? new Date(cert.date_obtention).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px' }}>
                  {cert.numero_certificat}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
