'use client'
// Validation de la formation avant publication : envoi au validateur, décision, suivi.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import type { StatutValidation } from '@/lib/validation-formation'

type Props = {
  formationId: string
  statut: StatutValidation
  publiee: boolean
  /** Peut gérer la formation (envoyer en validation, annuler) */
  peutGerer: boolean
  /** Administrateur : la validation est facultative */
  admin?: boolean
  /** La personne connectée est le validateur désigné */
  estValidateur: boolean
  validateur: string | null
  demandeur: string | null
  demandeeLe: string | null
  decisionLe: string | null
  valideePar: string | null
  commentaire: string | null
}

const STYLE: Record<StatutValidation, string> = {
  brouillon: 'bg-gray-50 border-gray-200',
  en_validation: 'bg-amber-50 border-amber-200',
  a_modifier: 'bg-red-50 border-red-200',
  approuvee: 'bg-green-50 border-green-200',
}

export default function PanneauValidation(p: Props) {
  const { t, loc } = useT()
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [validateurs, setValidateurs] = useState<{ id: string; nom: string; role: string }[] | null>(null)
  const [choix, setChoix] = useState('')
  const [message, setMessage] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const date = (d: string | null) => (d ? new Date(d).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' }) : '')

  useEffect(() => {
    if (!ouvert || validateurs) return
    fetch(`/api/admin/formations/${p.formationId}/validation`).then(r => r.json()).then(d => setValidateurs(d.validateurs ?? [])).catch(() => setValidateurs([]))
  }, [ouvert, validateurs, p.formationId])

  async function agir(corps: Record<string, unknown>) {
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/admin/formations/${p.formationId}/validation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setErreur(d.error ?? t('Erreur')); return }
    setOuvert(false); setMessage(''); setCommentaire('')
    router.refresh()
  }

  const ROLE: Record<string, string> = { super_admin: t('Administrateur global'), admin: t('Administrateur de clinique'), gestionnaire: t('Gestionnaire') }
  const titre: Record<StatutValidation, string> = {
    brouillon: p.publiee ? t('Modifications non validées') : t('À envoyer en validation'),
    en_validation: t('En attente de validation'),
    a_modifier: t('Modifications demandées'),
    approuvee: p.publiee ? t('Version en ligne validée') : t('Approuvée — prête à publier'),
  }
  const explication: Record<StatutValidation, string> = {
    brouillon: p.publiee
      ? t('La formation a été modifiée depuis sa dernière validation. Envoyez-la en validation pour publier une nouvelle version.')
      : t('Une autre personne (administrateur ou gestionnaire autorisé) doit approuver la formation avant qu’elle puisse être publiée et assignée.'),
    en_validation: t('Demandée par {qui} le {date} à {validateur}.', { qui: p.demandeur ?? '—', date: date(p.demandeeLe), validateur: p.validateur ?? '—' }),
    a_modifier: t('{validateur} a demandé des modifications le {date}.', { validateur: p.validateur ?? '—', date: date(p.decisionLe) }),
    approuvee: t('Approuvée par {qui} le {date}.', { qui: p.valideePar ?? '—', date: date(p.decisionLe) }),
  }

  return (
    <div className={'rounded-2xl border p-5 mb-6 ' + STYLE[p.statut]}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Validation')}</p>
          <p className="font-semibold text-gray-900 mt-0.5">{titre[p.statut]}</p>
          <p className="text-sm text-gray-600 mt-1">{explication[p.statut]}</p>
          {p.admin && p.statut !== 'approuvee' && <p className="text-xs text-gray-500 mt-1">{t('Facultatif pour les administrateurs : vous pouvez publier directement, ou demander une relecture.')}</p>}
          {p.commentaire && p.statut !== 'brouillon' && (
            <p className="text-sm text-gray-800 mt-2 bg-white/70 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-line">💬 {p.commentaire}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.peutGerer && (p.statut === 'brouillon' || p.statut === 'a_modifier') && (
            <button type="button" onClick={() => setOuvert(true)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              {p.statut === 'a_modifier' ? t('Renvoyer en validation') : t('Envoyer en validation')}
            </button>
          )}
          {p.peutGerer && p.statut === 'en_validation' && !p.estValidateur && (
            <button type="button" disabled={envoi} onClick={() => agir({ action: 'annuler' })} className="text-sm px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-50">{t('Annuler la demande')}</button>
          )}
        </div>
      </div>

      {p.estValidateur && p.statut === 'en_validation' && (
        <div className="mt-4 bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">{t('Vous êtes le validateur de cette formation')}</p>
          <p className="text-xs text-gray-500 mb-2">{t('Parcourez la formation comme un employé (bouton « Mode employé ») puis donnez votre décision.')} <a href={`/api/admin/formations/${p.formationId}/mode-employe?retour=fiche`} className="font-semibold text-amber-700 hover:underline">👁 {t('Mode employé')}</a></p>
          <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3} maxLength={2000}
            placeholder={t('Commentaire (obligatoire pour demander des modifications)')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={envoi} onClick={() => agir({ action: 'approuver', commentaire })} className="text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">✅ {t('Approuver')}</button>
            <button type="button" disabled={envoi || !commentaire.trim()} onClick={() => agir({ action: 'modifier', commentaire })} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">✏️ {t('Demander des modifications')}</button>
          </div>
        </div>
      )}

      {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOuvert(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('Envoyer en validation')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('La personne choisie reçoit un courriel et retrouve la formation dans « À valider ». Vous ne pouvez pas valider votre propre formation.')}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Validateur *')}</label>
            {validateurs === null ? <p className="text-sm text-gray-400 mb-3">{t('Chargement…')}</p>
              : validateurs.length === 0 ? <p className="text-sm text-amber-700 mb-3">{t('Aucun validateur disponible pour cette clinique. Donnez le droit « Valider des formations » à un gestionnaire ou demandez à un administrateur.')}</p>
                : (
                  <select value={choix} onChange={e => setChoix(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3">
                    <option value="">{t('Choisir…')}</option>
                    {validateurs.map(v => <option key={v.id} value={v.id}>{v.nom} — {ROLE[v.role] ?? v.role}</option>)}
                  </select>
                )}
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Message (facultatif)')}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={2000} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              placeholder={t('Ex. : nouvelle procédure 2026, vérifier surtout le module 3')} />
            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOuvert(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700">{t('Annuler')}</button>
              <button type="button" disabled={envoi || !choix} onClick={() => agir({ action: 'demander', validateurId: choix, message })} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{envoi ? t('Envoi…') : t('Envoyer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
