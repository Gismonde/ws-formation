import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SOP = {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  version: string | null
  fichier_url: string | null
  acces_role: 'employe' | 'gestionnaire' | 'admin' | null
  created_at: string
  updated_at: string | null
}

// Hiérarchie des rôles : admin > gestionnaire > employe
// Un rôle voit ses SOPs + celles des niveaux inférieurs
const ROLE_HIERARCHY: Record<string, string[]> = {
  super_admin: ['employe', 'gestionnaire', 'admin'],
  admin:        ['employe', 'gestionnaire', 'admin'],
  gestionnaire: ['employe', 'gestionnaire'],
  employe:      ['employe'],
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  employe:      { label: 'Tous',           bg: '#dcfce7', color: '#166534' },
  gestionnaire: { label: 'Gestionnaires', bg: '#dbeafe', color: '#1e40af' },
  admin:        { label: 'Admin',          bg: '#fef3c7', color: '#92400e' },
}

export default async function SOPPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  const userRole = employe.role ?? 'employe'
  const rolesVisibles = ROLE_HIERARCHY[userRole] ?? ['employe']

  // Charger uniquement les SOPs accessibles au rôle de l'utilisateur
  const { data: sops } = await supabase
    .from('sop')
    .select('*')
    .in('acces_role', rolesVisibles)
    .order('acces_role', { ascending: true })
    .order('created_at', { ascending: true })

  const sopList: SOP[] = sops ?? []
  const categories = Array.from(new Set(sopList.map(s => s.categorie ?? 'Général'))).sort()

  const isGestionnaire = ['gestionnaire', 'admin', 'super_admin'].includes(userRole)
  const isAdmin = ['admin', 'super_admin'].includes(userRole)

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Mes SOP</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Procédures opérationnelles standard disponibles pour votre rôle
        </p>
        {/* Légende des niveaux d'accès */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '500' }}>
            🟢 Tous les employés
          </span>
          {isGestionnaire && (
            <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '500' }}>
              🔵 Gestionnaires
            </span>
          )}
          {isAdmin && (
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '500' }}>
              🟡 Administration
            </span>
          )}
        </div>
      </div>

      {sopList.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Aucune SOP disponible pour le moment.</p>
        </div>
      ) : (
        <div>
          {categories.map(cat => {
            const sopsInCat = sopList.filter(s => (s.categorie ?? 'Général') === cat)
            return (
              <div key={cat} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1a1f36' }}>{cat}</span>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: '600' }}>
                    {sopsInCat.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sopsInCat.map(sop => {
                    const badge = ROLE_BADGE[sop.acces_role ?? 'employe']
                    return (
                      <div key={sop.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1a1f36' }}>{sop.titre}</h3>
                            {sop.version && (
                              <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '1px 8px', fontSize: '11px', fontWeight: '500' }}>
                                v{sop.version}
                              </span>
                            )}
                            <span style={{ background: badge.bg, color: badge.color, borderRadius: '6px', padding: '1px 8px', fontSize: '11px', fontWeight: '600' }}>
                              {badge.label}
                            </span>
                          </div>
                          {sop.description && (
                            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{sop.description}</p>
                          )}
                          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                            Mise à jour le {new Date(sop.updated_at ?? sop.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                        {sop.fichier_url && (
                          <a href={sop.fichier_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#6366f1', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', flexShrink: 0 }}>
                            Consulter
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
