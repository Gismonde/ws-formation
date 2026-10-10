'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmerPolitique({ id, version, texte, confirmeLe }: { id: string; version: number; texte: string; confirmeLe: string | null }) {
  const router = useRouter()
  const [coche, setCoche] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  if (confirmeLe) {
    return (
      <div style={{ marginTop: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px 20px', color: '#166534', fontSize: '14px' }}>
        ✅ Vous avez confirmé avoir lu et compris cette politique le{' '}
        {new Date(confirmeLe).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}.
      </div>
    )
  }

  async function confirmer() {
    setEnCours(true); setErreur('')
    const res = await fetch(`/api/politiques/${id}/confirmer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, lu: true }),
    })
    const d = await res.json().catch(() => ({}))
    setEnCours(false)
    if (!res.ok) return setErreur(d.error ?? 'Erreur')
    router.refresh()
  }

  return (
    <div style={{ marginTop: '20px', background: '#fff', border: '2px solid #fde68a', borderRadius: '12px', padding: '18px 20px' }}>
      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '15px', color: '#111827', cursor: 'pointer' }}>
        <input type="checkbox" checked={coche} onChange={e => setCoche(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px' }} />
        <span>{texte}</span>
      </label>
      {erreur && <p style={{ color: '#dc2626', fontSize: '14px', margin: '10px 0 0' }}>{erreur}</p>}
      <button type="button" onClick={confirmer} disabled={!coche || enCours}
        style={{ marginTop: '14px', padding: '10px 20px', background: coche ? '#16a34a' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: coche ? 'pointer' : 'not-allowed' }}>
        {enCours ? 'Enregistrement…' : 'Confirmer « J’ai lu et compris »'}
      </button>
      <p style={{ fontSize: '12px', color: '#6b7280', margin: '10px 0 0' }}>Votre confirmation est horodatée et conservée comme preuve.</p>
    </div>
  )
}
