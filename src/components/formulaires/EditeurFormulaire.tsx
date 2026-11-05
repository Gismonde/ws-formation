'use client'

// Éditeur de formulaire (admin) : informations, texte d'aide pour l'employé, questions, destinataire, aperçu.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { TYPES_CHAMP, PREREMPLIS, MESSAGE_ANONYMAT_DEFAUT, type Champ, type TypeChamp, type Formulaire, type Reponses, type Destinataire } from '@/lib/formulaires'
import ChampsFormulaire from './ChampsFormulaire'
import { TexteRiche } from '@/lib/texte-riche'

type Personne = { id: string; prenom: string | null; nom: string | null; role: string; clinique: string | null; departement_id?: string | null }
type Departement = { id: string; nom: string; gestionnaires: number }
type Brouillon = Pick<Formulaire, 'titre' | 'code' | 'description' | 'instructions' | 'clinique' | 'champs' | 'actif'> & {
  destinataires: Destinataire[]; anonyme_permis: boolean; message_anonymat: string | null; image?: string | null
}

const nouvelId = () => 'c' + Math.random().toString(36).slice(2, 10)
const champCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500'
const AVEC_OPTIONS: TypeChamp[] = ['choix_unique', 'choix_multiple', 'liste']
const AVEC_PREREMPLI: TypeChamp[] = ['texte', 'courriel', 'date', 'heure']

