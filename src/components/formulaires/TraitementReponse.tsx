'use client'

// Traitement d'une réponse par la personne qui la reçoit : statut, sections réservées, note interne.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { STATUTS, champsAvecReserve, type Champ, type Reponses, type StatutReponse } from '@/lib/formulaires'
import ChampsFormulaire from './ChampsFormulaire'

export default function TraitementReponse({ reponseId, champs, statut, reserve, note }: {
  reponseId: string
  champs: Champ[]
  statut: StatutReponse
  reserve: Reponses
  note: string | null
}) {
  const { t } = useT()
  const router = useRouter()
  const [s, setS] = useState(statut)
  const [valeurs, setValeurs] = useState<Reponses>(reserve)
  const [texte, setTexte] = useState(note ?? '')
  const [etat, setEtat] = useState<{ ok: boolean; msg: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const aReserve = champsAvecReserve(champs).some(c => c.estReserve && c.type !== 'section' && c.type !== 'info')

  async function enregistrer(corps: Record<string, unknown>, msg: string) {
    setEnvoi(true); setEtat(null)
    try {
      const res = await fetch(`/api/admin/formulaires/reponses/${reponseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const d = await res.json()
      if (!res.ok) { setEtat({ ok: false, msg: d.error ?? t('Enregistrement impossible') }); return false }
      setEtat({ ok: true, msg }); router.refresh(); return true
    } catch { setEtat({ ok: false, msg: t('Erreur réseau') }); return false }
    finally { setEnvoi(false) }
  }

  return (
    <div className="space-y-4 print:hidden">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-gray-700">{t('Statut du traitement')}</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUTS) as StatutReponse[]).map(k => (
            <button key={k} type="button" disabled={envoi}
              onClick={async () => { if (await enregistrer({ statut: k }, t('Statut mis à jour'))) setS(k) }}
              className="rounded-full border-2 px-3 py-1 text-sm font-semibold transition"
              style={s === k ? { background: STATUTS[k].fond, color: STATUTS[k].couleur, borderColor: STATUTS[k].couleur } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
              {t(STATUTS[k].libelle)}
            </button>
          ))}
        </div>
      </section>

      {aReserve && (
        <section className="space-y-3">
          <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700">🔒 {t('Sections réservées : à compléter par vous. L’employé ne les voit pas.')}</div>
          <ChampsFormulaire champs={champs} valeurs={valeurs} onChange={setValeurs} partie="reserve" />
          <div className="flex justify-end">
            <button type="button" disabled={envoi} onClick={() => enregistrer({ reserve: valeurs }, t('Section réservée enregistrée'))} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50">
              {t('Enregistrer la section réservée')}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-bold text-gray-700">🗒️ {t('Note interne (invisible pour l’employé)')}</label>
        <textarea className="min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={texte} onChange={e => setTexte(e.target.value)} maxLength={8000} />
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={envoi} onClick={() => enregistrer({ note_interne: texte }, t('Note enregistrée'))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('Enregistrer la note')}</button>
        </div>
      </section>

      {etat && <div role="status" className={'rounded-lg px-4 py-2 text-sm ' + (etat.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{etat.ok ? '✓ ' : '⚠ '}{etat.msg}</div>}
    </div>
  )
}
