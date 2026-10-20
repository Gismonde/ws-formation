'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'

/** Sélecteur « Espace CMC / Espace WSSC » (employés rattachés aux deux cliniques). */
export function ChoixEspace({ actif, possibles }: { actif: Clinique | null; possibles: Clinique[] }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<Clinique | null>(null)
  if (possibles.length < 2) return null

  async function choisir(c: Clinique) {
    if (c === actif || enCours) return
    setEnCours(c)
    try {
      const r = await fetch('/api/espace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ espace: c }),
      })
      if (r.ok) router.refresh()
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div role="group" aria-label="Choisir l'espace clinique" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '4px', marginTop: '12px' }}>
      {possibles.map(c => {
        const estActif = c === actif
        return (
          <button
            key={c}
            type="button"
            onClick={() => choisir(c)}
            aria-pressed={estActif}
            disabled={enCours !== null}
            style={{
              flex: 1, border: 'none', borderRadius: '7px', padding: '7px 8px', cursor: estActif ? 'default' : 'pointer',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.2px',
              background: estActif ? '#ffffff' : 'transparent',
              color: estActif ? CLINIQUE_INFO[c].couleur : 'rgba(255,255,255,0.8)',
              opacity: enCours && enCours !== c ? 0.6 : 1,
            }}
          >
            {enCours === c ? '…' : `Espace ${CLINIQUE_INFO[c].court}`}
          </button>
        )
      })}
    </div>
  )
}
