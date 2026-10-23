'use client'
// Éditeur des blocs interactifs : formulaire selon le genre + aperçu en direct.
import { useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { envoyerMedia } from '@/lib/medias-client'
import BlocInteractif from '@/components/lecon/BlocInteractif'
import { GENRES, estComplet, type DonneesInteractif, type EtapeScenario, type Zone } from '@/lib/blocs-interactifs'

type Props = {
  titre: string | null
  donnees: DonneesInteractif
  urls: Record<string, string>
  onTitre: (t: string | null) => void
  onDonnees: (d: DonneesInteractif) => void
  setErreur: (e: string | null) => void
}

const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const adresse = (v: string | null | undefined, urls: Record<string, string>) => (!v ? null : v.startsWith('media:') ? urls[v] ?? null : v)

/** Liste éditable générique (ajouter / supprimer / monter). */
function Liste<T>({ items, onChange, vide, rendu, ajouterLibelle }: { items: T[]; onChange: (l: T[]) => void; vide: () => T; rendu: (it: T, maj: (p: Partial<T>) => void, i: number) => React.ReactNode; ajouterLibelle: string }) {
  const { t } = useT()
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="relative bg-gray-50 border border-gray-200 rounded-lg p-3 pr-16">
          {rendu(it, p => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))), i)}
          <div className="absolute top-2 right-2 flex gap-1">
            {i > 0 && <button type="button" title={t('Monter')} onClick={() => { const r = [...items]; [r[i - 1], r[i]] = [r[i], r[i - 1]]; onChange(r) }} className="text-gray-400 hover:text-gray-800 text-xs">▲</button>}
            <button type="button" title={t('Supprimer')} onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, vide()])} className="text-sm font-medium text-indigo-600 hover:underline">{ajouterLibelle}</button>
    </div>
  )
}

function ChoixImage({ valeur, urls, onChange, setErreur, libelle }: { valeur: string | null | undefined; urls: Record<string, string>; onChange: (v: string | null) => void; setErreur: (e: string | null) => void; libelle: string }) {
  const { t } = useT()
  const [envoi, setEnvoi] = useState(false)
  const src = adresse(valeur, urls)
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-16 w-24 object-cover rounded border border-gray-200" /> : valeur ? <span className="h-16 w-24 rounded bg-gray-100 animate-pulse" /> : null}
      <label className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 cursor-pointer hover:bg-gray-50 bg-white">
        {envoi ? t('Envoi…') : valeur ? t('Changer') : libelle}
        <input type="file" accept="image/*" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          setEnvoi(true)
          try { onChange(await envoyerMedia(f, 'image')) } catch (er) { setErreur((er as Error).message) } finally { setEnvoi(false) }
        }} />
      </label>
      {valeur && <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-500 hover:underline">{t('Retirer')}</button>}
    </div>
  )
}

/** Dessin des zones sur l'image : cliquer-glisser pour créer une zone (coordonnées en %). */
function DessinZones({ src, zones, onChange, erreurs }: { src: string; zones: Zone[]; onChange: (z: Zone[]) => void; erreurs: boolean }) {
  const { t } = useT()
  const boite = useRef<HTMLDivElement>(null)
  const [depart, setDepart] = useState<{ x: number; y: number } | null>(null)
  const [courant, setCourant] = useState<{ x: number; y: number } | null>(null)
  const pos = (e: React.PointerEvent) => {
    const r = boite.current!.getBoundingClientRect()
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) }
  }
  const rect = depart && courant ? { x: Math.min(depart.x, courant.x), y: Math.min(depart.y, courant.y), l: Math.abs(courant.x - depart.x), h: Math.abs(courant.y - depart.y) } : null
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{erreurs ? t('Cliquez-glissez sur l’image pour entourer chaque erreur.') : t('Cliquez-glissez sur l’image pour dessiner chaque zone.')}</p>
      <div ref={boite} className="relative select-none touch-none cursor-crosshair"
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); const p = pos(e); setDepart(p); setCourant(p) }}
        onPointerMove={e => depart && setCourant(pos(e))}
        onPointerUp={() => {
          if (rect && rect.l > 1.5 && rect.h > 1.5) onChange([...zones, { id: crypto.randomUUID(), ...rect, titre: '', texte: '' }])
          setDepart(null); setCourant(null)
        }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full rounded-lg pointer-events-none" />
        {zones.map((z, i) => <span key={z.id} className="absolute border-2 border-indigo-500 bg-indigo-500/15 rounded text-[10px] font-bold text-white" style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.l}%`, height: `${z.h}%` }}><span className="bg-indigo-600 px-1 rounded-br">{i + 1}</span></span>)}
        {rect && <span className="absolute border-2 border-dashed border-amber-500 bg-amber-400/20" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.l}%`, height: `${rect.h}%` }} />}
      </div>
    </div>
  )
}

