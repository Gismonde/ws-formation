'use client'
// Formulaire « Aidez-nous à nous améliorer » : 3 types, anonymat au choix.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { TYPES_SUGGESTION, LONGUEUR_MAX, MAX_PAR_SEMAINE, type TypeSuggestion } from '@/lib/suggestions'

export default function FormulaireSuggestion({ formations, restantes }: { formations: { id: string; titre: string }[]; restantes: number }) {
  const { t } = useT()
  const router = useRouter()
  const [type, setType] = useState<TypeSuggestion>('formation')
  const [sujet, setSujet] = useState('')
  const [formationId, setFormationId] = useState('')
  const [message, setMessage] = useState('')
  const [anonyme, setAnonyme] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null)

  const envoyer = async () => {
    setEnvoi(true); setRetour(null)
    const r = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, sujet, formation_id: formationId || null, message, anonyme }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setRetour({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setRetour({ ok: true, texte: t('Merci ! Votre suggestion a bien été envoyée.') })
    setSujet(''); setMessage(''); setFormationId('')
    router.refresh()
  }

  const champ = { width: '100%', border: '1px solid #d1d5db', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' } as const
  const desactive = restantes <= 0
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {TYPES_SUGGESTION.map(x => (
          <button key={x.id} type="button" onClick={() => setType(x.id)} aria-pressed={type === x.id}
            style={{ textAlign: 'left', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
              border: type === x.id ? '2px solid var(--accent-clinique, #4f46e5)' : '1px solid #e5e7eb', background: type === x.id ? '#f8fafc' : '#fff' }}>
            <span style={{ fontSize: '22px' }}>{x.icone}</span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', color: '#111827', marginTop: '4px' }}>{t(x.libelle)}</span>
            <span style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>{t(x.aide)}</span>
          </button>
        ))}
      </div>
      {type === 'commentaire' ? (
        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{t('Formation concernée *')}</span>
          <select value={formationId} onChange={e => setFormationId(e.target.value)} style={champ}>
            <option value="">{t('— Choisir —')}</option>
            {formations.map(f => <option key={f.id} value={f.id}>{f.titre}</option>)}
          </select>
        </label>
      ) : (
        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{type === 'formation' ? t('Sujet de la formation souhaitée *') : t('En quelques mots (facultatif)')}</span>
          <input value={sujet} onChange={e => setSujet(e.target.value)} maxLength={150} style={champ}
            placeholder={type === 'formation' ? t('Ex. : Gestion de la douleur postopératoire') : t('Ex. : Rappel avant l’échéance d’une formation')} />
        </label>
      )}
      <label style={{ display: 'block', marginBottom: '12px' }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
          {type === 'formation' ? t('Pourquoi cette formation vous serait utile *') : type === 'commentaire' ? t('Votre commentaire *') : t('Votre idée *')}
        </span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={LONGUEUR_MAX} rows={4} style={{ ...champ, resize: 'vertical' }} />
        <span style={{ display: 'block', textAlign: 'right', fontSize: '11px', color: '#9ca3af' }}>{message.length}/{LONGUEUR_MAX}</span>
      </label>
      <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#374151', marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={anonyme} onChange={e => setAnonyme(e.target.checked)} style={{ marginTop: '2px' }} />
        <span><strong>{t('Envoyer anonymement')}</strong><span style={{ display: 'block', color: '#6b7280', fontSize: '12px' }}>{t('Votre nom n’est pas enregistré avec la suggestion. Vous verrez quand même son statut et la réponse ci-dessous.')}</span></span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={envoyer} disabled={envoi || desactive || message.trim().length < 5}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent-clinique, #4f46e5)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: envoi || desactive || message.trim().length < 5 ? 0.5 : 1 }}>
          {envoi ? t('Envoi…') : t('Envoyer')}
        </button>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{desactive ? t('Limite de {n} suggestions par semaine atteinte. Merci !', { n: MAX_PAR_SEMAINE }) : t('{n} suggestion(s) possible(s) cette semaine', { n: restantes })}</span>
      </div>
      {retour && <p style={{ marginTop: '12px', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', background: retour.ok ? '#f0fdf4' : '#fef2f2', color: retour.ok ? '#166534' : '#b91c1c' }}>{retour.texte}</p>}
    </div>
  )
}
