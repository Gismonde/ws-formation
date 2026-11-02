'use client'

// Assistant de création « pas à pas » d'une formation (partir de zéro).
// 5 étapes courtes ; le contenu détaillé des leçons se fait ensuite dans l'éditeur visuel.
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { createClient } from '@/lib/supabase/client'
import { ChampCategorie } from '@/components/ChampCategorie'
import { ChampCliniqueFormation } from '@/components/ChampCliniqueFormation'
import { formatDuree } from '@/components/ChampDuree'
import type { CliniqueContenu } from '@/lib/cliniques'
import { etapeValide, dureeTotale, type Brouillon, type ModuleBrouillon, type QuestionBrouillon } from '@/lib/assistant-formation'

const CLE = 'assistant-formation-brouillon'
const COUVERTURE_DEFAUT = '/couvertures/ampoule.jpg'
const DUREES = [5, 10, 15, 20, 30, 45, 60]

const nouvelleQuestion = (): QuestionBrouillon => ({ texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] })
const VIDE: Brouillon = {
  titre: '', description: '', image: COUVERTURE_DEFAUT, clinique: null, categorie: 'Administration médicale', niveau: 'debutant', objectifs: [],
  modules: [{ titre: '', duree: 15, lecons: [''] }], quiz: true, questions: [nouvelleQuestion()], seuil: 80,
}

