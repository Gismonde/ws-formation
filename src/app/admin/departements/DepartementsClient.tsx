'use client'

import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLINIQUE_INFO } from '@/lib/cliniques'

type Dept = { id: string; nom: string; effectif: { CMC: number; WSSC: number; sans: number } }

const carte: React.CSSProperties = { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '24px' }
const champ: React.CSSProperties = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit' }
const bouton: React.CSSProperties = { padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }
const td: React.CSSProperties = { padding: '12px 20px', fontSize: '14px', color: '#374151', borderTop: '1px solid #f3f4f6' }

export default function DepartementsClient({ departements, estSuperAdmin }: { departements: Dept[]; estSuperAdmin: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [nom, setNom] = useState('')
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
    if (await appeler('POST', { nom })) {
      setNom('')
      setMessage({ ok: true, texte: t('Département créé (disponible pour les deux cliniques).') })
    }
  }

  function renommer(d: Dept) {
    const nouveau = prompt(t('Nouveau nom pour « {nom} » :', { nom: d.nom }), d.nom)
    if (nouveau && nouveau.trim() && nouveau.trim() !== d.nom) appeler('PATCH', { id: d.id, nom: nouveau })
  }

  return (
    <>
      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
          background: message.ok ? '#f0fdf4' : '#fef2f2', color: message.ok ? '#166534' : '#991b1b',
          border: `1px solid ${message.ok ? '#bbf7d0' : '#fecaca'}` }}>{message.texte}</div>
      )}

      <form onSubmit={creer} style={{ ...carte, padding: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: '14px', color: '#111827', marginRight: '6px' }}>{t('Nouveau département')}</strong>
        <input style={{ ...champ, flex: 1, minWidth: '220px' }} placeholder={t('Nom (ex. Bloc opératoire)')} value={nom} onChange={e => setNom(e.target.value)} required />
        <button type="submit" style={{ ...bouton, opacity: enCours ? 0.6 : 1 }} disabled={enCours}>{t('Créer')}</button>
      </form>

      <div style={carte}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('Département')}</th>
              <th style={{ ...th, textAlign: 'center' }}>{CLINIQUE_INFO.CMC.court}</th>
              <th style={{ ...th, textAlign: 'center' }}>{CLINIQUE_INFO.WSSC.court}</th>
              <th style={{ ...th, textAlign: 'center' }}>{t('Sans clinique')}</th>
              {estSuperAdmin && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {departements.map(d => (
              <tr key={d.id}>
                <td style={{ ...td, fontWeight: 500, color: '#111827' }}>{d.nom}</td>
                <td style={{ ...td, textAlign: 'center' }}>{d.effectif.CMC}</td>
                <td style={{ ...td, textAlign: 'center' }}>{d.effectif.WSSC}</td>
                <td style={{ ...td, textAlign: 'center', color: d.effectif.sans ? '#b45309' : '#9ca3af' }}>{d.effectif.sans}</td>
                {estSuperAdmin && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button type="button" disabled={enCours} onClick={() => renommer(d)}
                      style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280', cursor: 'pointer' }}>
                      {t('Renommer')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