export default function EditeurFormulaire({ id, initial, personnes, departements, createurNom }: {
  id: string | null
  initial: Brouillon
  personnes: Personne[]
  departements: Departement[]
  createurNom: string
}) {
  const { t } = useT()
  const router = useRouter()
  const [f, setF] = useState<Brouillon>(initial)
  const [onglet, setOnglet] = useState<'edition' | 'apercu'>('edition')
  const [ajoutA, setAjoutA] = useState<number | null>(null)
  const [etat, setEtat] = useState<{ type: 'ok' | 'erreur'; msg: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [apercuValeurs, setApercuValeurs] = useState<Reponses>({})
  const [envoiImage, setEnvoiImage] = useState(false)

  async function televerserImage(fichier: File | undefined) {
    if (!fichier) return
    setEnvoiImage(true); setEtat(null)
    const fd = new FormData(); fd.append('file', fichier)
    const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setEnvoiImage(false)
    if (d.url) maj({ image: d.url }); else setEtat({ type: 'erreur', msg: d.error ?? t('Envoi de l’image impossible') })
  }

  const maj = (p: Partial<Brouillon>) => { setF(x => ({ ...x, ...p })); setEtat(null) }
  const majChamp = (i: number, p: Partial<Champ>) => maj({ champs: f.champs.map((c, j) => j === i ? { ...c, ...p } : c) })
  const ajouter = (pos: number, type: TypeChamp) => {
    const c: Champ = { id: nouvelId(), type, libelle: type === 'info' ? '' : type === 'section' ? t('Nouvelle section') : '' }
    if (AVEC_OPTIONS.includes(type)) c.options = [t('Option 1'), t('Option 2')]
    if (type === 'tableau') c.colonnes = [t('Nom'), t('Date')]
    const l = [...f.champs]; l.splice(pos, 0, c)
    maj({ champs: l }); setAjoutA(null)
  }
  const deplacer = (i: number, d: -1 | 1) => { const l = [...f.champs]; const [c] = l.splice(i, 1); l.splice(i + d, 0, c); maj({ champs: l }) }

  const role = (r: string) => r === 'super_admin' ? t('admin global') : r === 'admin' ? t('admin') : t('gestionnaire')
  const nom = (p: Personne) => [p.prenom, p.nom].filter(Boolean).join(' ') + ` (${role(p.role)})`
  const [choixDest, setChoixDest] = useState('')
  const ajouterDest = (v: string) => {
    if (!v) return
    const [type, idd] = v.split(':') as [Destinataire['type'], string]
    if (!f.destinataires.some(d => d.type === type && d.id === idd)) maj({ destinataires: [...f.destinataires, { type, id: idd }] })
    setChoixDest('')
  }
  const libelleDest = (d: Destinataire) => {
    if (d.type === 'departement') { const x = departements.find(y => y.id === d.id); return x ? `🏢 ${t('Gestionnaire(s) du département {nom}', { nom: x.nom })}${x.gestionnaires ? '' : ' ⚠️'}` : '—' }
    const p = personnes.find(y => y.id === d.id); return p ? `👤 ${nom(p)}` : '—'
  }
  const restants = useMemo(() => ({
    depts: departements.filter(d => !f.destinataires.some(x => x.type === 'departement' && x.id === d.id)),
    pers: personnes.filter(p => !f.destinataires.some(x => x.type === 'employe' && x.id === p.id)),
  }), [departements, personnes, f.destinataires])

  async function enregistrer(actif = f.actif) {
    setEnvoi(true); setEtat(null)
    try {
      const corps = { ...f, actif }
      const res = await fetch(id ? `/api/admin/formulaires/${id}` : '/api/admin/formulaires', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const d = await res.json()
      if (!res.ok) { setEtat({ type: 'erreur', msg: d.error ?? t('Enregistrement impossible') }); return }
      setF(x => ({ ...x, actif }))
      setEtat({ type: 'ok', msg: actif ? t('Enregistré et publié : les employés peuvent le remplir.') : t('Enregistré (non publié).') })
      if (!id && d.id) router.replace(`/admin/formulaires/${d.id}`)
      else router.refresh()
    } catch { setEtat({ type: 'erreur', msg: t('Erreur réseau') }) }
    finally { setEnvoi(false) }
  }

  const MenuAjout = ({ pos }: { pos: number }) => ajoutA === pos ? (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-indigo-900">{t('Ajouter :')}</span><button type="button" onClick={() => setAjoutA(null)} className="text-xs text-gray-500">✕</button></div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {TYPES_CHAMP.map(tc => (
          <button key={tc.type} type="button" onClick={() => ajouter(pos, tc.type)} className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2 py-1.5 text-left text-xs font-medium text-gray-800 hover:border-indigo-400">
            <span aria-hidden>{tc.icone}</span>{t(tc.libelle)}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="flex justify-center"><button type="button" onClick={() => setAjoutA(pos)} className="rounded-full border border-dashed border-gray-300 px-3 py-0.5 text-xs font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-600">+ {t('Ajouter ici')}</button></div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/formulaires" className="text-sm text-gray-500 hover:text-gray-800">← {t('Formulaires')}</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{id ? t('Modifier le formulaire') : t('Nouveau formulaire')}</h1>
          <p className="text-xs text-gray-500">{t('Créé par {nom}', { nom: createurNom })}</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          {(['edition', 'apercu'] as const).map(o => (
            <button key={o} type="button" onClick={() => setOnglet(o)} className={'rounded-md px-3 py-1.5 font-semibold ' + (onglet === o ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
              {o === 'edition' ? `✏️ ${t('Édition')}` : `👁️ ${t('Aperçu employé')}`}
            </button>
          ))}
        </div>
      </div>

      {onglet === 'apercu' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">{t('Aperçu : ce que voit l’employé. Rien n’est envoyé.')}</div>
          <h2 className="text-xl font-bold text-gray-900">{f.titre || t('(Sans titre)')}</h2>
          {f.instructions && <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950"><p className="mb-1 font-semibold">💡 {t('Comment remplir ce formulaire')}</p><div className="[&_li]:my-0.5 [&_p]:my-1.5"><TexteRiche texte={f.instructions} /></div></div>}
          <ChampsFormulaire champs={f.champs} valeurs={apercuValeurs} onChange={setApercuValeurs} partie="employe" />
          {f.champs.some(c => c.type === 'section' && c.reserve) && (
            <>
              <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700">🔒 {t('Sections réservées — visibles seulement par la personne qui reçoit le formulaire :')}</div>
              <ChampsFormulaire champs={f.champs} valeurs={apercuValeurs} onChange={setApercuValeurs} partie="reserve" />
            </>
          )}
        </div>
      ) : (
        <>
          {/* Informations */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('Informations')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('Titre *')}</label>
                <input className={champCls} value={f.titre} onChange={e => maj({ titre: e.target.value })} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('Code / no de document')}</label>
                <input className={champCls} value={f.code ?? ''} onChange={e => maj({ code: e.target.value })} placeholder="FORM-…" maxLength={60} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('Description courte (liste des formulaires)')}</label>
              <input className={champCls} value={f.description ?? ''} onChange={e => maj({ description: e.target.value })} maxLength={1000} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">🖼️ {t('Photo du formulaire papier (vignette affichée aux employés)')}</label>
              <div className="flex items-center gap-4">
                {f.image
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.image} alt="" className="h-28 w-20 rounded-md border border-gray-200 object-cover object-top shadow-sm" />
                  : <div className="flex h-28 w-20 items-center justify-center rounded-md border border-dashed border-gray-300 text-2xl text-gray-300">📝</div>}
                <div className="space-y-1.5 text-sm">
                  <label className="inline-block cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
                    {envoiImage ? t('Envoi…') : f.image ? t('Changer l’image') : t('Choisir une image')}
                    <input type="file" accept="image/*" className="hidden" disabled={envoiImage} onChange={e => televerserImage(e.target.files?.[0])} />
                  </label>
                  {f.image && <button type="button" onClick={() => maj({ image: null })} className="block text-xs text-red-600 hover:underline">{t('Retirer l’image')}</button>}
                  <p className="text-xs text-gray-500">{t('Une photo ou une capture de la première page : les employés reconnaissent le formulaire au premier coup d’œil.')}</p>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">💡 {t('Texte d’aide pour l’employé : quoi et comment remplir')}</label>
              <textarea className={champCls + ' min-h-[140px] leading-relaxed'} value={f.instructions ?? ''} onChange={e => maj({ instructions: e.target.value })} maxLength={10000}
                placeholder={t('Ex. : Remplissez ce formulaire dès qu’un incident est constaté. Décrivez les faits sans jugement… (**gras**, « - » pour une liste)')} />
              <p className="mt-1 text-xs text-gray-500">{t('Affiché en haut du formulaire. Chaque question peut aussi avoir sa propre aide.')}</p>
            </div>
            <p className="text-xs text-gray-500">🏥 {t('Formulaire du WSSC : proposé aux employés du WSSC.')}</p>

            {/* Destinataires */}
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="mb-1 block text-sm font-semibold text-gray-800">📥 {t('Qui reçoit une copie des réponses ?')}</label>
              <p className="mb-2 text-xs text-gray-500">{t('Ajoutez un ou plusieurs destinataires : les gestionnaires d’un département, ou une personne précise. Ils reçoivent un courriel à chaque envoi et peuvent compléter la section réservée. Les administrateurs voient toujours tous les formulaires et leurs statuts.')}</p>
              <div className="flex flex-wrap gap-2">
                {f.destinataires.length === 0 && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{t('Aucun : vous (le créateur) recevez les réponses')}</span>}
                {f.destinataires.map(d => (
                  <span key={d.type + d.id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900">
                    {libelleDest(d)}
                    <button type="button" onClick={() => maj({ destinataires: f.destinataires.filter(x => !(x.type === d.type && x.id === d.id)) })} className="text-indigo-400 hover:text-red-600" aria-label={t('Retirer')}>✕</button>
                  </span>
                ))}
              </div>
              <select className={champCls + ' mt-3'} value={choixDest} onChange={e => ajouterDest(e.target.value)}>
                <option value="">{t('+ Ajouter un destinataire…')}</option>
                {restants.depts.length > 0 && (
                  <optgroup label={t('Gestionnaire(s) d’un département')}>
                    {restants.depts.map(d => <option key={d.id} value={'departement:' + d.id}>{d.nom}{d.gestionnaires ? ` (${d.gestionnaires})` : ` — ${t('aucun gestionnaire avec accès Admin')}`}</option>)}
                  </optgroup>
                )}
                {restants.pers.length > 0 && (
                  <optgroup label={t('Une personne précise')}>
                    {restants.pers.map(p => <option key={p.id} value={'employe:' + p.id}>{nom(p)}</option>)}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Envoi anonyme */}
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.anonyme_permis} onChange={e => maj({ anonyme_permis: e.target.checked, message_anonymat: f.message_anonymat || MESSAGE_ANONYMAT_DEFAUT })} />
                <span><strong>🕶️ {t('Permettre l’envoi anonyme')}</strong><span className="block text-xs text-gray-500">{t('L’employé choisit d’envoyer avec son nom ou de façon anonyme. Anonyme : ses champs d’identité (nom, courriel, poste, signature) sont masqués et non transmis, et il ne reçoit pas de suivi.')}</span></span>
              </label>
              {f.anonyme_permis && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-600">{t('Message affiché à l’employé qui choisit l’anonymat (il doit le cocher)')}</label>
                  <textarea className={champCls + ' min-h-[70px]'} value={f.message_anonymat ?? ''} onChange={e => maj({ message_anonymat: e.target.value })} maxLength={2000} />
                  <button type="button" onClick={() => maj({ message_anonymat: MESSAGE_ANONYMAT_DEFAUT })} className="mt-1 text-xs text-indigo-600 hover:underline">{t('Rétablir le message par défaut')}</button>
                </div>
              )}
            </div>
          </section>

          {/* Questions */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('Questions ({n})', { n: f.champs.filter(c => c.type !== 'section' && c.type !== 'info').length })}</h2>
            <MenuAjout pos={0} />
            {f.champs.map((c, i) => {
              const info = TYPES_CHAMP.find(x => x.type === c.type)!
              const estSection = c.type === 'section'
              return (
                <div key={c.id} className="space-y-3">
                  <div className={'rounded-xl border bg-white shadow-sm ' + (estSection ? (c.reserve ? 'border-gray-500' : 'border-indigo-300') : 'border-gray-200')}>
                    <div className={'flex items-center gap-2 rounded-t-xl px-3 py-2 ' + (estSection ? (c.reserve ? 'bg-gray-700 text-white' : 'bg-indigo-600 text-white') : 'border-b border-gray-100 bg-gray-50')}>
                      <span aria-hidden>{info.icone}</span>
                      <span className={'text-xs font-semibold uppercase ' + (estSection ? '' : 'text-gray-500')}>{t(info.libelle)}{c.reserve && estSection ? ` · 🔒 ${t('réservée')}` : ''}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button type="button" disabled={i === 0} onClick={() => deplacer(i, -1)} className="rounded px-1.5 disabled:opacity-30" title={t('Monter')}>↑</button>
                        <button type="button" disabled={i === f.champs.length - 1} onClick={() => deplacer(i, 1)} className="rounded px-1.5 disabled:opacity-30" title={t('Descendre')}>↓</button>
                        <button type="button" onClick={() => { const l = [...f.champs]; l.splice(i + 1, 0, { ...c, id: nouvelId() }); maj({ champs: l }) }} className="rounded px-1.5" title={t('Dupliquer')}>⧉</button>
                        <button type="button" onClick={() => maj({ champs: f.champs.filter((_, j) => j !== i) })} className={'rounded px-1.5 ' + (estSection ? '' : 'text-red-600')} title={t('Supprimer')}>✕</button>
                      </div>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <input className={champCls + (estSection ? ' font-semibold' : '')} value={c.libelle} onChange={e => majChamp(i, { libelle: e.target.value })}
                          placeholder={c.type === 'info' ? t('Titre de l’encadré (facultatif)') : estSection ? t('Titre de la section') : t('Question / libellé')} />
                      </div>
                      <div className="sm:col-span-2">
                        <textarea className={champCls + ' min-h-[40px] text-xs'} rows={c.type === 'info' ? 3 : 1} value={c.aide ?? ''} onChange={e => majChamp(i, { aide: e.target.value })}
                          placeholder={c.type === 'info' ? t('Texte d’aide affiché à l’employé') : c.type === 'case' ? t('Texte à côté de la case (ex. Je certifie que…)') : t('Aide pour cette question (facultatif)')} />
                      </div>
                      {AVEC_OPTIONS.includes(c.type) && (
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-600">{t('Choix (un par ligne)')}</label>
                          <textarea className={champCls + ' min-h-[90px]'} value={(c.options ?? []).join('\n')} onChange={e => majChamp(i, { options: e.target.value.split('\n') })} />
                          <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={!!c.autre} onChange={e => majChamp(i, { autre: e.target.checked })} /> {t('Ajouter « Autre : … » avec une zone à préciser')}</label>
                        </div>
                      )}
                      {c.type === 'tableau' && (
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">{t('Colonnes (une par ligne) — « Date » et « Heure » donnent un sélecteur')}</label>
                            <textarea className={champCls + ' min-h-[80px]'} value={(c.colonnes ?? []).join('\n')} onChange={e => majChamp(i, { colonnes: e.target.value.split('\n') })} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">{t('Lignes fixes (facultatif, une par ligne) — sinon l’employé ajoute des lignes')}</label>
                            <textarea className={champCls + ' min-h-[80px]'} value={(c.lignes ?? []).join('\n')} onChange={e => majChamp(i, { lignes: e.target.value.split('\n') })} />
                          </div>
                        </>
                      )}
                      {estSection ? (
                        <label className="flex items-start gap-2 text-xs text-gray-700 sm:col-span-2">
                          <input type="checkbox" className="mt-0.5" checked={!!c.reserve} onChange={e => majChamp(i, { reserve: e.target.checked })} />
                          <span>🔒 <strong>{t('Section réservée')}</strong> — {t('cachée à l’employé ; complétée par la personne qui reçoit le formulaire (ex. « Réservé au responsable PRP »).')}</span>
                        </label>
                      ) : c.type !== 'info' && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700 sm:col-span-2">
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.obligatoire} onChange={e => majChamp(i, { obligatoire: e.target.checked })} /> {t('Obligatoire')}</label>
                          {c.type !== 'tableau' && c.type !== 'texte_long' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.demi} onChange={e => majChamp(i, { demi: e.target.checked })} /> {t('Demi-largeur')}</label>}
                          {AVEC_PREREMPLI.includes(c.type) && (
                            <label className="flex items-center gap-1.5">{t('Prérempli :')}
                              <select className="rounded border border-gray-300 px-1.5 py-0.5" value={c.prerempli ?? ''} onChange={e => majChamp(i, { prerempli: (e.target.value || undefined) as Champ['prerempli'] })}>
                                <option value="">{t('non')}</option>
                                {PREREMPLIS.map(p => <option key={p.cle} value={p.cle}>{t(p.libelle)}</option>)}
                              </select>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <MenuAjout pos={i + 1} />
                </div>
              )
            })}
          </section>
        </>
      )}

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-0 z-20 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {etat ? <span className={etat.type === 'ok' ? 'text-green-700' : 'text-red-700'}>{etat.type === 'ok' ? '✓ ' : '⚠ '}{etat.msg}</span>
              : <span className="text-gray-500">{f.actif ? `🟢 ${t('Publié : visible par les employés')}` : `⚪ ${t('Non publié : invisible pour les employés')}`}</span>}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={envoi} onClick={() => enregistrer(f.actif)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('Enregistrer')}</button>
            <button type="button" disabled={envoi} onClick={() => enregistrer(!f.actif)} className={'rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ' + (f.actif ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700')}>
              {f.actif ? t('Retirer (dépublier)') : t('Enregistrer et publier')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
