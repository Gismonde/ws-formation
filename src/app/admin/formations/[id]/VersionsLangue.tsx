'use client'
// Versions linguistiques : relier la version anglaise d'une formation française (ou retirer le lien).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import type { Concordance, Ecart } from '@/lib/concordance-langues'

type F = { id: string; titre: string }

const NOMS_ELEMENTS: Record<string, string> = {
  cartes: 'cartes', sections: 'sections', etapes: 'étapes', paires: 'éléments à classer', zones: 'zones', items: 'éléments',
  elements: 'éléments', erreurs: 'erreurs', scenario: 'situations', questions: 'questions',
}

/** Section « Concordance FR/EN » : écarts de structure entre la version française et l'anglaise. */
function SectionConcordance({ c }: { c: Concordance }) {
  const { t, loc } = useT()
  const [tout, setTout] = useState(false)
  const pos = (e: { lecon: number; bloc?: number }) => e.bloc ? t('Leçon {l}, bloc {b}', { l: e.lecon, b: e.bloc }) : t('Leçon {l}', { l: e.lecon })
  const texte = (e: Ecart): string => {
    switch (e.quoi) {
      case 'lecons': return t('Nombre de leçons : {fr} en FR, {en} en EN', { fr: e.fr, en: e.en })
      case 'blocs': return pos(e) + ' : ' + t('{fr} blocs en FR, {en} en EN', { fr: e.fr, en: e.en })
      case 'type': return pos(e) + ' : ' + t('type différent ({fr} en FR, {en} en EN)', { fr: e.fr, en: e.en })
      case 'image': return pos(e) + ' : ' + t('image ou fichier différent')
      case 'elements': return pos(e) + ' : ' + t('{fr} {quoi} en FR, {en} en EN', { fr: e.fr, en: e.en, quoi: t(NOMS_ELEMENTS[e.cle] ?? e.cle) })
      case 'reponses': return pos(e) + ' : ' + t('bonnes réponses différentes')
      case 'questions': return t('Questionnaire final : {fr} questions en FR, {en} en EN', { fr: e.fr, en: e.en })
      case 'question': return t('Questionnaire final, question {n} : bonnes réponses ou nombre de réponses différents', { n: e.question })
    }
  }
  const date = (d: string | null) => d ? new Date(d).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : '—'
  const liste = tout ? c.ecarts : c.ecarts.slice(0, 8)
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">{t('Concordance FR/EN')}</h3>
      {c.ecarts.length === 0 ? (
        <p className="text-sm text-green-700">✓ {t('Structures identiques : leçons, blocs, images, nombre d’éléments et bonnes réponses.')}</p>
      ) : (
        <>
          <p className="text-sm text-amber-800 font-medium">⚠ {t('{n} écart(s) de structure entre les deux versions', { n: c.ecarts.length })}</p>
          <ul className="mt-1 text-xs text-amber-900 list-disc pl-5 space-y-0.5">{liste.map((e, i) => <li key={i}>{texte(e)}</li>)}</ul>
          {c.ecarts.length > 8 && <button type="button" onClick={() => setTout(!tout)} className="text-xs text-indigo-700 hover:underline mt-1">{tout ? t('Voir moins') : t('Voir les {n} écarts', { n: c.ecarts.length })}</button>}
        </>
      )}
      {c.fr_modifiee_apres && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2">⚠ {t('La version française a été modifiée après la version anglaise (FR : {fr} · EN : {en}). Vérifiez que la traduction est à jour.', { fr: date(c.fr_modifiee_le), en: date(c.en_modifiee_le) })}</p>
      )}
      <p className="text-[11px] text-gray-400 mt-2">{t('Vérification automatique de la structure à chaque ouverture ; la qualité de la traduction n’est pas vérifiée.')}</p>
    </div>
  )
}

export default function VersionsLangue({ formationId, francaise, anglaise, candidates, concordance = null }: {
  formationId: string
  /** Si cette formation est elle-même une version anglaise : sa version française */
  francaise: F | null
  anglaise: F | null
  candidates: F[]
  concordance?: Concordance | null
}) {
  const { t } = useT()
  const router = useRouter()
  const [choix, setChoix] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)

  const lier = async (racine: string, anglaiseId: string | null) => {
    setEnvoi(true); setMsg(null)
    const r = await fetch(`/api/admin/formations/${racine}/version-anglaise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anglaise_id: anglaiseId }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setMsg({ ok: true, texte: anglaiseId ? t('✓ Version anglaise reliée') : t('✓ Lien retiré') }); setChoix(''); router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">🌐 {t('Versions linguistiques')}</h2>
      <p className="text-xs text-gray-500 mb-3">{t('Chaque employé reçoit la version de sa langue de formation (fiche de l’employé ou son profil). Terminer l’une ou l’autre version compte pour la conformité et les prérequis.')}</p>
      {francaise ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">EN</span>
          <span>{t('Version anglaise de')} <Link className="text-indigo-700 hover:underline" href={`/admin/formations/${francaise.id}`}>« {francaise.titre} »</Link></span>
          <button type="button" disabled={envoi} onClick={() => lier(francaise.id, null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t('Retirer le lien')}</button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {anglaise && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">EN</span>
              <Link className="text-indigo-700 hover:underline" href={`/admin/formations/${anglaise.id}`}>{anglaise.titre}</Link>
              <button type="button" disabled={envoi} onClick={() => lier(formationId, null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t('Retirer le lien')}</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={t('Version anglaise')} value={choix} onChange={e => setChoix(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-full">
              <option value="">{anglaise ? t('Remplacer la version anglaise par…') : t('Choisir la version anglaise…')}</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
            </select>
            <button type="button" disabled={envoi || !choix} onClick={() => lier(formationId, choix)} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Relier')}</button>
          </div>
        </div>
      )}
      {concordance && <SectionConcordance c={concordance} />}
      {msg && <p role="status" className={`text-xs mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.texte}</p>}
    </div>
  )
}
