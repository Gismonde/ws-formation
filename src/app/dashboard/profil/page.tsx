import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, prenom, nom, email, poste, departement, role, date_embauche')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  const initiales = ((employe.prenom?.[0] ?? '') + (employe.nom?.[0] ?? '')).toUpperCase()

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Profil</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Vos informations personnelles</p>
      </div>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', height: '100px', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: '-32px', left: '32px', width: '64px', height: '64px', borderRadius: '50%', background: '#fff', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: '#6366f1' }}>
            {initiales}
          </div>
        </div>
        <div style={{ padding: '48px 32px 32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1f36', margin: '0 0 4px 0' }}>{employe.prenom} {employe.nom}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>{employe.poste ?? 'Employe'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {([
              ['Email', employe.email],
              ['Role', employe.role],
              ['Departement', employe.departement ?? '-'],
              ['Poste', employe.poste ?? '-'],
              ['Date embauche', employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString('fr-FR') : '-'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px 16px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#1a1f36', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
