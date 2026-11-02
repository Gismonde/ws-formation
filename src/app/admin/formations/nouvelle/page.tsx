'use client'

// Assistant de création « pas à pas » d'une formation.
// 1-3 : l'idée, le public, le plan (brouillon local) → le brouillon est créé en base
// 4-5 : le contenu des leçons et le questionnaire, avec les vrais éditeurs (enregistrement automatique)
// Aussi utilisé pour compléter un brouillon créé depuis un PDF ou un PowerPoint : ?formation=<id>
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { createClient } from '@/lib/supabase/client'
import { ChampCategorie } from '@/components/ChampCategorie'
import { ChampCliniqueFormation } from '@/components/ChampCliniqueFormation'
import { formatDuree } from '@/components/ChampDuree'
import EditeurBlocs from '@/components/editeur/EditeurBlocs'
import EditeurQuestionnaire from '@/components/editeur/EditeurQuestionnaire'
import type { CliniqueContenu } from '@/lib/cliniques'
import { etapeValide, dureeTotale, aplatirLecons, planDepuisDocument, type Brouillon, type ModuleBrouillon, type LeconAssistant, type PointDepart } from '@/lib/assistant-formation'
import { inferMetadata, parseDocumentIntoModules, texteDuPdf } from '@/lib/import-document'
import { EnteteCreation } from '@/components/EnteteCreation'

