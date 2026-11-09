'use client'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { useState } from 'react'

/** Mot de passe aléatoire conforme à la règle du portail (majuscule, minuscule, chiffre, 14 caractères). */
function genererMotDePasse(): string {
  const maj = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnpqrstuvwxyz', chi = '23456789'
  const tous = maj + min + chi
  const r = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n }
  const car = [maj[r(maj.length)], min[r(min.length)], chi[r(chi.length)]]
  while (car.length < 14) car.push(tous[r(tous.length)])
  for (let i = car.length - 1; i > 0; i--) { const j = r(i + 1); [car[i], car[j]] = [car[j], car[i]] }
  return car.join('')
}

export default function RenvoyerInvitation({ employeId, email }: { employeId: string; email: string }) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'ok' | 'lien' | 'erreur'>('repos')
  const [lien, setLien] = useState<string | null>(null)
  const [lienCopie, setLienCopie] = useState(false)
  const [msg, setMsg] = useState('')
  const [copie, setCopie] = useState(false)
  // Définir un mot de passe
  const [ouvert, setOuvert] = useState(false)
  const [mdp, setMdp] = useState('')
  const [exiger, setExiger] = useState(true)
  const [mdpEtat, setMdpEtat] = useState<'repos' | 'envoi' | 'ok' | 'erreur'>('repos')
  const [mdpMsg, setMdpMsg] = useState('')
  const [mdpCopie, setMdpCopie] = useState(false)

  async function demanderLien(copier: boolean) {
    if (!copier && !(await confirmer({ message: t('Envoyer à {email} un lien pour créer ou réinitialiser son mot de passe ?', { email }), bouton: t('Envoyer') }))) return
    setEtat('envoi'); setLien(null); setLienCopie(false); setCopie(false)
    const res = await fetch('/api/admin/renvoyer-invitation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeId, copier }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? 'Erreur'); setEtat('erreur'); return }
    if (d.courrielEnvoye) { setEtat('ok'); return }
    setLien(d.lienInvitation); setEtat('lien')
    if (copier && d.lienInvitation) {
      try { await navigator.clipboard.writeText(d.lienInvitation); setLienCopie(true); setCopie(true) } catch { /* copie manuelle */ }
    }
  }

  async function definir() {
    if (!(await confirmer({ message: t('Définir ce mot de passe pour {email} ? Les liens d’invitation encore ouverts ne fonctionneront plus.', { email }), bouton: t('Définir') }))) return
    setMdpEtat('envoi'); setMdpMsg('')
    const res = await fetch('/api/admin/definir-mot-de-passe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeId, motDePasse: mdp, exigerChangement: exiger }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMdpMsg(t(d.error ?? 'Erreur')); setMdpEtat('erreur'); return }
    setMdpEtat('ok')
  }

  const bouton = 'px-4 py-2 border border-indigo-600 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-gray-900">{t('Accès au portail')}</p>
          <p className="text-xs text-gray-500">{t('L’employé n’a pas reçu son invitation ou a oublié son mot de passe ?')}</p>
        </div>
        <button type="button" onClick={() => demanderLien(false)} disabled={etat === 'envoi'} className={bouton}>
          {etat === 'envoi' ? t('Envoi…') : t('📧 Renvoyer l’invitation')}
        </button>
        <button type="button" onClick={() => demanderLien(true)} disabled={etat === 'envoi'} className={bouton}>
          {t('🔗 Copier le lien d’invitation')}
        </button>
        <button type="button" onClick={() => { setOuvert(!ouvert); setMdpEtat('repos') }} className={bouton} aria-expanded={ouvert}>
          {t('🔑 Définir un mot de passe')}
        </button>
      </div>
      {etat === 'ok' && <p className="text-sm text-green-700 mt-3">{t('Courriel envoyé à')}{' '}{email}.</p>}
      {etat === 'erreur' && <p className="text-sm text-red-600 mt-3">{msg}</p>}
      {etat === 'lien' && lien && (
        <div className="mt-3">
          <p className="text-xs text-amber-800 mb-2">
            {lienCopie ? t('Lien copié. Transmettez-le à l’employé (Teams, texto…). Il est personnel : un nouveau lien remplace les précédents.') : t('Transmettez ce lien personnel à l’employé :')}
          </p>
          <div className="flex gap-2">
            <input readOnly value={lien} aria-label={t('Lien d’invitation')} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs" onFocus={e => e.target.select()} />
            <button type="button" onClick={() => { navigator.clipboard.writeText(lien); setCopie(true) }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">{copie ? t('Copié ✓') : t('Copier')}</button>
          </div>
        </div>
      )}
      {ouvert && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {mdpEtat === 'ok' ? (
            <div className="text-sm">
              <p className="text-green-700 font-medium">✓ {t('Mot de passe enregistré.')}</p>
              <p className="text-gray-600 mt-1">{t('Communiquez-le à l’employé de vive voix ou par un canal sécurisé ; il ne sera plus affiché.')}{exiger ? ' ' + t('Il devra choisir son propre mot de passe à sa première connexion.') : ''}</p>
              <div className="flex gap-2 mt-2">
                <input readOnly value={mdp} aria-label={t('Mot de passe')} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" onFocus={e => e.target.select()} />
                <button type="button" onClick={() => { navigator.clipboard.writeText(mdp); setMdpCopie(true) }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">{mdpCopie ? t('Copié ✓') : t('Copier')}</button>
                <button type="button" onClick={() => { setOuvert(false); setMdp(''); setMdpEtat('repos'); setMdpCopie(false) }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">{t('Fermer')}</button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <label htmlFor="mdp-admin" className="block text-xs font-medium text-gray-700 mb-1">{t('Nouveau mot de passe pour {email}', { email })}</label>
              <div className="flex flex-wrap gap-2">
                <input id="mdp-admin" type="text" autoComplete="off" spellCheck={false} value={mdp} onChange={e => setMdp(e.target.value)}
                  className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" />
                <button type="button" onClick={() => setMdp(genererMotDePasse())} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('🎲 Générer')}</button>
                <button type="button" onClick={definir} disabled={!mdp || mdpEtat === 'envoi'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {mdpEtat === 'envoi' ? t('Enregistrement…') : t('Définir le mot de passe')}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('Au moins {n} caractères, avec une majuscule, une minuscule et un chiffre.', { n: 10 })}</p>
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                <input type="checkbox" checked={exiger} onChange={e => setExiger(e.target.checked)} />
                {t('Exiger que l’employé choisisse son propre mot de passe à la première connexion (recommandé)')}
              </label>
              {mdpEtat === 'erreur' && <p className="text-sm text-red-600 mt-2">{mdpMsg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
