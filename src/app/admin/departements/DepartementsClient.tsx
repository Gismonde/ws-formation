'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clinique, CLINIQUE_INFO } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'

type Dept = { id: string; nom: string; clinique: Clinique | null; effectif: number }

const carte: React.CSSProperties = { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '24px' }
const champ: React.CSSProperties = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit' }
const bouton: React.CSSProperties = { padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }

export default function DepartementsClient({ departements, cliniques, estSuperAdmin }: { departements: Dept[]; cliniques: Clinique[]; estSuperAdmin: boolean }) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [clinique, setClinique] = useState<string>(cliniques.length === 1 ? cliniques[0] : '')
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function appeler(method: 'POST' | 'PATCH', body: object) {
    setEnCours(true)
    setMessage(null)
    const res = await fetch('/api/admin/departements', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setEnCours(false)
    if (!res.ok) { setMessage({ ok: false, texte: data.error ?? 'Erreur' }); return false }
    router.refresh()
    return true
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (await appeler('POST', { nom, clinique })) {
      setNom('')
      setMessage({ ok: true, texte: 'Département créé.' })
    }
  }

  const sansClinique = departements.filter(d => !d.clinique)

  return (
    <>
      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
          background: message.ok ? '#f0fdf4' : '#fef2f2', color: message.ok ? '#166534' : '#991b1b',
          border: `1px solid ${message.ok ? '#bbf7d0' : '#fecaca'}` }}>{message.texte}</div>
      )}

      <form onSubmit={creer} style={{ ...carte, padding: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: '14px', color: '#111827', marginRight: '6px' }}>Nouveau département</strong>
        <input style={{ ...champ, flex: 1, minWidth: '200px' }} placeholder="Nom (ex. Bloc opératoire)" value={nom} onChange={e => setNom(e.target.value)} required />
        <select style={champ} value={clinique} onChange={e => setClinique(e.target.value)} required>
          <option value="">Clinique…</option>
          {cliniques.map(c => <option key={c} value={c}>{CLINIQUE_INFO[c].nom}</option>)}
        </select>
        <button type="submit" style={{ ...bouton, opacity: enCours ? 0.6 : 1 }} disabled={enCours}>Créer</button>
      </form>

      {estSuperAdmin && sansClinique.length > 0 && (
        <div style={{ ...carte, padding: '16px 20px', background: '#fffbeb', borderColor: '#fde68a' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#92400e', fontWeight: 600 }}>
            {sansClinique.length} département(s) sans clinique : rattachez-les pour que les administrateurs de clinique les voient.
          </p>
          {sansClinique.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ flex: 1, fontSize: '14px', color: '#374151' }}>{d.nom} <span style={{ color: '#9ca3af' }}>({d.effectif} employé·s)</span></span>
              {(['CMC', 'WSSC'] as Clinique[]).map(c => (
                <button key={c} type="button" disabled={enCours} onClick={() => appeler('PATCH', { id: d.id, clinique: c })}
                  style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: CLINIQUE_INFO[c].fond, color: CLINIQUE_INFO[c].couleur, border: `1px solid ${CLINIQUE_INFO[c].couleur}55` }}>
                  → {c}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {(['CMC', 'WSSC'] as Clinique[]).filter(c => cliniques.includes(c)).map(c => {
        const liste = departements.filter(d => d.clinique === c)
        return (
          <div key={c} style={carte}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px', background: CLINIQUE_INFO[c].fond }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CLINIQUE_INFO[c].logo} alt={CLINIQUE_INFO[c].nom} style={{ height: 32, width: 'auto', borderRadius: 4 }} />
              <strong style={{ fontSize: '15px', color: '#111827' }}>{CLINIQUE_INFO[c].nom}</strong>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>· {liste.length} département(s)</span>
            </div>
            {liste.length === 0 ? (
              <p style={{ padding: '16px 20px', margin: 0, color: '#9ca3af', fontSize: '14px' }}>Aucun département.</p>
            ) : liste.map(d => (
              <div key={d.id} style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                <span style={{ flex: 1, color: '#111827', fontWeight: 500 }}>{d.nom}</span>
                <span style={{ color: '#6b7280' }}>{d.effectif} employé(s)</span>
                <CliniqueBadge clinique={d.clinique} />
                {estSuperAdmin && (
                  <button type="button" disabled={enCours}
                    onClick={() => { const autre = c === 'CMC' ? 'WSSC' : 'CMC'; if (confirm(`Déplacer « ${d.nom} » vers ${autre} ?`)) appeler('PATCH', { id: d.id, clinique: autre }) }}
                    style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280', cursor: 'pointer' }}>
                    Changer de clinique
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
