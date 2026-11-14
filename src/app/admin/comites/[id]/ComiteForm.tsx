'use client'
// Formulaire d'un comité : textes, membres (employés de la plateforme ou personnes saisies), publication.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { COULEURS_COMITE, couleurDe, type Comite, type MembreComite } from '@/lib/comites'

type EmployeChoix = { id: string; nom: string; poste: string }
const ICONES = ['🤝', '🛡️', '🔒', '🩺', '🌱', '💬', '⚖️', '🎉', '📚', '🧯', '♻️', '❤️']

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function ComiteForm({ comite, employes }: { comite: Comite | null; employes: EmployeChoix[] }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [f, setF] = useState({
    nom: comite?.nom ?? '', icone: comite?.icone ?? '🤝', couleur: comite?.couleur ?? 'violet',
    presentation: comite?.presentation ?? '', description: comite?.description ?? '', activites: comite?.activites ?? '',
    utilite: comite?.utilite ?? '', contact: comite?.contact ?? '', ordre: comite?.ordre ?? 0, publie: comite?.publie ?? false,
  })
  const [membres, setMembres] = useState<MembreComite[]>(comite?.membres ?? [])
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const maj = (k: keyof typeof f, v: string | number | boolean) => setF(x => ({ ...x, [k]: v }))
  const majMembre = (i: number, m: Partial<MembreComite>) => setMembres(l => l.map((x, j) => (j === i ? { ...x, ...m } : x)))
  const deplacer = (i: number, d: number) => setMembres(l => {
    const j = i + d
    if (j < 0 || j >= l.length) return l
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const k = couleurDe(f.couleur)

  async function enregistrer(publie = f.publie) {
    setEnvoi(true); setMessage(null)
    const r = await fetch(comite ? `/api/admin/comites/${comite.id}` : '/api/admin/comites', {
      method: comite ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, publie, membres }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setF(x => ({ ...x, publie }))
    if (!comite) { router.push(`/admin/comites/${d.comite.id}`); return }
    setMessage({ ok: true, texte: publie ? t('Enregistré. Le comité est visible par les employés du WSSC.') : t('Enregistré. Le comité est en brouillon : seuls les administrateurs le voient.') })
    router.refresh()
  }

  async function supprimer() {
    if (!comite) return
    if (!(await confirmer({ message: t('Supprimer le comité « {nom} » ? Sa page disparaît pour tout le monde. Cette action est définitive.', { nom: comite.nom }), bouton: t('Supprimer') }))) return
    const r = await fetch(`/api/admin/comites/${comite.id}`, { method: 'DELETE' })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    router.push('/admin/comites'); router.refresh()
  }

  // Appelée comme une fonction (pas un composant) : le champ garde le focus pendant la saisie
  const zone = (cle: 'description' | 'activites' | 'utilite', titre: string, aide: string) => (
    <label className="block">
      <span className="block text-sm font-semibold text-gray-800">{titre}</span>
      <span className="block text-xs text-gray-500 mb-1">{aide}</span>
      <textarea className={champ} rows={4} value={f[cle]} onChange={e => maj(cle, e.target.value)} />
    </label>
  )

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: k.fond }}>{f.icone}</span>
          <label className="flex-1">
            <span className="block text-sm font-semibold text-gray-800">{t('Nom du comité')}</span>
            <input className={champ} value={f.nom} onChange={e => maj('nom', e.target.value)} placeholder={t('Comité de santé et sécurité au travail')} />
          </label>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Icône')}</span>
            <div className="flex flex-wrap gap-1">
              {ICONES.map(i => (
                <button key={i} type="button" onClick={() => maj('icone', i)} className={'w-9 h-9 rounded-lg text-lg border ' + (f.icone === i ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50')}>{i}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Couleur')}</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COULEURS_COMITE).map(([cle, c]) => (
                <button key={cle} type="button" title={t(c.libelle)} aria-label={t(c.libelle)} onClick={() => maj('couleur', cle)}
                  className="w-9 h-9 rounded-full border-2" style={{ background: c.fond, borderColor: f.couleur === cle ? c.bord : 'transparent' }} />
              ))}
            </div>
          </div>
          <label>
            <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Ordre d’affichage')}</span>
            <input type="number" className={champ + ' w-24'} value={f.ordre} onChange={e => maj('ordre', Number(e.target.value))} />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-800">{t('Présentation courte')}</span>
          <span className="block text-xs text-gray-500 mb-1">{t('Une phrase, affichée sur la carte du comité.')}</span>
          <input className={champ} value={f.presentation} maxLength={300} onChange={e => maj('presentation', e.target.value)} />
        </label>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {zone('description', t('Description'), t('Ce qu’est le comité.'))}
        {zone('activites', t('Ce qu’il fait'), t('Ses activités : réunions, inspections, analyses… Une ligne par point si vous voulez une liste.'))}
        {zone('utilite', t('À quoi il sert'), t('Son utilité pour les employés et la clinique.'))}
        <label className="block">
          <span className="block text-sm font-semibold text-gray-800">{t('Joindre le comité (facultatif)')}</span>
          <span className="block text-xs text-gray-500 mb-1">{t('Un courriel ou une personne-ressource.')}</span>
          <input className={champ} value={f.contact} onChange={e => maj('contact', e.target.value)} />
        </label>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-800">{t('Qui est dedans')}</h2>
        <p className="text-xs text-gray-500 mb-3">{t('Choisissez un employé de la plateforme (son nom et son poste restent à jour) ou saisissez une personne. Le rôle est son rôle dans le comité.')}</p>
        <div className="space-y-3">
          {membres.map((m, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto] items-start border border-gray-100 rounded-lg p-3">
              <div>
                <select className={champ} value={m.employe_id ?? ''} onChange={e => {
                  const emp = employes.find(x => x.id === e.target.value)
                  majMembre(i, emp ? { employe_id: emp.id, nom: emp.nom, poste: '' } : { employe_id: null })
                }}>
                  <option value="">{t('— Personne saisie —')}</option>
                  {employes.map(e => <option key={e.id} value={e.id}>{e.nom}{e.poste ? ` — ${e.poste}` : ''}</option>)}
                </select>
                {!m.employe_id && <input className={champ + ' mt-2'} placeholder={t('Nom')} value={m.nom} onChange={e => majMembre(i, { nom: e.target.value })} />}
              </div>
              <input className={champ} placeholder={m.employe_id ? t('Poste (vide = poste de la fiche)') : t('Poste')} value={m.poste} onChange={e => majMembre(i, { poste: e.target.value })} />
              <input className={champ} placeholder={t('Rôle dans le comité')} value={m.role} onChange={e => majMembre(i, { role: e.target.value })} />
              <div className="flex gap-1">
                <button type="button" onClick={() => deplacer(i, -1)} className="px-2 py-2 text-xs rounded border border-gray-200 hover:bg-gray-50" aria-label={t('Monter')}>↑</button>
                <button type="button" onClick={() => deplacer(i, 1)} className="px-2 py-2 text-xs rounded border border-gray-200 hover:bg-gray-50" aria-label={t('Descendre')}>↓</button>
                <button type="button" onClick={() => setMembres(l => l.filter((_, j) => j !== i))} className="px-2 py-2 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50" aria-label={t('Retirer')}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setMembres(l => [...l, { employe_id: null, nom: '', poste: '', role: '' }])} className="mt-3 text-sm font-medium text-indigo-700 hover:underline">+ {t('Ajouter un membre')}</button>
      </section>

      {message && <div className={'rounded-lg px-4 py-3 text-sm ' + (message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{message.texte}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={envoi} onClick={() => enregistrer()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {envoi ? '…' : comite ? t('Enregistrer') : t('Créer le comité (brouillon)')}
        </button>
        {comite && (f.publie
          ? <button type="button" disabled={envoi} onClick={() => enregistrer(false)} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Repasser en brouillon')}</button>
          : <button type="button" disabled={envoi} onClick={() => enregistrer(true)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-green-600 text-green-700 hover:bg-green-50">{t('Publier pour les employés du WSSC')}</button>)}
        {comite && <Link href={`/dashboard/comites/${comite.id}`} className="text-sm text-indigo-700 hover:underline">{t('Voir comme un employé')} →</Link>}
        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (f.publie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{f.publie ? t('Publié') : t('Brouillon')}</span>
        {comite && <button type="button" onClick={supprimer} className="ml-auto text-sm text-red-600 hover:underline">{t('Supprimer le comité')}</button>}
      </div>
    </div>
  )
}
