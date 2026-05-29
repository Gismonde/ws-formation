import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SOPPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, departement')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  const { data: sops } = await supabase
    .from('sop')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Mes SOP</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Procedures operationnelles standard disponibles</p>
      </div>

      {!sops || sops.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>Aucune SOP disponible pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {sops.map((sop: any) => (
            <div key={sop.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                📄
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', color: '#1a1f36', fontSize: '15px', margin: 0 }}>{sop.titre}</p>
                {sop.description && <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>{sop.description}</p>}
              </div>
              {sop.url && (
                <a href={sop.url} target="_blank" rel="noopener noreferrer" style={{ background: '#f3f4f6', color: '#374151', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                  Consulter
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
