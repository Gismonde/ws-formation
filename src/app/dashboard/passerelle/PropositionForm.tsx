'use client'
// « Proposer une idée ou des photos » : formulaire des employés en bas de La Passerelle.
// Les fichiers (PDF, JPEG, PNG) partent directement dans l'espace privé, puis la proposition est enregistrée.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useT } from '@/lib/i18n/client'
import { FICHIERS_PROPOSITION, STATUTS_PROPOSITION, type FichierProposition, type StatutProposition } from '@/lib/passerelle-propositions'

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4537E]'
const taille = (o: number) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`)

async function envoyerFichier(f: File): Promise<FichierProposition> {
  const r = await fetch('/api/passerelle/propositions/fichier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: f.type, taille: f.size }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${f.name} : ${d.error ?? 'envoi refusé'}`)
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await sb.storage.from(d.bucket).uploadToSignedUrl(d.chemin, d.jeton, f, { contentType: f.type })
  if (error) throw new Error(`${f.name} : ${error.message}`)
  return { ref: d.reference, nom: f.name, type: f.type, taille: f.size }
}

export type MaProposition = { id: string; sujet: string; statut: StatutProposition; cree_le: string; nbFichiers: number }

export default function PropositionForm({ mesPropositions }: { mesPropositions: MaProposition[] }) {
  const { t, loc } = useT()
  const router = useRouter()
  const entree = useRef<HTMLInputElement>(null)
  const [ouvert, setOuvert] = useState(false)
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState('')
  const [fichiers, setFichiers] = useState<File[]>([])
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)

  function ajouter(liste: FileList | null) {
    setEtat(null)
    const refus: string[] = []
    const ok = Array.from(liste ?? []).filter(f => {
      if (!FICHIERS_PROPOSITION.types[f.type]) { refus.push(t('{nom} : format non accepté (PDF, JPEG ou PNG).', { nom: f.name })); return false }
      if (f.size > FICHIERS_PROPOSITION.tailleMaxMo * 1024 * 1024) { refus.push(t('{nom} : plus de {n} Mo.', { nom: f.name, n: FICHIERS_PROPOSITION.tailleMaxMo })); return false }
      return true
    })
    const toutes = [...fichiers, ...ok]
    if (toutes.length > FICHIERS_PROPOSITION.max) refus.push(t('{n} fichiers maximum.', { n: FICHIERS_PROPOSITION.max }))
    setFichiers(toutes.slice(0, FICHIERS_PROPOSITION.max))
    if (refus.length) setEtat({ ok: false, texte: refus.join(' ') })
  }

  async function envoyer() {
    setEtat(null)
    if (!sujet.trim()) { setEtat({ ok: false, texte: t('Donnez un titre à votre proposition.') }); return }
    try {
      const joints: FichierProposition[] = []
      for (const [i, f] of fichiers.entries()) {
        setEnvoi(t('Envoi du fichier {i} sur {n}…', { i: i + 1, n: fichiers.length }))
        joints.push(await envoyerFichier(f))
      }
      setEnvoi(t('Envoi de la proposition…'))
      const r = await fetch('/api/passerelle/propositions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sujet, message, fichiers: joints }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? t('Envoi impossible'))
      setSujet(''); setMessage(''); setFichiers([]); setOuvert(false)
      setEtat({ ok: true, texte: t('Merci ! Votre proposition a été envoyée à l’équipe du journal.') })
      router.refresh()
    } catch (e) {
      setEtat({ ok: false, texte: e instanceof Error ? e.message : t('Envoi impossible') })
    } finally {
      setEnvoi(null)
    }
  }

  return (
    <div className="mt-5">
      {!ouvert ? (
        <button type="button" onClick={() => { setOuvert(true); setEtat(null) }} className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white shadow-sm hover:opacity-90" style={{ background: '#D4537E' }}>
          ✎ {t('Proposer une idée ou des photos')}
        </button>
      ) : (
        <div className="bg-white/90 rounded-2xl border border-white p-5 max-w-3xl shadow-sm">
          <h3 className="text-base font-bold text-[#72243E] mb-3">{t('Proposer une idée ou des photos')}</h3>
          <label className="block mb-3">
            <span className="block text-xs font-semibold text-gray-700 mb-1">{t('Titre de votre proposition')}</span>
            <input className={champ} value={sujet} maxLength={200} onChange={e => setSujet(e.target.value)} placeholder={t('Ex. : Photos de la fête de l’équipe')} />
          </label>
          <label className="block mb-3">
            <span className="block text-xs font-semibold text-gray-700 mb-1">{t('Votre idée (facultatif)')}</span>
            <textarea className={champ} rows={4} maxLength={5000} value={message} onChange={e => setMessage(e.target.value)} />
          </label>
          <div className="mb-3">
            <span className="block text-xs font-semibold text-gray-700 mb-1">{t('Fichiers (facultatif)')}</span>
            <button type="button" onClick={() => entree.current?.click()} disabled={!!envoi} className="text-sm font-medium px-3 py-2 rounded-lg border border-[#D4537E] text-[#72243E] hover:bg-[#FBEAF0] disabled:opacity-50">⬆ {t('Ajouter des fichiers')}</button>
            <span className="text-xs text-gray-500 ml-2">{t('PDF, JPEG ou PNG — 20 Mo max par fichier, 10 fichiers max')}</span>
            <input ref={entree} type="file" multiple accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { ajouter(e.target.files); e.target.value = '' }} />
            {fichiers.length > 0 && (
              <ul className="mt-2 space-y-1">
                {fichiers.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{f.type === 'application/pdf' ? '📄' : '🖼'}</span>
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400">{taille(f.size)}</span>
                    <button type="button" disabled={!!envoi} onClick={() => setFichiers(l => l.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">{t('Retirer')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">{t('Si des collègues apparaissent sur vos photos, assurez-vous qu’ils sont d’accord pour qu’elles soient publiées.')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!!envoi} onClick={envoyer} className="text-sm font-semibold px-5 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: '#D4537E' }}>{envoi ?? t('Envoyer ma proposition')}</button>
            <button type="button" disabled={!!envoi} onClick={() => setOuvert(false)} className="text-sm text-gray-600 hover:underline">{t('Annuler')}</button>
          </div>
        </div>
      )}
      {etat && <div className={'mt-3 rounded-lg px-4 py-3 text-sm max-w-3xl ' + (etat.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{etat.texte}</div>}
      {mesPropositions.length > 0 && (
        <div className="mt-5 max-w-3xl">
          <p className="text-xs font-bold tracking-wider text-[#72243E] mb-2">{t('MES PROPOSITIONS')}</p>
          <ul className="space-y-1.5">
            {mesPropositions.map(p => {
              const s = STATUTS_PROPOSITION[p.statut] ?? STATUTS_PROPOSITION.nouvelle
              return (
                <li key={p.id} className="flex items-center gap-3 text-sm bg-white/70 rounded-lg px-3 py-2">
                  <span className="flex-1 truncate text-gray-800">{p.sujet}{p.nbFichiers ? ` · ${t('{n} fichier(s)', { n: p.nbFichiers })}` : ''}</span>
                  <span className="text-xs text-gray-500">{new Date(p.cree_le).toLocaleDateString(loc, { dateStyle: 'medium' })}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{p.statut === 'nouvelle' ? t('Envoyée') : t(s.libelle)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
