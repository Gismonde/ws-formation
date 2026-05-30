'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type SOP = {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  version: string | null
  fichier_url: string | null
  acces_role: 'employe' | 'gestionnaire' | 'admin'
  created_at: string
  updated_at: string | null
}

const ROLE_OPTIONS = [
  { value: 'employe',      label: '🟢 Tous les employés',  desc: 'Visible par tous' },
  { value: 'gestionnaire', label: '🔵 Gestionnaires',       desc: 'Gestionnaires + admins' },
  { value: 'admin',        label: '🟡 Admins seulement',   desc: 'Admins uniquement' },
]

const BADGE: Record<string, { bg: string; color: string; label: string }> = {
  employe:      { bg: '#dcfce7', color: '#166534', label: '🟢 Tous' },
  gestionnaire: { bg: '#dbeafe', color: '#1e40af', label: '🔵 Gestionnaires' },
  admin:        { bg: '#fef3c7', color: '#92400e', label: '🟡 Admin' },
}

const EMPTY: Omit<SOP, 'id' | 'created_at' | 'updated_at'> = {
  titre: '',
  description: '',
  categorie: '',
  version: '1.0',
  fichier_url: '',
  acces_role: 'employe',
}

export default function SopAdminPage() {
  const [sops, setSops] = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SOP | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filterRole, setFilterRole] = useState<string>('all')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function loadSops() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sop')
      .select('*')
      .order('acces_role', { ascending: true })
      .order('titre', { ascending: true })
    if (error) setError(error.message)
    else setSops(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadSops() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowForm(true)
    setError(null)
  }

  function openEdit(sop: SOP) {
    setEditing(sop)
    setForm({
      titre: sop.titre,
      description: sop.description ?? '',
      categorie: sop.categorie ?? '',
      version: sop.version ?? '1.0',
      fichier_url: sop.fichier_url ?? '',
      acces_role: sop.acces_role,
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    if (!form.titre.trim()) { setError('Le titre est requis.'); return }
    setSaving(true)
    setError(null)
    const payload = {
      titre: form.titre.trim(),
      description: form.description?.trim() || null,
      categorie: form.categorie?.trim() || null,
      version: form.version?.trim() || '1.0',
      fichier_url: form.fichier_url?.trim() || null,
      acces_role: form.acces_role,
    }
    let err
    if (editing) {
      const { error: e } = await supabase.from('sop').update(payload).eq('id', editing.id)
      err = e
    } else {
      const { error: e } = await supabase.from('sop').insert(payload)
      err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setSuccess(editing ? 'SOP mise à jour.' : 'SOP créée.')
    setShowForm(false)
    loadSops()
    setTimeout(() => setSuccess(null), 3000)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette SOP ?')) return
    setDeleting(id)
    await supabase.from('sop').delete().eq('id', id)
    setDeleting(null)
    loadSops()
  }

  const filtered = filterRole === 'all' ? sops : sops.filter(s => s.acces_role === filterRole)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Gestion des SOP</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>Procédures opérationnelles standard — {sops.length} SOP{sops.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          + Nouvelle SOP
        </button>
      </div>

      {/* Feedback */}
      {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: '500' }}>✅ {success}</div>}
      {error && !showForm && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>⚠️ {error}</div>}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[{ v: 'all', l: 'Toutes' }, { v: 'employe', l: '🟢 Employés' }, { v: 'gestionnaire', l: '🔵 Gestionnaires' }, { v: 'admin', l: '🟡 Admin' }].map(f => (
          <button key={f.v} onClick={() => setFilterRole(f.v)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', border: '1px solid', cursor: 'pointer', background: filterRole === f.v ? '#6366f1' : '#fff', color: filterRole === f.v ? '#fff' : '#374151', borderColor: filterRole === f.v ? '#6366f1' : '#e5e7eb' }}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 24px' }}>{editing ? 'Modifier la SOP' : 'Nouvelle SOP'}</h2>

            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>⚠️ {error}</div>}

            {[
              { label: 'Titre *', key: 'titre', placeholder: 'Ex. : SOP-01 — Onboarding employé' },
              { label: 'Catégorie', key: 'categorie', placeholder: 'Ex. : Ressources humaines' },
              { label: 'Version', key: 'version', placeholder: '1.0' },
              { label: 'URL du fichier (optionnel)', key: 'fichier_url', placeholder: 'https://...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>{label}</label>
                <input
                  value={(form as Record<string, string>)[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Description</label>
              <textarea
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Description courte de la SOP..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Accès par rôle *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ROLE_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: `2px solid ${form.acces_role === opt.value ? '#6366f1' : '#e5e7eb'}`, borderRadius: '10px', cursor: 'pointer', background: form.acces_role === opt.value ? '#f0f0ff' : '#fff' }}>
                    <input type="radio" name="acces_role" value={opt.value} checked={form.acces_role === opt.value} onChange={() => setForm(f => ({ ...f, acces_role: opt.value as SOP['acces_role'] }))} style={{ marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setError(null) }} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des SOPs */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '60px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', margin: '0 0 12px' }}>📄</p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Aucune SOP trouvée</p>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Cliquez sur « Nouvelle SOP » pour en créer une.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(sop => {
            const badge = BADGE[sop.acces_role] ?? BADGE.employe
            return (
              <div key={sop.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{sop.titre}</span>
                    {sop.version && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '1px 8px', fontSize: '11px', fontWeight: '500' }}>v{sop.version}</span>}
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: '6px', padding: '1px 8px', fontSize: '11px', fontWeight: '600' }}>{badge.label}</span>
                    {sop.categorie && <span style={{ background: '#f0f0ff', color: '#6366f1', borderRadius: '6px', padding: '1px 8px', fontSize: '11px' }}>{sop.categorie}</span>}
                  </div>
                  {sop.description && <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>{sop.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {sop.fichier_url && (
                    <a href={sop.fichier_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>Voir</a>
                  )}
                  <button onClick={() => openEdit(sop)} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>✏️ Modifier</button>
                  <button onClick={() => handleDelete(sop.id)} disabled={deleting === sop.id} style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', opacity: deleting === sop.id ? 0.5 : 1 }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
