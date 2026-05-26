'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Departement = { id: string; nom: string }
type Employe = {
  id: string
  prenom: string
  nom: string
  email: string
  role: string
  poste: string | null
  actif: boolean
  departement_id: string | null
  departements?: { nom: string } | null
}

export default function AdminEmployesPage() {
  const [employes, setEmployes] = useState<Employe[]>([])
  const [departements, setDepartements] = useState<Departement[]>([])
  const [filterDept, setFilterDept] = useState<string>('tous')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEmploye, setEditEmploye] = useState<Employe | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', role: 'employe', poste: '', departement_id: '', actif: true })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('employes').select('*, departements(nom)').order('nom'),
      supabase.from('departements').select('id, nom').order('nom')
    ])
    setEmployes(emps || [])
    setDepartements(depts || [])
    setLoading(false)
  }

  const filtered = filterDept === 'tous' ? employes : employes.filter(e => e.departement_id === filterDept)

  function openNew() {
    setEditEmploye(null)
    setForm({ prenom: '', nom: '', email: '', role: 'employe', poste: '', departement_id: '', actif: true })
    setShowForm(true)
  }

  function openEdit(e: Employe) {
    setEditEmploye(e)
    setForm({ prenom: e.prenom || '', nom: e.nom || '', email: e.email, role: e.role, poste: e.poste || '', departement_id: e.departement_id || '', actif: e.actif })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editEmploye) {
      await supabase.from('employes').update({
        prenom: form.prenom, nom: form.nom, role: form.role,
        poste: form.poste || null, departement_id: form.departement_id || null, actif: form.actif
      }).eq('id', editEmploye.id)
    } else {
      // Create auth user first via admin API would require service role
      // For now just show info - admin creates user in Supabase dashboard
      alert('Pour creer un employe : allez dans Supabase Dashboard > Authentication > Users > Invite user. Ensuite revenez ici pour completer son profil.')
      setSaving(false)
      return
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  const badge = (role: string) => {
    const colors: Record<string, string> = { admin: '#dc2626', gestionnaire: '#d97706', employe: '#2563eb' }
    return <span style={{ backgroundColor: colors[role] || '#6b7280', color: 'white', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>{role}</span>
  }

  if (loading) return <div style={{ padding: 32, fontFamily: 'sans-serif' }}>Chargement...</div>

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Employes</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{filtered.length} employe{filtered.length !== 1 ? 's' : ''} {filterDept !== 'tous' ? 'dans ce departement' : 'au total'}</p>
        </div>
        <button onClick={openNew} style={{ backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          + Nouvel employe
        </button>
      </div>

      {/* Department filter */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterDept('tous')}
          style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', borderColor: filterDept === 'tous' ? '#1e40af' : '#d1d5db', backgroundColor: filterDept === 'tous' ? '#1e40af' : 'white', color: filterDept === 'tous' ? 'white' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: filterDept === 'tous' ? 600 : 400 }}
        >Tous les departements</button>
        {departements.map(d => (
          <button key={d.id}
            onClick={() => setFilterDept(d.id)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', borderColor: filterDept === d.id ? '#1e40af' : '#d1d5db', backgroundColor: filterDept === d.id ? '#1e40af' : 'white', color: filterDept === d.id ? 'white' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: filterDept === d.id ? 600 : 400 }}
          >{d.nom}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nom', 'Email', 'Departement', 'Poste', 'Role', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Aucun employe dans ce departement</td></tr>
            ) : filtered.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{e.prenom} {e.nom}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 14 }}>{e.email}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{e.departements?.nom || <span style={{ color: '#d1d5db' }}>â</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b7280' }}>{e.poste || <span style={{ color: '#d1d5db' }}>â</span>}</td>
                <td style={{ padding: '12px 16px' }}>{badge(e.role)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: e.actif ? '#16a34a' : '#dc2626' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: e.actif ? '#16a34a' : '#dc2626', display: 'inline-block' }}></span>
                    {e.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => openEdit(e)} style={{ fontSize: 13, color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>
                    âï¸ Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18 }}>{editEmploye ? 'Modifier l'employe' : 'Nouvel employe'}</h2>
            
            {[['Prenom', 'prenom', 'text'], ['Nom', 'nom', 'text'], ['Email', 'email', 'email'], ['Poste', 'poste', 'text']].map(([label, field, type]) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{label}</label>
                <input type={type} value={(form as any)[field]} disabled={field === 'email' && !!editEmploye}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', backgroundColor: field === 'email' && editEmploye ? '#f9fafb' : 'white' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Departement</label>
              <select value={form.departement_id} onChange={e => setForm(f => ({ ...f, departement_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                <option value="">â Selectionner â</option>
                {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                <option value="employe">Employe</option>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="actif" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} />
              <label htmlFor="actif" style={{ fontSize: 14 }}>Compte actif</label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '8px 16px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
