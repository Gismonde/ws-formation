'use client'

// Remplissage d'un formulaire par l'employé : instructions de l'admin, champs, brouillon local, envoi.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { TexteRiche } from '@/lib/texte-riche'
import ChampsFormulaire from './ChampsFormulaire'
import { estChampIdentite, MESSAGE_ANONYMAT_DEFAUT, type Champ, type Reponses } from '@/lib/formulaires'

export default function RemplirFormulaire({ formulaireId, titre, code, description, instructions, champs, initiales, accent, anonymePermis = false, messageAnonymat = null }: {
  formulaireId: string
  titre: string
  code: string | null
  description: string | null
  instructions: string | null
  champs: Champ[]
  initiales: Reponses
  accent: string
  anonymePermis?: boolean
  messageAnonymat?: string | null
}) {
  const { t } = useT()
  const cle = 'brouillon-formulaire:' + formulaireId
  const [valeurs, setValeurs] = useState<Reponses>(initiales)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [envoye, setEnvoye] = useState<{ id: string; numero: string; anonyme?: boolean } | null>(null)
  const [aideOuverte, setAideOuverte] = useState(true)
  const [brouillonRepris, setBrouillonRepris] = useState(false)
  const [anonyme, setAnonyme] = useState(false)
  const [accepte, setAccepte] = useState(false)
  const pret = useRef(false)

  // Brouillon gardé sur cet appareil seulement (rien n'est envoyé avant « Envoyer »)
  useEffect(() => {
    try {
      const b = localStorage.getItem(cle)
      if (b) { setValeurs({ ...initiales, ...JSON.parse(b) }); setBrouillonRepris(true) }
    } catch { /* stockage indisponible */ }
    pret.current = true
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pret.current || envoye) return
    try { localStorage.setItem(cle, JSON.stringify(valeurs)) } catch { /* stockage indisponible */ }
  }, [valeurs, cle, envoye])

  const effacerBrouillon = () => {
    try { localStorage.removeItem(cle) } catch { /* rien */ }
    setValeurs(initiales); setBrouillonRepris(false)
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true); setErreur(null)
    try {
      if (anonyme && !accepte) { setErreur(t('Cochez la case confirmant que vous avez lu le message sur l’envoi anonyme.')); return }
      // Envoi anonyme : les champs d'identité ne sont jamais transmis
      const envoyees = anonyme ? Object.fromEntries(Object.entries(valeurs).filter(([k]) => !champs.some(c => c.id === k && estChampIdentite(c)))) : valeurs
      const res = await fetch(`/api/formulaires/${formulaireId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reponses: envoyees, anonyme, accepte_anonymat: anonyme ? accepte : undefined }) })
      const d = await res.json()
      if (!res.ok) { setErreur(d.error ?? t('Envoi impossible')); return }
      try { localStorage.removeItem(cle) } catch { /* rien */ }
      setEnvoye({ ...d, anonyme })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setErreur(t('Erreur réseau : vérifiez votre connexion puis réessayez. Vos réponses sont gardées.')) }
    finally { setEnvoi(false) }
  }

  if (envoye) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">✅</div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">{t('Formulaire envoyé')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('Votre formulaire « {titre} » a bien été transmis. Numéro de suivi : {numero}.', { titre, numero: envoye.numero })}</p>
        {envoye.anonyme && <p className="mt-2 text-sm text-gray-600">🕶️ {t('Envoyé de façon anonyme : il n’apparaîtra pas dans « Mes formulaires » et vous ne recevrez pas de suivi.')}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!envoye.anonyme && <Link href={`/dashboard/formulaires/envois/${envoye.id}`} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: accent }}>{t('Voir mon envoi')}</Link>}
          <Link href="/dashboard/formulaires" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Retour aux formulaires')}</Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/dashboard/formulaires" className="text-sm text-gray-500 hover:text-gray-800">← {t('Formulaires')}</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{titre}</h1>
        {code && <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{code}</p>}
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>

      {instructions && (
        <div className="rounded-xl border border-amber-200 bg-amber-50">
          <button type="button" onClick={() => setAideOuverte(o => !o)} aria-expanded={aideOuverte}
            className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-semibold text-amber-900">
            <span>💡 {t('Comment remplir ce formulaire')}</span>
            <span aria-hidden>{aideOuverte ? '▲' : '▼'}</span>
          </button>
          {aideOuverte && <div className="border-t border-amber-200 px-5 py-4 text-sm leading-relaxed text-amber-950 [&_li]:my-0.5 [&_p]:my-1.5"><TexteRiche texte={instructions} /></div>}
        </div>
      )}

      {brouillonRepris && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
          <span>📝 {t('Nous avons repris le brouillon commencé sur cet appareil.')}</span>
          <button type="button" onClick={effacerBrouillon} className="text-xs font-semibold underline">{t('Recommencer à zéro')}</button>
        </div>
      )}

      {anonymePermis && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800">{t('Comment voulez-vous envoyer ce formulaire ?')}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[false, true].map(an => (
              <label key={String(an)} className={'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-sm ' + (anonyme === an ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
                <input type="radio" name="anonymat" checked={anonyme === an} onChange={() => { setAnonyme(an); setAccepte(false) }} className="mt-0.5" style={{ accentColor: accent }} />
                <span>
                  <span className="block font-semibold text-gray-900">{an ? `🕶️ ${t('De façon anonyme')}` : `👤 ${t('Avec mon nom')}`}</span>
                  <span className="block text-xs text-gray-500">{an ? t('Votre nom n’est pas transmis. Aucun suivi possible.') : t('Vous pourrez suivre le traitement et recevoir une réponse.')}</span>
                </span>
              </label>
            ))}
          </div>
          {anonyme && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <input type="checkbox" checked={accepte} onChange={e => setAccepte(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0" required />
              <span>{messageAnonymat || MESSAGE_ANONYMAT_DEFAUT}</span>
            </label>
          )}
        </section>
      )}

      <ChampsFormulaire champs={champs} valeurs={valeurs} onChange={setValeurs} partie="employe" accent={accent} masquerIdentite={anonyme} />

      {erreur && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs text-gray-500">{t('Les champs marqués * sont obligatoires. Votre brouillon est gardé sur cet appareil jusqu’à l’envoi.')}</p>
        <button type="submit" disabled={envoi} className="rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60" style={{ background: accent }}>
          {envoi ? t('Envoi…') : t('Envoyer le formulaire')}
        </button>
      </div>
    </form>
  )
}
