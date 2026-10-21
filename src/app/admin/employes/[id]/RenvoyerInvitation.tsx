'use client'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { useState } from 'react'

export default function RenvoyerInvitation({ employeId, email }: { employeId: string; email: string }) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'ok' | 'lien' | 'erreur'>('repos')
  const [lien, setLien] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [copie, setCopie] = useState(false)

  async function envoyer() {
    if (!(await confirmer({ message: t('Envoyer à {email} un lien pour créer ou réinitialiser son mot de passe ?', { email }), bouton: t('Envoyer') }))) return
    setEtat('envoi')
    const res = await fetch('/api/admin/renvoyer-invitation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeId }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? 'Erreur'); setEtat('erreur'); return }
    if (d.courrielEnvoye) setEtat('ok')
    else { setLien(d.lienInvitation); setEtat('lien') }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-gray-900">{t('Accès au portail')}</p>
          <p className="text-xs text-gray-500">{t('L’employé n’a pas reçu son invitation ou a oublié son mot de passe ?')}</p>
        </div>
        <button type="button" onClick={envoyer} disabled={etat === 'envoi'}
          className="px-4 py-2 border border-indigo-600 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
          {etat === 'envoi' ? 'Envoi…' : t('📧 Renvoyer l’invitation')}
        </button>
      </div>
      {etat === 'ok' && <p className="text-sm text-green-700 mt-3">{t('Courriel envoyé à')}{' '}{email}.</p>}
      {etat === 'erreur' && <p className="text-sm text-red-600 mt-3">{msg}</p>}
      {etat === 'lien' && lien && (
        <div className="mt-3">
          <p className="text-xs text-amber-800 mb-2">{t('Envoi de courriels non configuré — transmettez ce lien personnel à l’employé :')}</p>
          <div className="flex gap-2">
            <input readOnly value={lien} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs" onFocus={e => e.target.select()} />
            <button type="button" onClick={() => { navigator.clipboard.writeText(lien); setCopie(true) }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">{copie ? t('Copié ✓') : t('Copier')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
