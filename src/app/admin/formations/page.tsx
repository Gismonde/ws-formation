import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const niveauStyles: Record<string, { bg: string; color: string; label: string }> = {
  debutant: { bg: '#f0fdf4', color: '#16a34a', label: 'Débutant' },
  intermediaire: { bg: '#fefce8', color: '#ca8a04', label: 'Intermédiaire' },
  avance: { bg: '#fff1f2', color: '#e11d48', label: 'Avancé' },
}

export default async function AdminFormationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: moi } = await adminSupabase
    .from('employes')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  const isAdmin = moi?.role === 'admin'

  const { data: formations } = await adminSupabase
    .from('formations')
    .select('id, titre, categorie, niveau, publiee')
    .order('created_at', { ascending: false })

  const { data: modules } = await adminSupabase
    .from('modules')
    .select('id, formation_id')

  const { data: assignations } = await adminSupabase
    .from('assignations')
    .select('id, formation_id')

  const nbModules = (id: string) => modules?.filter((m: any) => m.formation_id === id).length ?? 0
  const nbAssign = (id: string) => assignations?.filter((a: any) => a.formation_id === id).length ?? 0

  return (
    <div>
      <style>{`
        .formations-row:hover { background: #fafafa; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            Formations
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
            {formations?.length ?? 0} formation(s) disponible(s)
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/formations/nouvelle" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
          }}>
            + Nouvelle formation
          </Link>
          <Link href="/admin/formations/generer" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            background: '#fff',
            color: '#2563eb',
            border: '2px solid #2563eb',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
          }}>
            📄 Générer depuis document
          </Link>
        )}
      </div>

      {/* Formations table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Titre</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Catégorie</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Niveau</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modules</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignées</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statut</th>
              <th style={{ padding: '12px 20px' }}></th>
            </tr>
          </thead>
          <tbody>
            {formations?.map((f: any, i: number) => {
              const niveau = niveauStyles[f.niveau] ?? { bg: '#f3f4f6', color: '#6b7280', label: f.niveau }
              return (
                <tr key={f.id} className="formations-row" style={{
                  borderBottom: i < (formations.length - 1) ? '1px solid #f3f4f6' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{f.titre}</div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>{f.categorie ?? '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: niveau.bg,
                      color: niveau.color,
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      {niveau.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: '#374151', fontWeight: '500' }}>{nbModules(f.id)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: '#374151', fontWeight: '500' }}>{nbAssign(f.id)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: f.publiee ? '#f0fdf4' : '#f9fafb',
                      color: f.publiee ? '#16a34a' : '#9ca3af',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: f.publiee ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
                    }}>
                      {f.publiee ? 'Publiée' : 'Brouillon'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link href={`/admin/formations/${f.id}/editeur`} style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        textDecoration: 'none',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}>Editeur</Link>
                      <Link href={`/admin/formations/${f.id}/assigner`} style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: '1px solid #bbf7d0',
                      }}>
                        Assigner
                      </Link>
                      {isAdmin && (
                        <Link href={`/admin/formations/${f.id}/modifier`} style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          textDecoration: 'none',
                          fontSize: '13px',
                          fontWeight: '600',
                          border: '1px solid #bfdbfe',
                        }}>
                          Modifier
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(!formations || formations.length === 0) && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📚</div>
            <p style={{ margin: 0, fontSize: '14px' }}>Aucune formation créée</p>
          </div>
        )}
      </div>
    </div>
  )
}