export default function EditeurInteractif({ titre, donnees: d, urls, onTitre, onDonnees, setErreur }: Props) {
  const { t } = useT()
  const [apercu, setApercu] = useState(false)
  const set = (p: Partial<DonneesInteractif>) => onDonnees({ ...d, ...p })
  const g = GENRES.find(x => x.genre === d.genre)

  const formulaire = (() => {
    switch (d.genre) {
      case 'cartes': return (
        <Liste items={d.cartes ?? []} onChange={l => set({ cartes: l })} vide={() => ({ recto: '', verso: '' })} ajouterLibelle={t('+ Ajouter une carte')}
          rendu={(c, maj) => <div className="grid sm:grid-cols-2 gap-2"><input className={champ} value={c.recto} onChange={e => maj({ recto: e.target.value })} placeholder={t('Recto : question ou terme')} /><textarea className={champ} rows={2} value={c.verso} onChange={e => maj({ verso: e.target.value })} placeholder={t('Verso : réponse ou définition')} /></div>} />
      )
      case 'accordeon': return (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">{(['accordeon', 'onglets'] as const).map(m => <label key={m} className="flex items-center gap-1.5"><input type="radio" checked={(d.mode ?? 'accordeon') === m} onChange={() => set({ mode: m })} />{m === 'accordeon' ? t('Accordéon') : t('Onglets')}</label>)}</div>
          <Liste items={d.sections ?? []} onChange={l => set({ sections: l })} vide={() => ({ titre: '', texte: '' })} ajouterLibelle={t('+ Ajouter une section')}
            rendu={(s, maj) => <div className="space-y-2"><input className={champ} value={s.titre} onChange={e => maj({ titre: e.target.value })} placeholder={t('Titre de la section')} /><textarea className={champ} rows={3} value={s.texte} onChange={e => maj({ texte: e.target.value })} placeholder={t('Contenu')} /></div>} />
        </div>
      )
      case 'etapes': return (
        <Liste items={d.etapes ?? []} onChange={l => set({ etapes: l })} vide={(): { titre: string; texte: string; image?: string | null } => ({ titre: '', texte: '' })} ajouterLibelle={t('+ Ajouter une étape')}
          rendu={(e, maj, i) => <div className="space-y-2"><span className="text-xs font-semibold text-gray-500">{t('Étape {n}', { n: i + 1 })}</span><input className={champ} value={e.titre} onChange={x => maj({ titre: x.target.value })} placeholder={t('Titre de l’étape')} /><textarea className={champ} rows={2} value={e.texte} onChange={x => maj({ texte: x.target.value })} placeholder={t('Explication')} /><ChoixImage valeur={e.image} urls={urls} onChange={v => maj({ image: v })} setErreur={setErreur} libelle={t('+ Image (facultatif)')} /></div>} />
      )
      case 'chronologie': return (
        <Liste items={d.jalons ?? []} onChange={l => set({ jalons: l })} vide={() => ({ date: '', titre: '', texte: '' })} ajouterLibelle={t('+ Ajouter un jalon')}
          rendu={(j, maj) => <div className="grid sm:grid-cols-[140px_1fr] gap-2"><input className={champ} value={j.date} onChange={e => maj({ date: e.target.value })} placeholder={t('Date ou étape')} /><input className={champ} value={j.titre} onChange={e => maj({ titre: e.target.value })} placeholder={t('Titre')} /><textarea className={champ + ' sm:col-span-2'} rows={2} value={j.texte} onChange={e => maj({ texte: e.target.value })} placeholder={t('Description (facultatif)')} /></div>} />
      )
      case 'avant_apres': return (
        <div className="grid sm:grid-cols-2 gap-4">
          {(['avant', 'apres'] as const).map(k => (
            <div key={k} className="space-y-2">
              <input className={champ} value={(k === 'avant' ? d.legende_avant : d.legende_apres) ?? ''} onChange={e => set(k === 'avant' ? { legende_avant: e.target.value } : { legende_apres: e.target.value })} placeholder={k === 'avant' ? t('Avant') : t('Après')} />
              <ChoixImage valeur={d[k]} urls={urls} onChange={v => set({ [k]: v })} setErreur={setErreur} libelle={k === 'avant' ? t('+ Image « avant »') : t('+ Image « après »')} />
            </div>
          ))}
          <p className="text-xs text-gray-500 sm:col-span-2">{t('Utilisez deux images de même format (même cadrage) pour un bon effet.')}</p>
        </div>
      )
      case 'animation': return (
        <div className="space-y-2">
          <input className={champ} value={d.animation ?? ''} onChange={e => set({ animation: e.target.value.trim() || null })} placeholder="https://lottie.host/…/animation.json" />
          <p className="text-xs text-gray-500">{t('Sur lottiefiles.com, choisissez une animation gratuite, puis copiez son lien « Lottie JSON ». Les GIF se mettent dans un bloc Image.')}</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.boucle !== false} onChange={e => set({ boucle: e.target.checked })} />{t('Lecture en boucle')}</label>
        </div>
      )
      case 'zones': case 'erreurs': {
        const src = adresse(d.image, urls)
        return (
          <div className="space-y-3">
            <input className={champ} value={d.consigne ?? ''} onChange={e => set({ consigne: e.target.value })} placeholder={t('Consigne affichée à l’employé')} />
            <ChoixImage valeur={d.image} urls={urls} onChange={v => set({ image: v, zones: v ? d.zones : [] })} setErreur={setErreur} libelle={t('+ Choisir l’image')} />
            {src && <DessinZones src={src} zones={d.zones ?? []} onChange={z => set({ zones: z })} erreurs={d.genre === 'erreurs'} />}
            <Liste items={d.zones ?? []} onChange={z => set({ zones: z })} vide={() => ({ id: crypto.randomUUID(), x: 40, y: 40, l: 20, h: 20, titre: '', texte: '' })} ajouterLibelle={t('+ Zone au centre')}
              rendu={(z, maj, i) => <div className="space-y-2"><span className="text-xs font-semibold text-indigo-700">{d.genre === 'erreurs' ? t('Erreur {n}', { n: i + 1 }) : t('Zone {n}', { n: i + 1 })}</span><input className={champ} value={z.titre} onChange={e => maj({ titre: e.target.value })} placeholder={d.genre === 'erreurs' ? t('Quelle est l’erreur ?') : t('Titre')} /><textarea className={champ} rows={2} value={z.texte} onChange={e => maj({ texte: e.target.value })} placeholder={d.genre === 'erreurs' ? t('Pourquoi c’est une erreur / que faut-il faire ?') : t('Explication affichée au clic')} /></div>} />
            {d.genre === 'erreurs' && <p className="text-xs text-gray-500">{t('Score : erreurs trouvées, moins 5 points par clic à côté.')}</p>}
          </div>
        )
      }
      case 'scenario': {
        const etapes = d.scenario ?? []
        const majEtape = (id: string, p: Partial<EtapeScenario>) => set({ scenario: etapes.map(e => (e.id === id ? { ...e, ...p } : e)) })
        return (
          <div className="space-y-3">
            {etapes.map((e, i) => (
              <div key={e.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-600">{t('Situation {n}', { n: i + 1 })}{i === 0 ? ' — ' + t('départ') : ''}</span>{etapes.length > 1 && <button type="button" onClick={() => set({ scenario: etapes.filter(x => x.id !== e.id).map(x => ({ ...x, choix: x.choix.map(c => (c.suite === e.id ? { ...c, suite: null } : c)) })) })} className="text-xs text-gray-400 hover:text-red-600">{t('Supprimer')}</button>}</div>
                <textarea className={champ} rows={3} value={e.situation} onChange={x => majEtape(e.id, { situation: x.target.value })} placeholder={t('Ex. : Un patient vous demande de consulter son dossier à la réception…')} />
                <ChoixImage valeur={e.image} urls={urls} onChange={v => majEtape(e.id, { image: v })} setErreur={setErreur} libelle={t('+ Image (facultatif)')} />
                {e.choix.map((c, k) => (
                  <div key={k} className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <input className={champ} value={c.texte} onChange={x => majEtape(e.id, { choix: e.choix.map((y, j) => (j === k ? { ...y, texte: x.target.value } : y)) })} placeholder={t('Choix {l}', { l: String.fromCharCode(65 + k) })} />
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={c.bon} onChange={x => majEtape(e.id, { choix: e.choix.map((y, j) => (j === k ? { ...y, bon: x.target.checked } : y)) })} />{t('Bon choix')}</label>
                      {e.choix.length > 2 && <button type="button" onClick={() => majEtape(e.id, { choix: e.choix.filter((_, j) => j !== k) })} className="text-xs text-gray-400 hover:text-red-600">✕</button>}
                    </div>
                    <input className={champ} value={c.consequence} onChange={x => majEtape(e.id, { choix: e.choix.map((y, j) => (j === k ? { ...y, consequence: x.target.value } : y)) })} placeholder={t('Conséquence affichée après ce choix')} />
                    <select className={champ} value={c.suite ?? ''} onChange={x => majEtape(e.id, { choix: e.choix.map((y, j) => (j === k ? { ...y, suite: x.target.value || null } : y)) })}>
                      <option value="">{t('Ensuite : fin du scénario (résumé)')}</option>
                      {etapes.filter(x => x.id !== e.id).map(x => <option key={x.id} value={x.id}>{t('Ensuite : situation {n}', { n: etapes.indexOf(x) + 1 })}{x.situation ? ' — ' + x.situation.slice(0, 40) : ''}</option>)}
                    </select>
                  </div>
                ))}
                {e.choix.length < 4 && <button type="button" onClick={() => majEtape(e.id, { choix: [...e.choix, { texte: '', consequence: '', bon: false, suite: null }] })} className="text-xs text-indigo-700 hover:underline">{t('+ Choix')}</button>}
              </div>
            ))}
            <button type="button" onClick={() => set({ scenario: [...etapes, { id: crypto.randomUUID(), situation: '', choix: [{ texte: '', consequence: '', bon: true, suite: null }, { texte: '', consequence: '', bon: false, suite: null }] }] })} className="text-sm font-medium text-indigo-600 hover:underline">{t('+ Ajouter une situation')}</button>
          </div>
        )
      }
      case 'glisser': return (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">{(['associer', 'ordonner'] as const).map(m => <label key={m} className="flex items-center gap-1.5"><input type="radio" checked={(d.variante ?? 'associer') === m} onChange={() => set({ variante: m })} />{m === 'associer' ? t('Associer à des catégories') : t('Remettre dans l’ordre')}</label>)}</div>
          <input className={champ} value={d.consigne ?? ''} onChange={e => set({ consigne: e.target.value })} placeholder={t('Consigne (ex. : Placez chaque déchet dans le bon contenant)')} />
          {(d.variante ?? 'associer') === 'associer'
            ? <Liste items={d.paires ?? []} onChange={l => set({ paires: l })} vide={() => ({ element: '', categorie: '' })} ajouterLibelle={t('+ Ajouter un élément')}
              rendu={(p, maj) => <div className="grid sm:grid-cols-2 gap-2"><input className={champ} value={p.element} onChange={e => maj({ element: e.target.value })} placeholder={t('Élément (ex. : seringue)')} /><input className={champ} list="categories-glisser" value={p.categorie} onChange={e => maj({ categorie: e.target.value })} placeholder={t('Bonne catégorie (ex. : contenant piquants)')} /></div>} />
            : <Liste items={(d.ordre ?? []).map(v => ({ v }))} onChange={l => set({ ordre: l.map(x => x.v) })} vide={() => ({ v: '' })} ajouterLibelle={t('+ Ajouter une étape')}
              rendu={(x, maj, i) => <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-500 w-6">{i + 1}.</span><input className={champ} value={x.v} onChange={e => maj({ v: e.target.value })} placeholder={t('Étape dans le bon ordre')} /></div>} />}
          <datalist id="categories-glisser">{Array.from(new Set((d.paires ?? []).map(p => p.categorie).filter(Boolean))).map(c => <option key={c} value={c} />)}</datalist>
          <p className="text-xs text-gray-500">{(d.variante ?? 'associer') === 'associer' ? t('Les éléments sont mélangés pour l’employé ; les catégories sont créées à partir de vos réponses.') : t('Saisissez les étapes dans le bon ordre : elles seront mélangées pour l’employé.')}</p>
        </div>
      )
    }
  })()

  const exercice = g?.famille === 'exercice' && d.genre !== 'zones'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-500"><span className="text-lg">{g?.icone}</span><span className="font-semibold text-gray-700">{g ? t(g.libelle) : ''}</span><span>· {g ? t(g.aide) : ''}</span></div>
      <input value={titre ?? ''} onChange={e => onTitre(e.target.value || null)} placeholder={t('Titre du bloc (facultatif)')} className={champ + ' font-medium'} />
      {formulaire}
      {exercice && (
        <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4" checked={d.obligatoire === true} onChange={e => set({ obligatoire: e.target.checked })} />
          <span><strong>{t('Exercice obligatoire')}</strong><span className="block text-xs text-gray-500">{t('L’employé doit le réussir pour terminer la leçon.')}</span></span>
        </label>
      )}
      <div className="border-t border-gray-100 pt-3">
        <button type="button" onClick={() => setApercu(!apercu)} className="text-sm font-medium text-indigo-600 hover:underline">{apercu ? t('Masquer l’aperçu') : t('👁 Aperçu')}</button>
        {apercu && (estComplet(d) ? <div className="mt-3"><BlocInteractif titre={titre} d={d} urls={urls} /></div> : <p className="mt-2 text-xs text-gray-500">{t('Complétez le bloc pour voir l’aperçu.')}</p>)}
      </div>
    </div>
  )
}
