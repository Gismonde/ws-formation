'use client'

// Rendu des champs d'un formulaire à remplir.
// partie = 'employe' : champs de l'employé (les sections réservées sont masquées)
// partie = 'reserve' : seulement les sections réservées (personne qui reçoit)
import { useT } from '@/lib/i18n/client'
import { champsAvecReserve, CLE_AUTRE, type Champ, type Reponses } from '@/lib/formulaires'
import { TexteRiche } from '@/lib/texte-riche'

const champCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50'

export default function ChampsFormulaire({ champs, valeurs, onChange, partie, desactive = false, accent = '#4f46e5' }: {
  champs: Champ[]
  valeurs: Reponses
  onChange: (v: Reponses) => void
  partie: 'employe' | 'reserve'
  desactive?: boolean
  accent?: string
}) {
  const { t } = useT()
  const maj = (cle: string, v: unknown) => onChange({ ...valeurs, [cle]: v })
  const visibles = champsAvecReserve(champs).filter(c => c.estReserve === (partie === 'reserve'))

  // Regroupe les champs par section (cartes)
  const groupes: { section: Champ | null; champs: Champ[] }[] = []
  for (const c of visibles) {
    if (c.type === 'section' || !groupes.length) groupes.push({ section: c.type === 'section' ? c : null, champs: [] })
    if (c.type !== 'section') groupes[groupes.length - 1].champs.push(c)
  }

  const rendre = (c: Champ) => {
    const v = valeurs[c.id]
    const id = 'ch-' + c.id
    const libelle = c.type === 'info' ? null : (
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
        {c.libelle}{c.obligatoire && <span className="ml-0.5 text-red-600" aria-label={t('obligatoire')}>*</span>}
      </label>
    )
    const aide = c.aide && c.type !== 'info' ? <p className="mt-1 text-xs leading-relaxed text-gray-500">{c.aide}</p> : null
    let saisie: React.ReactNode = null
    switch (c.type) {
      case 'info':
        saisie = (
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {c.libelle && <p className="mb-1 font-semibold">ℹ️ {c.libelle}</p>}
            {c.aide && <div className="leading-relaxed [&_p]:my-1"><TexteRiche texte={c.aide} /></div>}
          </div>
        )
        break
      case 'texte': case 'courriel': case 'telephone': case 'nombre':
        saisie = <input id={id} className={champCls} disabled={desactive} value={String(v ?? '')} onChange={e => maj(c.id, e.target.value)} required={c.obligatoire}
          type={c.type === 'courriel' ? 'email' : c.type === 'telephone' ? 'tel' : 'text'} inputMode={c.type === 'nombre' ? 'decimal' : undefined} maxLength={300} />
        break
      case 'texte_long':
        saisie = <textarea id={id} className={champCls + ' min-h-[110px] leading-relaxed'} disabled={desactive} value={String(v ?? '')} onChange={e => maj(c.id, e.target.value)} required={c.obligatoire} maxLength={8000} />
        break
      case 'date': case 'heure': case 'date_heure':
        saisie = <input id={id} className={champCls + ' max-w-xs'} disabled={desactive} value={String(v ?? '')} onChange={e => maj(c.id, e.target.value)} required={c.obligatoire}
          type={c.type === 'date' ? 'date' : c.type === 'heure' ? 'time' : 'datetime-local'} />
        break
      case 'liste':
        saisie = (
          <select id={id} className={champCls} disabled={desactive} value={String(v ?? '')} onChange={e => maj(c.id, e.target.value)} required={c.obligatoire}>
            <option value="">{t('— Choisir —')}</option>
            {(c.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            {c.autre && <option value="__autre__">{t('Autre')}</option>}
          </select>
        )
        break
      case 'choix_unique': case 'choix_multiple': {
        const multiple = c.type === 'choix_multiple'
        const liste = multiple ? (Array.isArray(v) ? v as string[] : []) : []
        const coche = (o: string) => multiple ? liste.includes(o) : v === o
        const basculer = (o: string) => multiple
          ? maj(c.id, coche(o) ? liste.filter(x => x !== o) : [...liste, o])
          : maj(c.id, v === o ? '' : o)
        const options = [...(c.options ?? []), ...(c.autre ? ['__autre__'] : [])]
        saisie = (
          <div role={multiple ? 'group' : 'radiogroup'} aria-labelledby={id} className={'grid gap-x-4 gap-y-1.5 ' + (options.length > 6 ? 'sm:grid-cols-2' : '')}>
            {options.map(o => (
              <label key={o} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 text-sm text-gray-800 hover:bg-gray-50">
                <input type={multiple ? 'checkbox' : 'radio'} name={id} disabled={desactive} checked={coche(o)} onChange={() => basculer(o)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ accentColor: accent }} />
                <span>{o === '__autre__' ? t('Autre :') : o}</span>
              </label>
            ))}
          </div>
        )
        break
      }
      case 'case':
        saisie = (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
            <input id={id} type="checkbox" disabled={desactive} checked={v === true} onChange={e => maj(c.id, e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: accent }} />
            <span>{c.aide || t('Oui')}</span>
          </label>
        )
        break
      case 'tableau': {
        const cols = c.colonnes ?? []
        const fixes = c.lignes ?? []
        const lignes: string[][] = Array.isArray(v) ? v as string[][] : fixes.length ? fixes.map(() => cols.map(() => '')) : [cols.map(() => '')]
        const setCellule = (i: number, k: number, val: string) => {
          const copie = lignes.map(l => [...l])
          while (copie.length <= i) copie.push(cols.map(() => ''))
          copie[i][k] = val
          maj(c.id, copie)
        }
        const typeCol = (nom: string) => /^date$/i.test(nom.trim()) ? 'date' : /^heure$/i.test(nom.trim()) ? 'time' : 'text'
        saisie = (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {fixes.length > 0 && <th className="border-b border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-500" />}
                  {cols.map(col => <th key={col} className="border-b border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-500">{col}</th>)}
                  {!fixes.length && <th className="w-8 border-b border-gray-200" />}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    {fixes.length > 0 && <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-sm font-medium text-gray-700">{fixes[i]}</td>}
                    {cols.map((col, k) => (
                      <td key={k} className="border-b border-gray-100 px-1 py-1">
                        <input aria-label={`${fixes[i] ?? t('Ligne {n}', { n: i + 1 })} — ${col}`} className={champCls + ' py-1.5'} disabled={desactive} type={typeCol(col)} value={l[k] ?? ''} onChange={e => setCellule(i, k, e.target.value)} />
                      </td>
                    ))}
                    {!fixes.length && (
                      <td className="border-b border-gray-100 text-center">
                        {lignes.length > 1 && !desactive && <button type="button" onClick={() => maj(c.id, lignes.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label={t('Retirer la ligne')}>✕</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!fixes.length && !desactive && lignes.length < 30 && (
              <button type="button" onClick={() => maj(c.id, [...lignes, cols.map(() => '')])} className="mt-2 text-xs font-semibold hover:underline" style={{ color: accent }}>+ {t('Ajouter une ligne')}</button>
            )}
          </div>
        )
        break
      }
      case 'signature': {
        const s = (v && typeof v === 'object' ? v : {}) as { nom?: string }
        saisie = (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
            <input id={id} className={champCls + ' font-[cursive] text-base'} disabled={desactive} placeholder={t('Tapez votre nom complet pour signer')} value={s.nom ?? ''} onChange={e => maj(c.id, { nom: e.target.value })} required={c.obligatoire} maxLength={200} />
            <p className="mt-1.5 text-[11px] text-gray-500">{t('En tapant votre nom, vous signez électroniquement ce formulaire. La date et l’heure sont ajoutées à l’envoi.')}</p>
          </div>
        )
        break
      }
    }
    const autreChoisi = c.autre && (c.type === 'choix_multiple' ? Array.isArray(v) && (v as string[]).includes('__autre__') : v === '__autre__')
    return (
      <div key={c.id} className={c.demi ? 'sm:col-span-1' : 'sm:col-span-2'}>
        {libelle}
        {saisie}
        {autreChoisi && (
          <input aria-label={t('Précisez « Autre »')} className={champCls + ' mt-2'} disabled={desactive} placeholder={t('Précisez…')} value={String(valeurs[CLE_AUTRE(c.id)] ?? '')} onChange={e => maj(CLE_AUTRE(c.id), e.target.value)} maxLength={300} />
        )}
        {aide}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groupes.map((g, i) => (
        <section key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {g.section && (
            <header className="px-5 py-3 text-white" style={{ background: partie === 'reserve' ? '#374151' : accent }}>
              <h2 className="text-sm font-bold uppercase tracking-wide">{g.section.libelle}</h2>
              {g.section.aide && <p className="mt-0.5 text-xs text-white/85">{g.section.aide}</p>}
            </header>
          )}
          <div className="grid gap-5 p-5 sm:grid-cols-2">{g.champs.map(rendre)}</div>
        </section>
      ))}
    </div>
  )
}