export default function AssistantFormation() {
  const { t } = useT()
  const router = useRouter()
  const [b, setB] = useState<Brouillon>(VIDE)
  const [etape, setEtape] = useState(0)
  const [essai, setEssai] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [objectif, setObjectif] = useState('')
  const [envoiImage, setEnvoiImage] = useState(false)
  const charge = useRef(false)

  // Brouillon local (reprise après fermeture de l'onglet)
  useEffect(() => {
    try { const s = localStorage.getItem(CLE); if (s) setB({ ...VIDE, ...JSON.parse(s), clinique: null }) } catch {}
    charge.current = true
  }, [])
  useEffect(() => {
    if (!charge.current) return
    try { if (b.titre || b.modules.some(m => m.titre)) localStorage.setItem(CLE, JSON.stringify(b)) } catch {}
  }, [b])

  const maj = (p: Partial<Brouillon>) => setB(x => ({ ...x, ...p }))
  const majModule = (i: number, p: Partial<ModuleBrouillon>) => setB(x => ({ ...x, modules: x.modules.map((m, k) => k === i ? { ...m, ...p } : m) }))
  const majQuestion = (i: number, q: QuestionBrouillon) => setB(x => ({ ...x, questions: x.questions.map((v, k) => k === i ? q : v) }))

  const ETAPES = [
    { icone: '💡', nom: t('L’idée') },
    { icone: '🎯', nom: t('Pour qui') },
    { icone: '🧩', nom: t('Le plan') },
    { icone: '✅', nom: t('Le quiz') },
    { icone: '🎉', nom: t('C’est prêt') },
  ]
  const valide = etapeValide(b, etape)
  const minutes = dureeTotale(b)
  const nbLecons = b.modules.reduce((s, m) => s + m.lecons.filter(l => l.trim()).length, 0)
  const nbQuestions = b.quiz ? b.questions.filter(q => q.texte.trim()).length : 0

  const suivant = () => {
    setEssai(true)
    if (!valide) return
    setEssai(false); setEtape(e => Math.min(4, e + 1)); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const precedent = () => { setEssai(false); setEtape(e => Math.max(0, e - 1)) }

  async function envoyerImage(f: File) {
    setEnvoiImage(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.url) maj({ image: d.url }); else setErreur(d.error || t('Échec du téléversement'))
    } catch { setErreur(t('Échec du téléversement')) } finally { setEnvoiImage(false) }
  }

  async function creer() {
    for (let e = 0; e < 4; e++) if (!etapeValide(b, e)) { setEtape(e); setEssai(true); return }
    setEnCours(true); setErreur('')
    const sb = createClient()
    try {
      const { data: f, error } = await sb.from('formations').insert({
        titre: b.titre.trim(), description: b.description.trim() || null, categorie: b.categorie, niveau: b.niveau, clinique: b.clinique,
        duree_estimee_minutes: Math.max(5, minutes), publiee: false, objectifs: b.objectifs, tags: [], prerequis_ids: [], image_couverture: b.image || null,
      }).select('id').single()
      if (error || !f) throw new Error(error?.message || t('Erreur création formation'))
      for (let i = 0; i < b.modules.length; i++) {
        const m = b.modules[i]
        const { data: mod, error: em } = await sb.from('modules').insert({ formation_id: f.id, titre: m.titre.trim(), contenu: '', duree_minutes: m.duree, ordre: i + 1 }).select('id').single()
        if (em || !mod) throw new Error(em?.message || t('Erreur création module'))
        const lecons = m.lecons.map(l => l.trim()).filter(Boolean)
        const liste = lecons.length ? lecons : [m.titre.trim()]
        const parLecon = Math.max(1, Math.round(m.duree / liste.length))
        const { error: el } = await sb.from('lessons').insert(liste.map((titre, k) => ({ module_id: mod.id, titre, description: '', ordre: k + 1, est_obligatoire: true, duree_minutes: parLecon })))
        if (el) throw new Error(el.message)
      }
      const qs = b.quiz ? b.questions.filter(q => q.texte.trim()) : []
      if (qs.length) {
        const { data: qn, error: eq } = await sb.from('questionnaires').insert({ formation_id: f.id, titre: 'Questionnaire - ' + b.titre.trim(), note_passage: b.seuil }).select('id').single()
        if (eq || !qn) throw new Error(eq?.message || t('Erreur questionnaire'))
        for (let i = 0; i < qs.length; i++) {
          const { data: qu, error: eqq } = await sb.from('questions').insert({ questionnaire_id: qn.id, texte: qs[i].texte.trim(), type: 'choix_multiple', ordre: i + 1 }).select('id').single()
          if (eqq || !qu) throw new Error(eqq?.message || t('Erreur questionnaire'))
          const rep = qs[i].reponses.filter(r => r.texte.trim())
          if (rep.length) await sb.from('reponses_possibles').insert(rep.map((r, k) => ({ question_id: qu.id, texte: r.texte.trim(), est_correcte: r.est_correcte, ordre: k + 1 })))
        }
      }
      try { localStorage.removeItem(CLE) } catch {}
      router.push('/admin/formations/' + f.id + '/editeur?bienvenue=1')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
      setEnCours(false)
    }
  }

  const champ = 'w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
  const aide = (ok: boolean, texte: string) => essai && !ok ? <p className="mt-1.5 text-sm font-medium text-rose-600">⚠️ {texte}</p> : null

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="-mt-3 flex justify-end">
        <Link href="/admin/formations/nouvelle/complet" className="text-xs text-gray-400 hover:text-indigo-600">{t('Formulaire complet (avancé)')}</Link>
      </div>

      {/* Progression */}
      <ol className="mt-4 grid grid-cols-5 gap-2" aria-label={t('Étapes')}>
        {ETAPES.map((e, i) => {
          const fait = i < etape, actif = i === etape
          return (
            <li key={i}>
              <button type="button" disabled={i > etape} onClick={() => setEtape(i)} className="w-full text-left disabled:cursor-default">
                <span className={'block h-2 rounded-full transition-all duration-500 ' + (fait ? 'bg-indigo-500' : actif ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-400' : 'bg-gray-200')} />
                <span className={'mt-2 hidden items-center gap-1.5 text-sm sm:flex ' + (actif ? 'font-semibold text-indigo-700' : fait ? 'text-gray-700' : 'text-gray-400')}>
                  <span aria-hidden>{fait ? '✔️' : e.icone}</span>{e.nom}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-gray-400 sm:hidden">{t('Étape')} {etape + 1}/5 · {ETAPES[etape].nom}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section key={etape} className="animate-[apparait_.35s_ease-out] rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <style>{'@keyframes apparait{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'}</style>

          {etape === 0 && (
            <div className="space-y-6">
              <Entete icone="💡" titre={t('De quoi parle votre formation ?')} sous={t('Un titre clair et court, comme vous le diriez à un collègue.')} />
              <div>
                <input autoFocus value={b.titre} onChange={e => maj({ titre: e.target.value })} maxLength={120}
                  onKeyDown={e => { if (e.key === 'Enter') suivant() }}
                  placeholder={t('Ex. : Hygiène des mains au bloc opératoire')} className={champ + ' text-lg font-semibold'} />
                {aide(!!b.titre.trim(), t('Donnez un titre à la formation.'))}
                {!b.titre && (
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

          {etape === 2 && (
            <div className="space-y-5">
              <Entete icone="🧩" titre={t('Construisez le plan')} sous={t('Des modules (les chapitres) et leurs leçons. Juste les titres : le contenu se fait ensuite dans l’éditeur.')} />
              {b.modules.map((m, i) => (
                <div key={i} className="rounded-2xl border-2 border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{i + 1}</span>
                    <div className="flex-1 space-y-3">
                      <input value={m.titre} onChange={e => majModule(i, { titre: e.target.value })} placeholder={t('Titre du module')}
                        className={champ + ' font-semibold'} />
                      {aide(!!m.titre.trim(), t('Donnez un titre à ce module.'))}
                      <div className="space-y-2 border-l-2 border-indigo-200 pl-3">
                        {m.lecons.map((l, k) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-gray-400" aria-hidden>📖</span>
                            <input value={l} placeholder={t('Titre de la leçon')}
                              onChange={e => majModule(i, { lecons: m.lecons.map((x, z) => z === k ? e.target.value : x) })}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); majModule(i, { lecons: [...m.lecons.slice(0, k + 1), '', ...m.lecons.slice(k + 1)] }) } }}
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                            {m.lecons.length > 1 && <button type="button" aria-label={t('Retirer')} onClick={() => majModule(i, { lecons: m.lecons.filter((_, z) => z !== k) })} className="px-1 text-gray-400 hover:text-rose-600">×</button>}
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
              <Entete icone="✅" titre={t('Un petit quiz pour finir ?')} sous={t('Il vérifie la compréhension et déclenche le certificat. Vous pouvez aussi l’ajouter plus tard.')} />
              <div className="grid gap-3 sm:grid-cols-2">
                {[[true, '📝', t('Oui, j’ajoute des questions')], [false, '⏭', t('Plus tard, dans l’éditeur')]].map(([v, ic, txt]) => (
                  <button key={String(v)} type="button" onClick={() => maj({ quiz: v as boolean })}
                    className={'rounded-2xl border-2 p-4 text-left font-semibold transition ' + (b.quiz === v ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300')}>
                    <span className="mr-2 text-xl" aria-hidden>{ic as string}</span>{txt as string}
                  </button>
                ))}
              </div>
              {b.quiz && (
                <>
                  {b.questions.map((q, i) => (
                    <div key={i} className="rounded-2xl border-2 border-gray-100 p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-700">Q{i + 1}</span>
                        <input value={q.texte} onChange={e => majQuestion(i, { ...q, texte: e.target.value })} placeholder={t('Votre question')} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-medium outline-none focus:border-indigo-400" />
                        {b.questions.length > 1 && <button type="button" aria-label={t('Retirer')} onClick={() => maj({ questions: b.questions.filter((_, k) => k !== i) })} className="px-1 text-gray-400 hover:text-rose-600">🗑</button>}
                      </div>
                      <div className="mt-3 space-y-2">
                        {q.reponses.map((r, k) => (
                          <div key={k} className="flex items-center gap-2">
                            <button type="button" title={t('Bonne réponse')} aria-pressed={r.est_correcte}
                              onClick={() => majQuestion(i, { ...q, reponses: q.reponses.map((x, z) => ({ ...x, est_correcte: z === k ? !x.est_correcte : x.est_correcte })) })}
                              className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition ' + (r.est_correcte ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400')}>✓</button>
                            <input value={r.texte} placeholder={t('Réponse') + ' ' + (k + 1)}
                              onChange={e => majQuestion(i, { ...q, reponses: q.reponses.map((x, z) => z === k ? { ...x, texte: e.target.value } : x) })}
                              className={'flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-indigo-400 ' + (r.est_correcte ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200')} />
                            {q.reponses.length > 2 && <button type="button" aria-label={t('Retirer')} onClick={() => majQuestion(i, { ...q, reponses: q.reponses.filter((_, z) => z !== k) })} className="px-1 text-gray-400 hover:text-rose-600">×</button>}
                          </div>
                        ))}
                        <button type="button" onClick={() => majQuestion(i, { ...q, reponses: [...q.reponses, { texte: '', est_correcte: false }] })} className="text-sm font-medium text-indigo-600">{t('+ Réponse')}</button>
                      </div>
                      {q.texte.trim() && !q.reponses.some(r => r.est_correcte && r.texte.trim()) && essai && <p className="mt-2 text-sm font-medium text-rose-600">⚠️ {t('Cochez au moins une bonne réponse (rond vert).')}</p>}
                    </div>
                  ))}
                  <button type="button" onClick={() => maj({ questions: [...b.questions, nouvelleQuestion()] })} className="w-full rounded-2xl border-2 border-dashed border-fuchsia-300 py-3 font-semibold text-fuchsia-700 hover:bg-fuchsia-50">{t('+ Ajouter une question')}</button>
                  <div>
                    <label className="flex items-center justify-between text-sm font-semibold text-gray-700">{t('Note pour réussir')}<span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-white">{b.seuil} %</span></label>
                    <input type="range" min={50} max={100} step={5} value={b.seuil} onChange={e => maj({ seuil: Number(e.target.value) })} className="mt-2 w-full accent-indigo-600" />
                  </div>
                </>
              )}
            </div>
          )}

          {etape === 4 && (
            <div className="space-y-5 text-center">
              <div className="text-6xl" aria-hidden>🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">{t('Bravo, votre formation est prête à être créée !')}</h2>
              <p className="text-gray-600">{t('Elle sera créée en brouillon. Vous ajouterez ensuite le contenu des leçons (textes, images, vidéos, exercices) dans l’éditeur, puis vous la ferez valider avant de la publier.')}</p>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
                {[[b.modules.length, t('modules')], [nbLecons, t('leçons')], [nbQuestions, t('questions')]].map(([n, l]) => (
                  <div key={String(l)} className="rounded-2xl bg-indigo-50 p-3"><p className="text-2xl font-bold text-indigo-700">{n}</p><p className="text-xs text-indigo-900/70">{l}</p></div>
                ))}
              </div>
              {erreur && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{erreur}</p>}
              <button type="button" onClick={creer} disabled={enCours}
                className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-200 transition hover:scale-[1.02] disabled:opacity-60">
                {enCours ? t('Création en cours…') : t('🚀 Créer et ouvrir l’éditeur')}
              </button>
            </div>
          )}

          {erreur && etape < 4 && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{erreur}</p>}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
            {etape > 0 ? <button type="button" onClick={precedent} className="rounded-xl px-4 py-2.5 font-semibold text-gray-600 hover:bg-gray-100">{t('← Retour')}</button> : <span />}
            {etape < 4 && (
              <button type="button" onClick={suivant}
                className={'rounded-xl px-6 py-3 font-bold text-white shadow-md transition ' + (valide ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300')}>
                {etape === 3 ? t('Voir le résumé →') : t('Continuer →')}
              </button>
            )}
          </div>
        </section>

        {/* Aperçu en direct : la carte telle que les employés la verront */}
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
              <p className="text-xs text-gray-500">📦 {b.modules.length} {t('module(s)')} · 📖 {nbLecons} {t('leçon(s)')} · ⏱ {formatDuree(Math.max(5, minutes))}</p>
            </div>
          </div>
        </aside>
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
