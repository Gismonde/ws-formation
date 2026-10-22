'use client'
// Création / modification d'un événement en présentiel.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import ChampsCiblage, { Ciblage, EmployeOption, corpsCiblage, ciblageVide } from '@/components/politiques/ChampsCiblage'
import type { CliniqueEmploye } from '@/lib/cliniques'

export type OptionsEvenement = {
  cliniques: CliniqueEmploye[]
  departements: { id: string; nom: string }[]
  postes: string[]
  familles: { famille: string; postes: string[] }[]
  employes: EmployeOption[]
  formations: { id: string; titre: string }[]
}

export type ValeursEvenement = {
  titre: string; description: string; image: string; lieu: string; responsable: string
  obligatoire: boolean; desinscription_heures: number; formation_id: string; duree_minutes: string
  ciblage: Ciblage
}

type SeanceForm = { date: string; debut: string; fin: string; places: string; lieu: string }

/** Date locale (Montréal) → ISO. Le navigateur est dans le fuseau de la personne. */
const iso = (date: string, heure: string) => new Date(`${date}T${heure}`).toISOString()

export default function FormulaireEvenement({ options, initial, evenementId }: { options: OptionsEvenement; initial?: ValeursEvenement; evenementId?: string }) {
  const { t } = useT()
  const router = useRouter()
  const [v, setV] = useState<ValeursEvenement>(initial ?? {
    titre: '', description: '', image: '', lieu: '', responsable: '', obligatoire: false, desinscription_heures: 24, formation_id: '', duree_minutes: '',
    ciblage: { clinique: options.cliniques[0], tous: true, departements: [], employes: [], roles: [], postes: [] },
  })
  const [seances, setSeances] = useState<SeanceForm[]>(evenementId ? [] : [{ date: '', debut: '09:00', fin: '12:00', places: '12', lieu: '' }])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [image, setImage] = useState<'repos' | 'envoi'>('repos')
  const set = (p: Partial<ValeursEvenement>) => setV(x => ({ ...x, ...p }))
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const label = 'block text-sm font-medium text-gray-700 mb-1'

  async function televerser(f: File | undefined) {
    if (!f) return
    setImage('envoi'); setErreur(null)
    const fd = new FormData(); fd.append('file', f)
    const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setImage('repos')
    if (d.url) set({ image: d.url }); else setErreur(d.error ?? t('Envoi de l’image impossible'))
  }

  async function enregistrer() {
    setErreur(null)
    if (!v.titre.trim()) return setErreur(t('Le titre est obligatoire.'))
    if (ciblageVide(v.ciblage)) return setErreur(t('Choisissez au moins un critère pour le public ciblé.'))
    const seancesValides = seances.filter(s => s.date)
    if (!evenementId && seancesValides.length === 0) return setErreur(t('Ajoutez au moins une date.'))
    setEnvoi(true)
    const corps = {
      titre: v.titre, description: v.description, image: v.image || null, lieu: v.lieu, responsable: v.responsable,
      obligatoire: v.obligatoire, desinscription_heures: v.desinscription_heures, formation_id: v.formation_id || null,
      duree_minutes: v.duree_minutes ? Number(v.duree_minutes) : null, ...corpsCiblage(v.ciblage),
      seances: seancesValides.map(s => ({ debut: iso(s.date, s.debut), fin: iso(s.date, s.fin), places: Number(s.places), lieu: s.lieu || null })),
    }
    const r = evenementId
      ? await fetch(`/api/admin/evenements/${evenementId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'modifier', ...corps }) })
      : await fetch('/api/admin/evenements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) return setErreur(d.error ?? t('Erreur'))
    router.push(`/admin/evenements/${evenementId ?? d.id}`)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      {erreur && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erreur}</div>}
      <div>
        <label className={label}>{t('Titre *')}</label>
        <input className={input} value={v.titre} onChange={e => set({ titre: e.target.value })} maxLength={200} placeholder={t('Ex. : Formation RCR — mise à jour annuelle')} />
      </div>
      <div>
        <label className={label}>{t('Image')}</label>
        <div className="flex items-center gap-3">
          {v.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.image} alt="" className="h-20 w-32 object-cover rounded-lg border border-gray-200" />}
          <label className="text-sm px-3 py-2 rounded-lg border border-gray-300 cursor-pointer hover:bg-gray-50">
            {image === 'envoi' ? t('Envoi…') : v.image ? t('Changer l’image') : t('+ Ajouter une image')}
            <input type="file" accept="image/*" className="hidden" onChange={e => { televerser(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {v.image && <button type="button" onClick={() => set({ image: '' })} className="text-xs text-gray-500 hover:underline">{t('Retirer')}</button>}
        </div>
      </div>
      <div>
        <label className={label}>{t('Description')}</label>
        <textarea className={input} rows={5} value={v.description} onChange={e => set({ description: e.target.value })} maxLength={5000} placeholder={t('Objectifs, déroulement, ce qu’il faut apporter…')} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t('Lieu')}</label>
          <input className={input} value={v.lieu} onChange={e => set({ lieu: e.target.value })} placeholder={t('Ex. : Salle de conférence, 2e étage')} />
        </div>
        <div>
          <label className={label}>{t('Formateur ou responsable')}</label>
          <input className={input} value={v.responsable} onChange={e => set({ responsable: e.target.value })} />
        </div>
      </div>

      {!evenementId && (
        <div>
          <label className={label}>{t('Dates (séances) *')}</label>
          <div className="space-y-2">
            {seances.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div><span className="block text-xs text-gray-500">{t('Date')}</span><input type="date" className={input} value={s.date} onChange={e => setSeances(ss => ss.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></div>
                <div><span className="block text-xs text-gray-500">{t('Début')}</span><input type="time" className={input} value={s.debut} onChange={e => setSeances(ss => ss.map((x, j) => (j === i ? { ...x, debut: e.target.value } : x)))} /></div>
                <div><span className="block text-xs text-gray-500">{t('Fin')}</span><input type="time" className={input} value={s.fin} onChange={e => setSeances(ss => ss.map((x, j) => (j === i ? { ...x, fin: e.target.value } : x)))} /></div>
                <div className="w-24"><span className="block text-xs text-gray-500">{t('Places')}</span><input type="number" min={1} className={input} value={s.places} onChange={e => setSeances(ss => ss.map((x, j) => (j === i ? { ...x, places: e.target.value } : x)))} /></div>
                <div className="flex-1 min-w-[160px]"><span className="block text-xs text-gray-500">{t('Lieu (si différent)')}</span><input className={input} value={s.lieu} onChange={e => setSeances(ss => ss.map((x, j) => (j === i ? { ...x, lieu: e.target.value } : x)))} /></div>
                {seances.length > 1 && <button type="button" onClick={() => setSeances(ss => ss.filter((_, j) => j !== i))} className="text-sm text-gray-400 hover:text-red-600 pb-2" aria-label={t('Retirer')}>✕</button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSeances(ss => [...ss, { ...(ss[ss.length - 1] ?? { debut: '09:00', fin: '12:00', places: '12', lieu: '' }), date: '' }])} className="mt-2 text-sm font-medium text-indigo-600 hover:underline">{t('+ Ajouter une date')}</button>
        </div>
      )}

      <ChampsCiblage valeur={v.ciblage} onChange={c => set({ ciblage: c })} cliniques={options.cliniques} departements={options.departements} postes={options.postes} familles={options.familles} employes={options.employes} />

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={v.obligatoire} onChange={e => set({ obligatoire: e.target.checked })} />
          <span className="text-sm"><strong>{t('Formation obligatoire')}</strong><span className="block text-xs text-gray-500">{t('Les personnes non inscrites reçoivent une relance 7 et 3 jours avant la dernière date.')}</span></span>
        </label>
        <div>
          <label className={label}>{t('Désinscription possible jusqu’à')}</label>
          <select className={input} value={v.desinscription_heures} onChange={e => set({ desinscription_heures: Number(e.target.value) })}>
            {[0, 2, 12, 24, 48, 72, 168].map(h => <option key={h} value={h}>{h === 0 ? t('Le début de la séance') : h === 168 ? t('1 semaine avant') : t('{n} h avant', { n: h })}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t('Compte comme la formation (facultatif)')}</label>
          <select className={input} value={v.formation_id} onChange={e => set({ formation_id: e.target.value })}>
            <option value="">{t('— Aucune —')}</option>
            {options.formations.map(f => <option key={f.id} value={f.id}>{f.titre}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('Les personnes marquées présentes reçoivent cette formation comme terminée, avec son certificat. Le sondage de satisfaction leur est envoyé après la séance.')}</p>
        </div>
        <div>
          <label className={label}>{t('Durée de formation (minutes)')}</label>
          <input type="number" min={0} className={input} value={v.duree_minutes} onChange={e => set({ duree_minutes: e.target.value })} placeholder={t('Ex. : 180')} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={enregistrer} disabled={envoi || image === 'envoi'} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
          {envoi ? t('Enregistrement…') : evenementId ? t('Enregistrer les modifications') : t('Créer le brouillon')}
        </button>
        <a href={evenementId ? `/admin/evenements/${evenementId}` : '/admin/evenements'} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t('Annuler')}</a>
      </div>
      {!evenementId && <p className="text-xs text-gray-500">{t('L’événement est créé en brouillon : vous pourrez vérifier puis le publier. Les personnes ciblées seront alors prévenues par courriel.')}</p>}
    </div>
  )
}
