import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SOP = {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  version: string | null
  fichier_url: string | null
  created_at: string
  updated_at: string | null
}

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

  const sopList: SOP[] = sops ?? []
  const categories = Array.from(new Set(sopList.map(s => s.categorie ?? 'General'))).sort()

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Mes SOP</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Procedures operationnelles standard disponibles
        </p>
      </div>
      {sopList.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Aucune SOP disponible pour le moment.</p>
        </div>
      ) : (
        <div>
          {categories.map(cat => {
            const sopsInCat = sopList.filter(s => (s.categorie ?? 'General') === cat)
            return (
              <div key={cat} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1a1f36' }}>{cat}</span>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: '600' }}>
                    {sopsInCat.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sopsInCat.map(sop => (
                    <div key={sop.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1a1f36' }}>{sop.titre}</h3>
                          {sop.version && (
                            <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '1px 8px', fontSize: '11px', fontWeight: '500' }}>
                              v{sop.version}
                            </span>
                          )}
                        </div>
                        {sop.description && (
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{sop.description}</p>
                        )}
                        <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                          Mise a jour le {new Date(sop.updated_at ?? sop.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      {sop.fichier_url && (
                        <a href={sop.fichier_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#6366f1', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', flexShrink: 0 }}>
                          Consulter
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
      }
