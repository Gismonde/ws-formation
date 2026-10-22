'use client'
import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

type Poste = { id: string; nom: string; famille: string; actif: boolean; employes: number }
type HorsListe = { poste: string; employes: number; suggestion: string | null }

export default function GestionPostes() {
  const { t } = useT()
  const [postes, setPostes] = useState<Poste[] | null>(null)
  const [horsListe, setHorsListe] = useState<HorsListe[]>([])
  const [choix, setChoix] = useState<Record<string, string>>({})
  const [nouveau, setNouveau] = useState({ nom: '', famille: '' })
  const [edition, setEdition] = useState<{ id: string; nom: string; famille: string } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    const r = await fetch('/api/admin/postes'); const d = await r.json()
    setPostes(d.postes ?? []); setHorsListe(d.horsListe ?? [])
    setChoix(Object.fromEntries((d.horsListe ?? []).map((h: HorsListe) => [h.poste, h.suggestion ?? ''])))
  }, [])
  useEffect(() => { charger() }, [charger])

  async function agir(corps: Record<string, unknown>, succes: string) {
    setEnvoi(true); setMsg(null)
    const r = await fetch('/api/admin/postes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return false }
    setMsg({ ok: true, texte: succes }); await charger(); return true
  }

  if (!postes) return <p className="text-sm text-gray-400">{t('Chargement…')}</p>
  const familles = Array.from(new Set(postes.map(p => p.famille)))
  const actifs = postes.filter(p => p.actif)
  const carte = 'bg-white border border-gray-200 rounded-2xl p-5'
  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      {msg && <p className={'text-sm ' + (msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.texte}</p>}

      {horsListe.length > 0 && (
        <section className={carte + ' border-amber-200'}>
          <h2 className="font-semibold text-gray-900">{t('Postes à harmoniser')} <span className="text-sm font-normal text-gray-400">({horsListe.length})</span></h2>
          <p className="text-sm text-gray-500 mt-1 mb-3">{t('Ces postes ont été saisis à la main et ne font pas partie de la liste. Choisissez le poste officiel correspondant, puis appliquez : les fiches des employés concernés seront mises à jour.')}</p>
          <ul className="divide-y divide-gray-100">
            {horsListe.map(h => (
              <li key={h.poste} className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] flex-1">
                  <span className="font-medium text-gray-900">« {h.poste} »</span>
                  <span className="block text-xs text-gray-500">{t('{n} employé(s)', { n: h.employes })}</span>
                </div>
                <span className="text-gray-400">→</span>
                <select value={choix[h.poste] ?? ''} onChange={e => setChoix({ ...choix, [h.poste]: e.target.value })} className={input + ' min-w-[220px]'}>
                  <option value="">{t('Choisir le poste officiel…')}</option>
                  {familles.map(f => (
                    <optgroup key={f} label={f}>
                      {actifs.filter(p => p.famille === f).map(p => <option key={p.id} value={p.nom}>{p.nom}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button type="button" disabled={envoi || !choix[h.poste]} onClick={() => agir({ action: 'correspondance', ancien: h.poste, nouveau: choix[h.poste] }, t('Postes mis à jour.'))}
                  className="text-sm font-semibold px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Appliquer')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={carte}>
        <h2 className="font-semibold text-gray-900 mb-3">{t('Ajouter un poste')}</h2>
        <div className="flex flex-wrap gap-2">
          <input value={nouveau.nom} onChange={e => setNouveau({ ...nouveau, nom: e.target.value })} placeholder={t('Ex. : Infirmière praticienne spécialisée')} className={input + ' flex-1 min-w-[200px]'} />
          <input value={nouveau.famille} onChange={e => setNouveau({ ...nouveau, famille: e.target.value })} list="familles-postes" placeholder={t('Famille')} className={input + ' min-w-[180px]'} />
          <datalist id="familles-postes">{familles.map(f => <option key={f} value={f} />)}</datalist>
          <button type="button" disabled={envoi || !nouveau.nom.trim() || !nouveau.famille.trim()}
            onClick={async () => { if (await agir({ action: 'ajouter', ...nouveau }, t('Poste ajouté.'))) setNouveau({ nom: '', famille: nouveau.famille }) }}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Ajouter')}</button>
        </div>
      </section>

      {familles.map(f => (
        <section key={f} className={carte}>
          <h2 className="font-semibold text-gray-900 mb-2">{f}</h2>
          <ul className="divide-y divide-gray-100">
            {postes.filter(p => p.famille === f).map(p => (
              <li key={p.id} className={'py-2 flex flex-wrap items-center gap-3 ' + (p.actif ? '' : 'opacity-50')}>
                {edition?.id === p.id ? (
                  <>
                    <input value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} className={input + ' flex-1 min-w-[180px]'} />
                    <input value={edition.famille} onChange={e => setEdition({ ...edition, famille: e.target.value })} list="familles-postes" className={input + ' min-w-[160px]'} />
                    <button type="button" disabled={envoi} onClick={async () => { if (await agir({ action: 'modifier', id: p.id, nom: edition.nom, famille: edition.famille }, t('Poste modifié.'))) setEdition(null) }} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white">{t('Enregistrer')}</button>
                    <button type="button" onClick={() => setEdition(null)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300">{t('Annuler')}</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{p.nom}{!p.actif && <span className="ml-2 text-xs text-gray-500">({t('retiré de la liste')})</span>}</span>
                    <span className="text-xs text-gray-400">{t('{n} employé(s)', { n: p.employes })}</span>
                    <button type="button" onClick={() => setEdition({ id: p.id, nom: p.nom, famille: p.famille })} className="text-xs text-indigo-600 hover:underline">{t('Modifier')}</button>
                    <button type="button" disabled={envoi} onClick={() => agir({ action: 'modifier', id: p.id, actif: !p.actif }, p.actif ? t('Poste retiré de la liste.') : t('Poste remis dans la liste.'))} className="text-xs text-gray-500 hover:underline">{p.actif ? t('Retirer') : t('Remettre')}</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-gray-500">{t('Renommer un poste met à jour les fiches des employés et le ciblage des politiques. Un poste retiré n’est plus proposé, mais les fiches existantes le gardent.')}</p>
    </div>
  )
}