const CLE = 'assistant-formation-brouillon'
const COUVERTURE_DEFAUT = '/couvertures/ampoule.jpg'
const DUREES = [5, 10, 15, 20, 30, 45, 60]
const VIDE: Brouillon = {
  titre: '', description: '', image: COUVERTURE_DEFAUT, clinique: null, categorie: 'Administration médicale', niveau: 'debutant', objectifs: [],
  modules: [{ titre: '', duree: 15, lecons: [''] }],
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlocDb = any

const FORMATS = [
  ['🖼️', 'Image ou GIF'], ['❓', 'Quiz'], ['🎯', 'Zones cliquables'], ['🃏', 'Cartes à retourner'], ['👣', 'Étapes guidées'],
  ['🕒', 'Ligne du temps'], ['🧭', 'Mise en situation'], ['🧩', 'Glisser-déposer'], ['📑', 'Accordéon / onglets'], ['💡', 'Encadrés'],
] as const

export default function AssistantFormation() {
  const { t } = useT()
  const [b, setB] = useState<Brouillon>(VIDE)
  const [etape, setEtape] = useState(0)
  const [essai, setEssai] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [objectif, setObjectif] = useState('')
  const [envoiImage, setEnvoiImage] = useState(false)
  const [formationId, setFormationId] = useState<string | null>(null)
  const [lecons, setLecons] = useState<LeconAssistant[]>([])
  const [active, setActive] = useState<{ id: string; blocs: BlocDb[] } | null>(null)
  const [depart, setDepart] = useState<PointDepart>('zero')
  const [fichier, setFichier] = useState<File | null>(null)
  const [lecture, setLecture] = useState<'' | 'en_cours' | 'ok'>('')
  const [survol, setSurvol] = useState(false)
  const charge = useRef(false)

  const chargerLecons = useCallback(async (fid: string) => {
    const { data } = await createClient().from('modules').select('titre, ordre, lessons(id, titre, ordre, blocs:content_blocks(id))').eq('formation_id', fid)
    const l = aplatirLecons((data ?? []) as Parameters<typeof aplatirLecons>[0])
    setLecons(l)
    return l
  }, [])

  const ouvrirLecon = useCallback(async (id: string) => {
    const { data } = await createClient().from('content_blocks').select('*').eq('lesson_id', id).order('ordre')
    setActive({ id, blocs: data ?? [] })
  }, [])

  // Reprise : brouillon d'un PDF/PowerPoint (?formation=), sinon brouillon local
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fid = params.get('formation')
    const dep = (['document', 'presentation'].includes(params.get('depart') ?? '') ? params.get('depart') : 'zero') as PointDepart
    setDepart(dep)
    ;(async () => {
      if (fid) {
        const { data: f } = await createClient().from('formations').select('id, titre, description, image_couverture, clinique, categorie, niveau, objectifs, duree_estimee_minutes').eq('id', fid).maybeSingle()
        if (f) {
          setB({ ...VIDE, titre: f.titre ?? '', description: f.description ?? '', image: f.image_couverture || COUVERTURE_DEFAUT, clinique: f.clinique, categorie: f.categorie ?? '', niveau: f.niveau ?? 'debutant', objectifs: f.objectifs ?? [], modules: [] })
          setFormationId(f.id)
          const l = await chargerLecons(f.id)
          if (l[0]) ouvrirLecon(l[0].id)
          setEtape(3)
        } else setErreur(t('Formation introuvable'))
        charge.current = true
        return
      }
      try {
        const s = localStorage.getItem(CLE)
        if (s) {
          const d = JSON.parse(s)
          if ((d.depart ?? 'zero') !== dep) throw new Error('autre départ')
          setB({ ...VIDE, ...d.b })
          if (d.formationId) {
            const { data: f } = await createClient().from('formations').select('id').eq('id', d.formationId).maybeSingle()
            if (f) { setFormationId(f.id); const l = await chargerLecons(f.id); if (l[0]) ouvrirLecon(l[0].id); setEtape(d.etape ?? 3) }
          }
        }
      } catch {}
      charge.current = true
    })()
  }, [chargerLecons, ouvrirLecon, t])

  useEffect(() => {
    if (!charge.current) return
    try { if (b.titre || formationId) localStorage.setItem(CLE, JSON.stringify({ b, formationId, etape, depart })) } catch {}
  }, [b, formationId, etape, depart])

  const maj = (p: Partial<Brouillon>) => setB(x => ({ ...x, ...p }))
  const majModule = (i: number, p: Partial<ModuleBrouillon>) => setB(x => ({ ...x, modules: x.modules.map((m, k) => k === i ? { ...m, ...p } : m) }))

  const ETAPES = [
    depart === 'zero' ? { icone: '💡', nom: t('L’idée') } : { icone: depart === 'document' ? '📄' : '📊', nom: t('Le fichier') }, { icone: '🎯', nom: t('Pour qui') }, { icone: '🧩', nom: t('Le plan') },
    { icone: '🎨', nom: t('Le contenu') }, { icone: '✅', nom: t('Le quiz') }, { icone: '🎉', nom: t('C’est prêt') },
  ]
  const valide = depart === 'presentation' && !formationId
    ? (etape === 0 ? !!fichier && !!b.titre.trim() : etape === 2 ? !!fichier : etapeValide(b, etape))
    : etapeValide(b, etape)
  const minutes = formationId ? 0 : dureeTotale(b)
  const nbLecons = formationId ? lecons.length : b.modules.reduce((s, m) => s + m.lecons.filter(l => l.trim()).length, 0)
  const nbModules = formationId ? new Set(lecons.map(l => l.moduleOrdre)).size : b.modules.length
  const remplies = lecons.filter(l => l.nbBlocs > 0).length

  /** Après création, les informations des étapes 1-2 restent modifiables. */
  async function enregistrerInfos() {
    if (!formationId) return
    const { error } = await createClient().from('formations').update({
      titre: b.titre.trim(), description: b.description.trim() || null, image_couverture: b.image || null,
      categorie: b.categorie, niveau: b.niveau, objectifs: b.objectifs, ...(b.clinique ? { clinique: b.clinique } : {}),
    }).eq('id', formationId)
    if (error) throw new Error(error.message)
  }

  async function creerBrouillon() {
    const sb = createClient()
    const { data: f, error } = await sb.from('formations').insert({
      titre: b.titre.trim(), description: b.description.trim() || null, categorie: b.categorie, niveau: b.niveau, clinique: b.clinique,
      duree_estimee_minutes: Math.max(5, dureeTotale(b)), publiee: false, objectifs: b.objectifs, tags: [], prerequis_ids: [], image_couverture: b.image || null,
    }).select('id').single()
    if (error || !f) throw new Error(error?.message || t('Erreur création formation'))
    if (depart === 'presentation') {
      if (!fichier) throw new Error(t('Choisissez votre présentation.'))
      const fd = new FormData(); fd.append('file', fichier); fd.append('formationId', f.id)
      const r = await fetch('/api/import-pptx', { method: 'POST', body: fd })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        await sb.from('formations').delete().eq('id', f.id)
        throw new Error(d.error || t('Import PowerPoint impossible'))
      }
      const { count } = await sb.from('modules').select('id', { count: 'exact', head: true }).eq('formation_id', f.id)
      if (count) await sb.from('formations').update({ duree_estimee_minutes: Math.max(15, count * 15) }).eq('id', f.id)
      setFormationId(f.id)
      const l = await chargerLecons(f.id)
      if (l[0]) await ouvrirLecon(l[0].id)
      return
    }
    for (let i = 0; i < b.modules.length; i++) {
      const m = b.modules[i]
      const { data: mod, error: em } = await sb.from('modules').insert({ formation_id: f.id, titre: m.titre.trim(), contenu: m.contenu ?? '', duree_minutes: m.duree, ordre: i + 1 }).select('id').single()
      if (em || !mod) throw new Error(em?.message || t('Erreur création module'))
      const gardees = m.lecons.map((l, k) => ({ titre: l.trim(), texte: (m.contenus?.[k] ?? '').trim() })).filter(l => l.titre)
      const liste = gardees.length ? gardees : [{ titre: m.titre.trim(), texte: '' }]
      const { data: ls, error: el } = await sb.from('lessons').insert(liste.map((l, k) => ({ module_id: mod.id, titre: l.titre, description: '', ordre: k + 1, est_obligatoire: true, duree_minutes: Math.max(1, Math.round(m.duree / liste.length)) }))).select('id, ordre')
      if (el) throw new Error(el.message)
      const textes = (ls ?? []).map(x => ({ x, texte: liste[x.ordre - 1]?.texte })).filter(v => v.texte)
      if (textes.length) await sb.from('content_blocks').insert(textes.map(v => ({ lesson_id: v.x.id, type: 'text', contenu: v.texte, ordre: 1 })))
    }
    setFormationId(f.id)
    const l = await chargerLecons(f.id)
    if (l[0]) await ouvrirLecon(l[0].id)
  }

  async function suivant() {
    setEssai(true)
    if (!valide) return
    setErreur(''); setEnCours(true)
    try {
      if (etape <= 1 && formationId) await enregistrerInfos()
      if (etape === 2 && !formationId) await creerBrouillon()
      if (etape === 3 && formationId) await chargerLecons(formationId)
      setEssai(false); setEtape(e => Math.min(5, e + 1)); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally { setEnCours(false) }
  }
  const precedent = () => { setEssai(false); setErreur(''); setEtape(e => Math.max(0, e - 1)) }

  async function changerLecon(id: string) {
    if (formationId) chargerLecons(formationId) // met à jour les ✓
    await ouvrirLecon(id)
  }
  const indexActive = lecons.findIndex(l => l.id === active?.id)

  async function envoyerImage(f: File) {
    setEnvoiImage(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.url) maj({ image: d.url }); else setErreur(d.error || t('Échec du téléversement'))
    } catch { setErreur(t('Échec du téléversement')) } finally { setEnvoiImage(false) }
  }

  async function lireFichier(f: File) {
    setErreur('')
    const nom = f.name.toLowerCase()
    if (depart === 'presentation') {
      if (!/\.pptx?$/.test(nom)) { setErreur(t('Choisissez un fichier PowerPoint (.ppt ou .pptx).')); return }
      setFichier(f); setLecture('ok')
      if (!b.titre.trim()) maj({ titre: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() })
      return
    }
    if (!/\.(pdf|txt|md|text)$/.test(nom)) { setErreur(t('Choisissez un fichier PDF, .txt ou .md.')); return }
    setLecture('en_cours')
    try {
      const texte = nom.endsWith('.pdf') ? await texteDuPdf(f) : await f.text()
      const doc = parseDocumentIntoModules(texte)
      const meta = inferMetadata(texte, doc.titre, doc.modules)
      setFichier(f)
      setB(x => ({ ...x, titre: doc.titre || x.titre, description: doc.description || x.description, categorie: meta.categorie || x.categorie,
        niveau: (['debutant', 'intermediaire', 'avance'].includes(meta.niveau) ? meta.niveau : x.niveau) as Brouillon['niveau'],
        objectifs: meta.objectifs.length ? meta.objectifs : x.objectifs, modules: planDepuisDocument(doc.modules) }))
      setLecture('ok')
    } catch {
      setLecture(''); setErreur(t('Erreur lors de la lecture du PDF. Vérifiez que le fichier n\'est pas protégé.'))
    }
  }

  const terminer = () => { try { localStorage.removeItem(CLE) } catch {} }

  const champ = 'w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
  const aide = (ok: boolean, texte: string) => essai && !ok ? <p className="mt-1.5 text-sm font-medium text-rose-600">⚠️ {texte}</p> : null
  const large = etape === 3 || etape === 4

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <EnteteCreation depart={depart} />
      <div className="-mt-3 flex justify-end">
        {formationId
          ? <Link href={`/admin/formations/${formationId}/editeur`} className="text-xs text-gray-400 hover:text-indigo-600">{t('Ouvrir l’éditeur classique')}</Link>
          : <Link href="/admin/formations/nouvelle/complet" className="text-xs text-gray-400 hover:text-indigo-600">{t('Formulaire complet (avancé)')}</Link>}
      </div>

      {/* Progression */}
      <ol className="mt-4 grid grid-cols-6 gap-2" aria-label={t('Étapes')}>
        {ETAPES.map((e, i) => {
          const fait = i < etape, actif = i === etape
          const accessible = i <= etape || (!!formationId && i >= 3)
          return (
            <li key={i}>
              <button type="button" disabled={!accessible || (!!formationId && i === 2)} onClick={() => { setEssai(false); setEtape(i) }} className="w-full text-left disabled:cursor-default">
                <span className={'block h-2 rounded-full transition-all duration-500 ' + (fait ? 'bg-indigo-500' : actif ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-400' : 'bg-gray-200')} />
                <span className={'mt-2 hidden items-center gap-1.5 text-sm md:flex ' + (actif ? 'font-semibold text-indigo-700' : fait ? 'text-gray-700' : 'text-gray-400')}>
                  <span aria-hidden>{fait ? '✔️' : e.icone}</span>{e.nom}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-gray-400 md:hidden">{t('Étape')} {etape + 1}/6 · {ETAPES[etape].nom}</p>

      <div className={'mt-6 grid gap-6 ' + (large ? '' : 'lg:grid-cols-[1fr_320px]')}>
        <section key={etape} className="animate-[apparait_.35s_ease-out] rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <style>{'@keyframes apparait{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'}</style>

          {etape === 0 && (
            <div className="space-y-6">
              {depart !== 'zero' && !formationId && (
                <label
                  onDragOver={e => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)}
                  onDrop={e => { e.preventDefault(); setSurvol(false); const f = e.dataTransfer.files[0]; if (f) lireFichier(f) }}
                  className={'flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition ' + (survol ? 'border-indigo-500 bg-indigo-50' : lecture === 'ok' ? 'border-emerald-400 bg-emerald-50/60' : 'border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-fuchsia-50/60 hover:border-indigo-400')}>
                  <span className="text-5xl" aria-hidden>{lecture === 'ok' ? '✨' : depart === 'document' ? '📄' : '📊'}</span>
                  {lecture === 'ok' && fichier ? (
                    <>
                      <span className="text-lg font-bold text-emerald-800">{fichier.name}</span>
                      <span className="text-sm text-emerald-700">{depart === 'document'
                        ? t('{m} module(s) et {l} leçon(s) détectés : vérifiez-les à l’étape « Le plan ».', { m: b.modules.length, l: b.modules.reduce((n, m) => n + m.lecons.length, 0) })
                        : t('Chaque diapositive deviendra une leçon, avec son texte et ses images.')}</span>
                      <span className="text-xs text-gray-500">{t('Cliquez pour choisir un autre fichier')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold text-gray-900">{lecture === 'en_cours' ? t('Lecture du document…') : depart === 'document' ? t('Déposez votre document ici') : t('Déposez votre présentation ici')}</span>
                      <span className="text-sm text-gray-500">{depart === 'document' ? t('PDF, .txt ou .md — les modules et les leçons sont proposés automatiquement.') : t('.ppt ou .pptx — jusqu’à 50 Mo.')}</span>
                      <span className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{t('Choisir un fichier')}</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept={depart === 'document' ? '.pdf,.txt,.md,.text,application/pdf' : '.ppt,.pptx'}
                    onChange={e => { const f = e.target.files?.[0]; if (f) lireFichier(f); e.target.value = '' }} />
                </label>
              )}
              {depart === 'presentation' && !formationId && aide(!!fichier, t('Choisissez votre présentation.'))}
              <Entete icone="💡" titre={t('De quoi parle votre formation ?')} sous={t('Un titre clair et court, comme vous le diriez à un collègue.')} />
              <div>
                <input autoFocus value={b.titre} onChange={e => maj({ titre: e.target.value })} maxLength={120}
                  onKeyDown={e => { if (e.key === 'Enter') suivant() }}
                  placeholder={t('Ex. : Hygiène des mains au bloc opératoire')} className={champ + ' text-lg font-semibold'} />
                {aide(!!b.titre.trim(), t('Donnez un titre à la formation.'))}
                {!b.titre && depart === 'zero' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[t('Accueil des nouveaux employés'), t('Hygiène des mains'), t('Sécurité incendie'), t('Confidentialité des dossiers')].map(s => (
                      <button key={s} type="button" onClick={() => maj({ titre: s })} className="rounded-full border border-dashed border-indigo-300 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-50">+ {s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">{t('En une ou deux phrases (facultatif)')}</label>
                <textarea value={b.description} onChange={e => maj({ description: e.target.value })} rows={3}
                  placeholder={t('Ce que l’employé saura faire à la fin de la formation.')} className={champ} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">{t('Image de couverture')}</label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => maj({ image: COUVERTURE_DEFAUT })}
                    className={'overflow-hidden rounded-xl border-2 ' + (b.image === COUVERTURE_DEFAUT ? 'border-indigo-500 ring-4 ring-indigo-100' : 'border-gray-200')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={COUVERTURE_DEFAUT} alt="" className="h-16 w-28 object-cover" />
                  </button>
                  {b.image && b.image !== COUVERTURE_DEFAUT && (
                    <span className="overflow-hidden rounded-xl border-2 border-indigo-500 ring-4 ring-indigo-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt="" className="h-16 w-28 object-cover" />
                    </span>
                  )}
                  <label className="flex h-16 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600">
                    <span className="text-lg" aria-hidden>📷</span>{envoiImage ? t('Téléversement…') : t('Ma photo')}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) envoyerImage(f) }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {etape === 1 && (
            <div className="space-y-6">
              <Entete icone="🎯" titre={t('Pour qui est-ce ?')} sous={t('Seuls les employés de la clinique choisie verront la formation.')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <ChampCliniqueFormation valeur={b.clinique} onChange={c => maj({ clinique: c as CliniqueContenu })}
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', background: '#fff' }}
                  labelStyle={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }} />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">{t('Catégorie')}</label>
                  <ChampCategorie valeur={b.categorie} onChange={v => maj({ categorie: v })} className={champ} />
                </div>
              </div>
              {aide(!!b.clinique, t('Choisissez la clinique.'))}
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">{t('Niveau')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([['debutant', '🌱', t('Débutant'), t('Aucune connaissance préalable')], ['intermediaire', '🌿', t('Intermédiaire'), t('Pour approfondir')], ['avance', '🌳', t('Avancé'), t('Pour les experts')]] as const).map(([v, ic, nom, txt]) => (
                    <button key={v} type="button" onClick={() => maj({ niveau: v })}
                      className={'rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 ' + (b.niveau === v ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300')}>
                      <span className="text-2xl" aria-hidden>{ic}</span>
                      <span className="mt-1 block font-semibold text-gray-900">{nom}</span>
                      <span className="block text-xs text-gray-500">{txt}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-gray-700">{t('Objectifs (facultatif)')}</p>
                <div className="flex gap-2">
                  <input value={objectif} onChange={e => setObjectif(e.target.value)} placeholder={t('Ex. : Appliquer les 5 moments de l’hygiène des mains')}
                    onKeyDown={e => { if (e.key === 'Enter' && objectif.trim()) { e.preventDefault(); maj({ objectifs: [...b.objectifs, objectif.trim()] }); setObjectif('') } }}
                    className={champ} />
                  <button type="button" disabled={!objectif.trim()} onClick={() => { maj({ objectifs: [...b.objectifs, objectif.trim()] }); setObjectif('') }}
                    className="rounded-xl bg-indigo-50 px-4 font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">{t('Ajouter')}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {b.objectifs.map((o, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                      ✓ {o}<button type="button" aria-label={t('Retirer')} onClick={() => maj({ objectifs: b.objectifs.filter((_, k) => k !== i) })} className="text-emerald-600 hover:text-rose-600">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {etape === 2 && depart === 'presentation' && (
            <div className="space-y-5 text-center">
              <Entete icone="📊" titre={t('Votre présentation devient une formation')} sous={t('Chaque diapositive devient une leçon, avec son texte et ses images. Vous pourrez tout enrichir à l’étape suivante.')} />
              <div className="mx-auto max-w-md rounded-2xl bg-indigo-50 p-5">
                <p className="text-4xl" aria-hidden>📊 → 📖📖📖</p>
                <p className="mt-2 font-semibold text-indigo-900">{fichier?.name ?? t('Aucun fichier choisi')}</p>
                {!fichier && <button type="button" onClick={() => setEtape(0)} className="mt-2 text-sm font-semibold text-indigo-700 underline">{t('Choisir la présentation')}</button>}
              </div>
            </div>
          )}

          {etape === 2 && depart !== 'presentation' && (
            <div className="space-y-5">
              <Entete icone="🧩" titre={t('Construisez le plan')} sous={t('Des modules (les chapitres) et leurs leçons. Juste les titres : vous ajoutez le contenu à l’étape suivante.')} />
              {b.modules.map((m, i) => (
                <div key={i} className="rounded-2xl border-2 border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{i + 1}</span>
                    <div className="flex-1 space-y-3">
                      <input value={m.titre} onChange={e => majModule(i, { titre: e.target.value })} placeholder={t('Titre du module')} className={champ + ' font-semibold'} />
                      {aide(!!m.titre.trim(), t('Donnez un titre à ce module.'))}
                      <div className="space-y-2 border-l-2 border-indigo-200 pl-3">
                        {m.lecons.map((l, k) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-gray-400" aria-hidden>📖</span>
                            <input value={l} placeholder={t('Titre de la leçon')}
                              onChange={e => majModule(i, { lecons: m.lecons.map((x, z) => z === k ? e.target.value : x) })}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); majModule(i, { lecons: [...m.lecons.slice(0, k + 1), '', ...m.lecons.slice(k + 1)], ...(m.contenus ? { contenus: [...m.contenus.slice(0, k + 1), '', ...m.contenus.slice(k + 1)] } : {}) }) } }}
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                            {m.contenus?.[k] && <span title={t('Texte importé du document')} className="text-xs" aria-hidden>📄</span>}
                            {m.lecons.length > 1 && <button type="button" aria-label={t('Retirer')} onClick={() => majModule(i, { lecons: m.lecons.filter((_, z) => z !== k), ...(m.contenus ? { contenus: m.contenus.filter((_, z) => z !== k) } : {}) })} className="px-1 text-gray-400 hover:text-rose-600">×</button>}
                          </div>
                        ))}
                        <button type="button" onClick={() => majModule(i, { lecons: [...m.lecons, ''] })} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">{t('+ Leçon')}</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs font-semibold text-gray-500">⏱ {t('Durée')}</span>
                        {DUREES.map(d => (
                          <button key={d} type="button" onClick={() => majModule(i, { duree: d })}
                            className={'rounded-full px-2.5 py-0.5 text-xs font-semibold transition ' + (m.duree === d ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-indigo-300')}>{formatDuree(d)}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" disabled={i === 0} aria-label={t('Monter')} onClick={() => setB(x => { const ms = [...x.modules];[ms[i - 1], ms[i]] = [ms[i], ms[i - 1]]; return { ...x, modules: ms } })} className="rounded px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
                      <button type="button" disabled={i === b.modules.length - 1} aria-label={t('Descendre')} onClick={() => setB(x => { const ms = [...x.modules];[ms[i + 1], ms[i]] = [ms[i], ms[i + 1]]; return { ...x, modules: ms } })} className="rounded px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
                      {b.modules.length > 1 && <button type="button" aria-label={t('Supprimer le module')} onClick={() => setB(x => ({ ...x, modules: x.modules.filter((_, k) => k !== i) }))} className="rounded px-1.5 text-gray-400 hover:text-rose-600">🗑</button>}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setB(x => ({ ...x, modules: [...x.modules, { titre: '', duree: 15, lecons: [''] }] }))}
                className="w-full rounded-2xl border-2 border-dashed border-indigo-300 py-4 font-semibold text-indigo-700 transition hover:bg-indigo-50">{t('+ Ajouter un module')}</button>
              <p className="text-center text-sm text-gray-500">{t('Astuce : appuyez sur Entrée dans une leçon pour en ajouter une autre.')}</p>
            </div>
          )}

          {etape === 3 && (
            <div className="space-y-5">
              <Entete icone="🎨" titre={t('Donnez vie à vos leçons')} sous={t('Choisissez une leçon, puis cliquez sur + pour ajouter du contenu. Tout s’enregistre automatiquement.')} />
              <div className="flex flex-wrap gap-2 rounded-2xl bg-gradient-to-r from-indigo-50 to-fuchsia-50 p-3">
                {FORMATS.map(([ic, nom]) => <span key={nom} className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm"><span aria-hidden>{ic}</span>{t(nom)}</span>)}
              </div>
              <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <nav className="space-y-1 lg:sticky lg:top-6 lg:self-start" aria-label={t('Leçons')}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('{n} / {total} leçon(s) remplie(s)', { n: remplies, total: lecons.length })}</p>
                  <div className="mb-3 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${lecons.length ? (remplies / lecons.length) * 100 : 0}%` }} /></div>
                  {lecons.map((l, i) => (
                    <div key={l.id}>
                      {(i === 0 || lecons[i - 1].moduleOrdre !== l.moduleOrdre) && <p className="mt-3 text-xs font-bold text-indigo-900/70">{l.moduleOrdre}. {l.module}</p>}
                      <button type="button" onClick={() => changerLecon(l.id)}
                        className={'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ' + (active?.id === l.id ? 'bg-indigo-600 font-semibold text-white shadow' : 'text-gray-700 hover:bg-indigo-50')}>
                        <span aria-hidden>{l.nbBlocs > 0 ? '✅' : '⚪'}</span><span className="truncate">{l.titre}</span>
                      </button>
                    </div>
                  ))}
                </nav>
                <div className="min-w-0">
                  {active && formationId ? (
                    <>
                      <p className="mb-3 text-lg font-bold text-gray-900">📖 {lecons[indexActive]?.titre}</p>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4">
                        <EditeurBlocs key={active.id} leconId={active.id} formationId={formationId} clinique={b.clinique} blocsInitiaux={active.blocs} />
                      </div>
                      {indexActive < lecons.length - 1 && (
                        <div className="mt-4 text-right">
                          <button type="button" onClick={() => changerLecon(lecons[indexActive + 1].id)} className="rounded-xl bg-indigo-50 px-4 py-2 font-semibold text-indigo-700 hover:bg-indigo-100">{t('Leçon suivante →')}</button>
                        </div>
                      )}
                    </>
                  ) : <p className="text-gray-400">{t('Chargement…')}</p>}
                </div>
              </div>
            </div>
          )}

          {etape === 4 && formationId && (
            <div className="space-y-5">
              <Entete icone="✅" titre={t('Un quiz pour finir')} sous={t('Il vérifie la compréhension et déclenche le certificat. Vous pouvez passer cette étape et l’ajouter plus tard.')} />
              <EditeurQuestionnaire formationId={formationId} titreFormation={b.titre} />
            </div>
          )}

          {etape === 5 && formationId && (
            <div className="space-y-5 text-center">
              <div className="text-6xl" aria-hidden>🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">{t('Bravo, votre formation est créée !')}</h2>
              <p className="text-gray-600">{t('Elle est enregistrée en brouillon. Regardez-la comme un employé, puis envoyez-la en validation depuis sa fiche pour la publier.')}</p>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
                {[[nbModules, t('modules')], [lecons.length, t('leçons')], [remplies, t('leçons remplies')]].map(([n, l]) => (
                  <div key={String(l)} className="rounded-2xl bg-indigo-50 p-3"><p className="text-2xl font-bold text-indigo-700">{n}</p><p className="text-xs text-indigo-900/70">{l}</p></div>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href={`/admin/formations/${formationId}/apercu`} onClick={terminer} className="rounded-2xl border-2 border-indigo-200 px-6 py-3 font-bold text-indigo-700 hover:bg-indigo-50">👀 {t('Voir comme un employé')}</Link>
                <Link href={`/admin/formations/${formationId}`} onClick={terminer}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition hover:scale-[1.02]">🚀 {t('Aller à la fiche (validation)')}</Link>
              </div>
            </div>
          )}

          {erreur && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{erreur}</p>}

          {/* Navigation */}
          {etape < 5 && (
            <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
              {etape > 0 ? <button type="button" onClick={() => { if (formationId && etape === 3) setEtape(1); else precedent() }} className="rounded-xl px-4 py-2.5 font-semibold text-gray-600 hover:bg-gray-100">{t('← Retour')}</button> : <span />}
              <button type="button" onClick={suivant} disabled={enCours}
                className={'rounded-xl px-6 py-3 font-bold text-white shadow-md transition disabled:opacity-60 ' + (valide ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300')}>
                {enCours ? t('Un instant…') : etape === 2 && !formationId ? (depart === 'presentation' ? t('Importer et ajouter le contenu →') : t('Créer le brouillon et ajouter le contenu →')) : etape === 4 ? t('Terminer →') : t('Continuer →')}
              </button>
            </div>
          )}
        </section>

        {/* Aperçu en direct : la carte telle que les employés la verront */}
        {!large && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('Aperçu pour les employés')}</p>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image || COUVERTURE_DEFAUT} alt="" className="aspect-video w-full object-cover" />
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {b.categorie && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{b.categorie}</span>}
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{b.niveau === 'debutant' ? t('Débutant') : b.niveau === 'intermediaire' ? t('Intermédiaire') : t('Avancé')}</span>
                  {b.clinique && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{b.clinique === 'LES_DEUX' ? 'CMC + WSSC' : b.clinique}</span>}
                </div>
                <p className={'font-bold ' + (b.titre ? 'text-gray-900' : 'text-gray-300')}>{b.titre || t('Titre de votre formation')}</p>
                {b.description && <p className="line-clamp-3 text-sm text-gray-500">{b.description}</p>}
                <p className="text-xs text-gray-500">📦 {nbModules} {t('module(s)')} · 📖 {nbLecons} {t('leçon(s)')}{minutes ? ` · ⏱ ${formatDuree(Math.max(5, minutes))}` : ''}</p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function Entete({ icone, titre, sous }: { icone: string; titre: string; sous: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-fuchsia-100 text-2xl" aria-hidden>{icone}</span>
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{titre}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{sous}</p>
      </div>
    </div>
  )
}
