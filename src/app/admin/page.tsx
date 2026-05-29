'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Employe = {
    id: string
    auth_user_id: string
    prenom: string
    nom: string
    email: string
    role: string
}

const quickActions = [
  {
        href: '/admin/employes',
        icon: 'people',
        title: 'Employés',
        desc: 'Gérer les comptes employés et leurs accès aux formations',
        color: '#6366f1',
        bg: '#f0f0ff',
  },
  {
        href: '/admin/formations',
        icon: 'school',
        title: 'Formations',
        desc: 'Créer et gérer les formations en ligne',
        color: '#0ea5e9',
        bg: '#f0f9ff',
  },
  {
        href: '/admin/rapports',
        icon: 'bar_chart',
        title: 'Rapports',
        desc: 'Suivre la progression et les certificats des employés',
        color: '#10b981',
        bg: '#f0fdf4',
  },
  {
        href: '/admin/audit-log',
        icon: 'history',
        title: 'Audit Log',
        desc: 'Journal immuable de toutes les actions et événements de la plateforme',
        color: '#f59e0b',
        bg: '#fffbeb',
  },
  ]

export default function AdminPage() {
    const [employe, setEmploye] = useState<Employe | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

  const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

  useEffect(() => {
        async function loadUser() {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { router.push('/login'); return }
                setLoading(false)
        }
        loadUser()
  }, [])

  if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
                          <p style={{ color: '#6b7280', fontSize: '14px' }}>Chargement...</p>
                </div>
        </div>
      )

  return (
        <div>
          {/* Page header */}
              <div style={{ marginBottom: '32px' }}>
                      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
                                Tableau de bord
                      </h1>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                                Vue d'ensemble de la plateforme de formation
                      </p>
              </div>
        
          {/* Quick action cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {quickActions.map((action) => (
                    <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                                <div style={{
                                    background: '#fff',
                                    borderRadius: '16px',
                                    padding: '28px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                                    border: '1px solid #f3f4f6',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                    }}
                                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px rgba(0,0,0,0.07), 0 10px 25px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)'; }}
                                              >
                                              <div style={{
                                                                width: '48px',
                                                                height: '48px',
                                                                background: action.bg,
                                                                borderRadius: '12px',
                                                                display: 'flex',
                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                marginBottom: '16px',
                                              }}>
                                                              <span className="material-icons" style={{ color: action.color, fontSize: '24px' }}>{action.icon}</span>
                                              </div>
                                              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>{action.title}</h3>
                                              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>{action.desc}</p>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '16px', color: action.color, fontSize: '13px', fontWeight: '600' }}>
                                                              Accéder <span className="material-icons" style={{ fontSize: '16px' }}>arrow_forward</span>
                                              </div>
                                </div>
                    </Link>
                  ))}
              </div>
        
          {/* Banner */}
              <div style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  borderRadius: '16px',
                  padding: '28px 32px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
        }}>
                      <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px 0' }}>Gérez votre équipe</h3>
                                <p style={{ margin: 0, opacity: 0.85, fontSize: '14px' }}>Assignez des formations, suivez la conformité et exportez des rapports.</p>
                      </div>
                      <Link href="/admin/employes" style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.3)',
        }}>
                                Voir les employés →
                      </Link>
              </div>
        
              <style>{`
                      @keyframes spin { to { transform: rotate(360deg); } }
                            `}</style>
        </div>
      )
}</div>
