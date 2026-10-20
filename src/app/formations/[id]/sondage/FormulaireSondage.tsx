'use client'

import { useState } from 'react'
import Link from 'next/link'
import { QUESTIONS_SONDAGE, ECHELLE, COMMENTAIRE_MAX, type CleQuestion } from '@/lib/sondages'
import { useT } from '@/lib/i18n/client'

export default function FormulaireSondage({ formationId }: { formationId: string }) {
  const [valeurs, setValeurs] = useState<Partial<Record<CleQuestion, number>>>({})
  const [commentaire, setCommentaire] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fini, setFini] = useState(false)
  const { t } = useT()
  const complet = QUESTIONS_SONDAGE.every(q => valeurs[q.cle])

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (!complet) { setErreur(t('Répondez à toutes les questions.')); return }
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/formations/${formationId}/sondage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valeurs, commentaire }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (r.ok || r.status === 409) setFini(true)
    else setErreur(d.error ?? t('Erreur, réessayez.'))
  }

  if (fini) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🙏</div>
        <h2 className="text-lg font-bold text-gray-900">{t('Merci pour votre avis !')}</h2>
        <p className="text-gray-600 mt-2 text-sm">{t('Vos réponses aident à améliorer les formations.')}</p>
        <Link href="/dashboard/accueil" className="inline-block mt-5 px-5 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: 'var(--accent-clinique, #4f46e5)' }}>{t('Retour à l’accueil')}</Link>
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} className="space-y-4">
      {QUESTIONS_SONDAGE.map((q, i) => (
        <fieldset key={q.cle} className="bg-white border border-gray-200 rounded-2xl p-5">
          <legend className="sr-only">{t(q.texte)}</legend>
          <p className="font-medium text-gray-900 mb-3">{i + 1}. {t(q.texte)}</p>
          <div className="grid grid-cols-5 gap-2">
            {ECHELLE.map((libelle, n) => {
              const v = n + 1
              const actif = valeurs[q.cle] === v
              return (
                <label key={v} className={'flex flex-col items-center gap-1 rounded-xl border p-2 cursor-pointer text-center transition ' + (actif ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                  style={actif ? { background: 'var(--accent-clinique, #4f46e5)' } : undefined}>
                  <input type="radio" name={q.cle} value={v} checked={actif} onChange={() => setValeurs(p => ({ ...p, [q.cle]: v }))} className="sr-only" />
                  <span className="text-lg font-bold">{v}</span>
                  <span className="text-[10px] leading-tight hidden sm:block">{t(libelle)}</span>
                </label>
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 sm:hidden"><span>{t(ECHELLE[0])}</span><span>{t(ECHELLE[4])}</span></div>
        </fieldset>
      ))}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <label htmlFor="commentaire" className="font-medium text-gray-900 block mb-2">{t('Commentaire ou suggestion (facultatif)')}</label>
        <textarea id="commentaire" value={commentaire} onChange={e => setCommentaire(e.target.value)} maxLength={COMMENTAIRE_MAX} rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('Ce qui vous a plu, ce qui pourrait être amélioré…')} />
        <p className="text-xs text-gray-400 mt-1">{t('Les résultats sont présentés à l’équipe de formation sans votre nom.')}</p>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <button type="submit" disabled={envoi || !complet} className="w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: 'var(--accent-clinique, #4f46e5)' }}>
        {envoi ? t('Envoi…') : t('Envoyer mon avis')}
      </button>
    </form>
  )
}
