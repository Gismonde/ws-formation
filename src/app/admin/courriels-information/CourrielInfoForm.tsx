'use client'
// Formulaire du courriel d'information : destinataires, message, aperçu, test, envoi immédiat ou programmé.
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

type Choix = { id: string; nom: string }
type EmployeChoix = Choix & { poste: string }
type Mode = 'cliniques' | 'departements' | 'postes' | 'employes'
import type { CibleInfo } from '@/lib/courriels-information'
export type Initial = { id?: string; objet: string; contenu: string; bouton_libelle: string; bouton_lien: string; cible: CibleInfo } | null

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CourrielInfoForm({ initial, cliniques, departements, postes, employes }: { initial: Initial; cliniques: ('WSSC' | 'CMC')[]; departements: Choix[]; postes: string[]; employes: EmployeChoix[] }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const c0 = initial?.cible
  const [mode, setMode] = useState<Mode>(c0?.type ?? 'cliniques')
  const [selCliniques, setSelCliniques] = useState<('WSSC' | 'CMC')[]>(c0?.type === 'cliniques' ? c0.cliniques : (cliniques.length === 1 ? cliniques : []))
  const [selDeps, setSelDeps] = useState<string[]>(c0?.type === 'departements' ? c0.ids : [])
  const [selPostes, setSelPostes] = useState<string[]>(c0?.type === 'postes' ? c0.postes : [])
  const [selEmps, setSelEmps] = useState<string[]>(c0?.type === 'employes' ? c0.ids : [])
  const idBrouillon = initial?.id ?? null
  const [recherche, setRecherche] = useState('')
  const [objet, setObjet] = useState(initial?.objet ?? '')
  const [contenu, setContenu] = useState(initial?.contenu ?? '')
  const [bouton, setBouton] = useState({ libelle: initial?.bouton_libelle ?? '', lien: initial?.bouton_lien ?? '' })
  const [programmer, setProgrammer] = useState(false)
  const [quand, setQuand] = useState('')
  const [compte, setCompte] = useState<{ destinataires: number; nonActives: number } | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const zone = useRef<HTMLTextAreaElement>(null)
  const fichierImage = useRef<HTMLInputElement>(null)
  /** Insère une image (téléversée, adresse publique) à l'endroit du curseur, sur sa propre ligne */
  async function ajouterImage(f: File) {
    await action(async () => {
      const fd = new FormData(); fd.append('file', f)
      const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error ?? t('Envoi impossible'))
      const pos = zone.current?.selectionStart ?? contenu.length
      const ligne = `![${f.name.replace(/\.[a-z]+$/i, '')}](${d.url})`
      setContenu(c => (c.slice(0, pos).replace(/\s*$/, '') + '\n' + ligne + '\n' + c.slice(pos).replace(/^\s*/, '')).trim())
    })
  }

  const cible = useMemo(() => (
    mode === 'cliniques' ? { type: 'cliniques', cliniques: selCliniques }
      : mode === 'departements' ? { type: 'departements', ids: selDeps }
      : mode === 'postes' ? { type: 'postes', postes: selPostes }
      : { type: 'employes', ids: selEmps }
  ), [mode, selCliniques, selDeps, selPostes, selEmps])
  const corps = (action: string) => JSON.stringify({
    action, id: idBrouillon, objet, contenu, bouton_libelle: bouton.libelle, bouton_lien: bouton.lien, cible,
    envoi_prevu: programmer && quand ? new Date(quand).toISOString() : null,
  })
  const appeler = async (action: string) => {
    const r = await fetch('/api/admin/courriels-information', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps(action) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error ?? t('Erreur'))
    return d
  }
  const action = async (f: () => Promise<void>) => { setOccupe(true); setMessage(null); try { await f() } catch (e) { setMessage({ ok: false, texte: e instanceof Error ? e.message : t('Erreur') }) } finally { setOccupe(false) } }
  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v])
  const filtres = employes.filter(e => !selEmps.includes(e.id) && recherche.trim().length >= 2 && `${e.nom} ${e.poste}`.toLowerCase().includes(recherche.trim().toLowerCase())).slice(0, 8)

  async function envoyer() {
    await action(async () => {
      const c = await appeler('compter')
      setCompte(c)
      const quandTexte = programmer && quand ? new Date(quand).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' }) : null
      const ok = await confirmer({
        message: (quandTexte ? t('Programmer l’envoi du {date} à {n} destinataire(s) ?', { date: quandTexte, n: c.destinataires }) : t('Envoyer maintenant à {n} destinataire(s) ?', { n: c.destinataires }))
          + (c.nonActives ? ' ' + t('{n} compte(s) pas encore activé(s) ne recevront rien.', { n: c.nonActives }) : ''),
        bouton: quandTexte ? t('Programmer') : t('Envoyer'),
      })
      if (!ok) return
      const d = await appeler('envoyer')
      setMessage({ ok: true, texte: d.programme ? t('Courriel programmé. Il partira à l’heure prévue.') : t('Courriel envoyé : {n} sur {total} destinataire(s).', { n: d.envoyes, total: d.destinataires }) })
      if (idBrouillon) router.push('/admin/courriels-information')
      router.refresh()
    })
  }

  const Onglet = ({ m, libelle }: { m: Mode; libelle: string }) => (
    <button type="button" onClick={() => { setMode(m); setCompte(null) }} className={'text-sm px-3 py-1.5 rounded-lg border ' + (mode === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{libelle}</button>
  )

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">{t('1. Destinataires')}</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <Onglet m="cliniques" libelle={t('Tous les employés')} />
          <Onglet m="departements" libelle={t('Départements')} />
          <Onglet m="postes" libelle={t('Postes')} />
          <Onglet m="employes" libelle={t('Employés choisis')} />
        </div>
        {mode === 'cliniques' && (
          <div className="flex flex-wrap gap-4">
            {cliniques.map(c => (
              <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selCliniques.includes(c)} onChange={() => { setSelCliniques(l => basculer(l, c)); setCompte(null) }} />{t('Tous les employés du {clinique}', { clinique: c })}</label>
            ))}
          </div>
        )}
        {mode === 'departements' && (
          <div className="flex flex-wrap gap-2">{departements.map(d => (
            <button key={d.id} type="button" onClick={() => { setSelDeps(l => basculer(l, d.id)); setCompte(null) }} className={'text-xs px-3 py-1.5 rounded-full border ' + (selDeps.includes(d.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}>{d.nom}</button>
          ))}</div>
        )}
        {mode === 'postes' && (
          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">{postes.map(p => (
            <button key={p} type="button" onClick={() => { setSelPostes(l => basculer(l, p)); setCompte(null) }} className={'text-xs px-3 py-1.5 rounded-full border ' + (selPostes.includes(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}>{p}</button>
          ))}</div>
        )}
        {mode === 'employes' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">{selEmps.map(id => (
              <span key={id} className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 flex items-center gap-1">{employes.find(e => e.id === id)?.nom}
                <button type="button" aria-label={t('Retirer')} onClick={() => { setSelEmps(l => l.filter(x => x !== id)); setCompte(null) }} className="ml-1">✕</button></span>
            ))}</div>
            <input className={champ} placeholder={t('Rechercher un employé (2 lettres minimum)')} value={recherche} onChange={e => setRecherche(e.target.value)} />
            {filtres.length > 0 && <div className="border border-gray-200 rounded-lg mt-1 divide-y">{filtres.map(e => (
              <button key={e.id} type="button" onClick={() => { setSelEmps(l => [...l, e.id]); setRecherche(''); setCompte(null) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{e.nom}<span className="text-xs text-gray-400"> — {e.poste}</span></button>
            ))}</div>}
          </div>
        )}
        <div className="flex items-center gap-3 mt-4">
          <button type="button" disabled={occupe} onClick={() => action(async () => setCompte(await appeler('compter')))} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('Compter les destinataires')}</button>
          {compte && <span className="text-sm text-gray-700"><b>{compte.destinataires}</b> {t('destinataire(s)')}{compte.nonActives ? ` · ${t('{n} compte(s) pas encore activé(s) ne recevront rien', { n: compte.nonActives })}` : ''}</span>}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">{t('2. Message')}</h2>
        <input className={champ} placeholder={t('Objet du courriel')} value={objet} maxLength={200} onChange={e => setObjet(e.target.value)} />
        <div>
          <textarea ref={zone} className={champ} rows={12} value={contenu} onChange={e => setContenu(e.target.value)} placeholder={t('Votre message… Chaque ligne devient un paragraphe.')} />
          <div className="flex items-center gap-3 mt-1">
            <button type="button" disabled={occupe} onClick={() => fichierImage.current?.click()} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{t('🖼 Ajouter une image')}</button>
            <span className="text-xs text-gray-500">{t('L’image est insérée à l’endroit du curseur (JPG, PNG ou WebP, 10 Mo max). Visible dans l’aperçu.')}</span>
            <input ref={fichierImage} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const fi = e.target.files?.[0]; if (fi) ajouterImage(fi); e.target.value = '' }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('« Bonjour Prénom, » est ajouté automatiquement. Une ligne qui commence par « • » ou « - » devient une puce ; **texte** s’affiche en gras.')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={champ} placeholder={t('Bouton (facultatif) : ex. Découvrir les nouveautés')} value={bouton.libelle} maxLength={60} onChange={e => setBouton(b => ({ ...b, libelle: e.target.value }))} />
          <input className={champ} placeholder={t('Lien du bouton : /dashboard/passerelle ou https://…')} value={bouton.lien} onChange={e => setBouton(b => ({ ...b, lien: e.target.value }))} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">{t('3. Envoi')}</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={programmer} onChange={e => setProgrammer(e.target.checked)} />{t('Programmer l’envoi')}</label>
        {programmer && <input type="datetime-local" className={champ + ' max-w-xs'} value={quand} onChange={e => setQuand(e.target.value)} />}
        {programmer && <p className="text-xs text-gray-500">{t('Le courriel part à l’heure prévue, dès que quelqu’un utilise la plateforme (en général dans les minutes qui suivent) et au plus tard le lendemain matin.')}</p>}
        {message && <div className={'rounded-lg px-4 py-3 text-sm ' + (message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{message.texte}</div>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={occupe} onClick={() => action(async () => {
            const d = await appeler('brouillon')
            setMessage({ ok: true, texte: t('Brouillon enregistré. Rien n’a été envoyé.') })
            if (!idBrouillon) router.push(`/admin/courriels-information?brouillon=${d.brouillon}`)
            router.refresh()
          })} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{idBrouillon ? t('Enregistrer le brouillon') : t('Enregistrer en brouillon')}</button>
          <button type="button" disabled={occupe} onClick={() => action(async () => setApercu((await appeler('apercu')).html))} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('Aperçu')}</button>
          <button type="button" disabled={occupe} onClick={() => action(async () => { const d = await appeler('test'); setMessage({ ok: true, texte: t('Test envoyé à {a}.', { a: d.a }) }) })} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('M’envoyer un test')}</button>
          <button type="button" disabled={occupe || (programmer && !quand)} onClick={envoyer} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{programmer ? t('Programmer l’envoi') : t('Envoyer maintenant')}</button>
        </div>
      </section>

      {apercu && (
        <section className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex justify-between items-center px-2 pb-2"><span className="text-sm font-semibold text-gray-800">{t('Aperçu')}</span><button type="button" onClick={() => setApercu(null)} className="text-xs text-gray-500">✕</button></div>
          <iframe title={t('Aperçu')} srcDoc={apercu} className="w-full rounded-lg border border-gray-100" style={{ height: 640 }} sandbox="" />
        </section>
      )}
    </div>
  )
}

/** Annuler un envoi programmé (historique) */
export function AnnulerEnvoi({ id, brouillon = false }: { id: string; brouillon?: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  return (
    <button type="button" className="text-xs text-red-600 hover:underline" onClick={async () => {
      if (!(await confirmer(brouillon
        ? { message: t('Supprimer ce brouillon ? Il ne pourra pas être récupéré.'), bouton: t('Supprimer') }
        : { message: t('Annuler cet envoi programmé ? Le courriel ne partira pas.'), bouton: t('Annuler l’envoi') }))) return
      await fetch(`/api/admin/courriels-information/${id}`, { method: 'DELETE' })
      if (brouillon) router.push('/admin/courriels-information')
      router.refresh()
    }}>{brouillon ? t('Supprimer') : t('Annuler l’envoi')}</button>
  )
}
