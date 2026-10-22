'use client'
// Actions sur un événement : publier, modifier, annuler ; séances (ajout, modification, annulation) ; inscrits et présences.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

type SeanceVue = { id: string; debut: string; fin: string; places: number; lieu: string | null; annulee: boolean; restantes: number }
type InscriptionVue = { id: string; seance_id: string; employe_id: string; statut: string; present: boolean | null; inscrit_le: string; nom: string; poste: string }

const champsDate = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, heure: `${p(d.getHours())}:${p(d.getMinutes())}` }
}

export default function GestionEvenement({ evenement, seances, inscriptions }: {
  evenement: { id: string; titre: string; statut: string; aFormation: boolean }
  seances: SeanceVue[]
  inscriptions: InscriptionVue[]
}) {
  const { t, loc } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [envoi, setEnvoi] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)
  const [edition, setEdition] = useState<{ id: string | null; date: string; debut: string; fin: string; places: string; lieu: string } | null>(null)
  const [presences, setPresences] = useState<Record<string, string[]>>(() => {
    const r: Record<string, string[]> = {}
    for (const i of inscriptions) if (i.present) r[i.seance_id] = [...(r[i.seance_id] ?? []), i.employe_id]
    return r
  })
  const quand = (s: SeanceVue) => `${new Date(s.debut).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${new Date(s.debut).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.fin).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`

  async function agir(corps: Record<string, unknown>, succes: (d: Record<string, unknown>) => string) {
    setEnvoi(true); setMsg(null)
    const r = await fetch(`/api/admin/evenements/${evenement.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return false }
    setMsg({ ok: true, texte: succes(d) }); router.refresh(); return true
  }

  async function enregistrerSeance() {
    if (!edition?.date) return
    const corps = { debut: new Date(`${edition.date}T${edition.debut}`).toISOString(), fin: new Date(`${edition.date}T${edition.fin}`).toISOString(), places: Number(edition.places), lieu: edition.lieu || null }
    const ok = edition.id
      ? await agir({ action: 'modifier_seance', seanceId: edition.id, ...corps }, d => t('Séance modifiée.') + (Number(d.promus) ? ' ' + t('{n} personne(s) inscrite(s) depuis la liste d’attente.', { n: Number(d.promus) }) : ''))
      : await agir({ action: 'ajouter_seance', ...corps }, () => t('Séance ajoutée.'))
    if (ok) setEdition(null)
  }

  const actives = seances.filter(s => !s.annulee)
  const passee = (s: SeanceVue) => new Date(s.debut).getTime() < Date.now()
  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {evenement.statut === 'brouillon' && (
          <button type="button" disabled={envoi || actives.length === 0} onClick={async () => {
            if (await confirmer({ titre: t('Publier l’événement'), message: t('Les personnes ciblées le verront dans leur portail et recevront un courriel pour s’inscrire.'), bouton: t('Publier') }))
              agir({ action: 'publier' }, d => t('Événement publié.') + (Number(d.courriels) ? ' ' + t('{n} courriel(s) envoyé(s).', { n: Number(d.courriels) }) : ''))
          }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50">{t('Publier')}</button>
        )}
        {evenement.statut !== 'annule' && <Link href={`/admin/evenements/${evenement.id}/modifier`} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white">{t('Modifier')}</Link>}
        <a href={`/api/admin/evenements/${evenement.id}/export`} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white">⬇ {t('Exporter les inscriptions (Excel)')}</a>
        {evenement.statut === 'publie' && (
          <button type="button" disabled={envoi} onClick={async () => {
            if (await confirmer({ titre: t('Annuler l’événement'), message: t('Toutes les inscriptions seront annulées et les personnes inscrites prévenues par courriel.'), bouton: t('Annuler l’événement'), danger: true }))
              agir({ action: 'annuler' }, () => t('Événement annulé.'))
          }} className="text-sm px-4 py-2 rounded-lg border border-red-300 text-red-700 bg-white">{t('Annuler l’événement')}</button>
        )}
        {evenement.statut === 'brouillon' && (
          <button type="button" disabled={envoi} onClick={async () => {
            if (!(await confirmer({ message: t('Supprimer ce brouillon ?'), bouton: t('Supprimer'), danger: true }))) return
            const r = await fetch(`/api/admin/evenements/${evenement.id}`, { method: 'DELETE' })
            if (r.ok) router.push('/admin/evenements'); else setMsg({ ok: false, texte: (await r.json().catch(() => ({}))).error ?? t('Erreur') })
          }} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-500 bg-white">{t('Supprimer le brouillon')}</button>
        )}
      </div>
      {msg && <p className={'text-sm ' + (msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.texte}</p>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('Séances')}</h2>
        {evenement.statut !== 'annule' && !edition && <button type="button" onClick={() => setEdition({ id: null, date: '', debut: '09:00', fin: '12:00', places: '12', lieu: '' })} className="text-sm font-medium text-indigo-600 hover:underline">{t('+ Ajouter une date')}</button>}
      </div>

      {edition && (
        <div className="flex flex-wrap items-end gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div><span className="block text-xs text-gray-500">{t('Date')}</span><input type="date" className={input} value={edition.date} onChange={e => setEdition({ ...edition, date: e.target.value })} /></div>
          <div><span className="block text-xs text-gray-500">{t('Début')}</span><input type="time" className={input} value={edition.debut} onChange={e => setEdition({ ...edition, debut: e.target.value })} /></div>
          <div><span className="block text-xs text-gray-500">{t('Fin')}</span><input type="time" className={input} value={edition.fin} onChange={e => setEdition({ ...edition, fin: e.target.value })} /></div>
          <div className="w-24"><span className="block text-xs text-gray-500">{t('Places')}</span><input type="number" min={1} className={input + ' w-full'} value={edition.places} onChange={e => setEdition({ ...edition, places: e.target.value })} /></div>
          <div className="flex-1 min-w-[160px]"><span className="block text-xs text-gray-500">{t('Lieu (si différent)')}</span><input className={input + ' w-full'} value={edition.lieu} onChange={e => setEdition({ ...edition, lieu: e.target.value })} /></div>
          <button type="button" disabled={envoi || !edition.date} onClick={enregistrerSeance} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Enregistrer')}</button>
          <button type="button" onClick={() => setEdition(null)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 bg-white">{t('Annuler')}</button>
          {edition.id && evenement.statut === 'publie' && <p className="w-full text-xs text-gray-500">{t('Si la date, l’heure ou le lieu change, les personnes inscrites sont prévenues par courriel.')}</p>}
        </div>
      )}

      {seances.length === 0 && <p className="text-sm text-gray-500">{t('Aucune séance.')}</p>}
      {seances.map(s => {
        const ins = inscriptions.filter(i => i.seance_id === s.id)
        const inscrits = ins.filter(i => i.statut === 'inscrit')
        const attente = ins.filter(i => i.statut === 'attente').sort((a, b) => a.inscrit_le.localeCompare(b.inscrit_le))
        const coches = presences[s.id] ?? []
        return (
          <section key={s.id} className={'bg-white border rounded-2xl p-5 ' + (s.annulee ? 'border-red-200 opacity-70' : 'border-gray-200')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 first-letter:uppercase">{quand(s)}{s.annulee && <span className="ml-2 text-xs font-semibold text-red-700">{t('Annulée')}</span>}</p>
                {s.lieu && <p className="text-xs text-gray-500">📍 {s.lieu}</p>}
                <p className="text-sm text-gray-600 mt-1">{t('{i} / {p} place(s) prise(s)', { i: inscrits.length, p: s.places })}{attente.length ? ' · ' + t('{n} en liste d’attente', { n: attente.length }) : ''}</p>
              </div>
              {!s.annulee && evenement.statut !== 'annule' && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { const a = champsDate(s.debut), b = champsDate(s.fin); setEdition({ id: s.id, date: a.date, debut: a.heure, fin: b.heure, places: String(s.places), lieu: s.lieu ?? '' }) }} className="text-xs text-indigo-600 hover:underline">{t('Modifier')}</button>
                  {!passee(s) && <button type="button" disabled={envoi} onClick={async () => {
                    if (await confirmer({ titre: t('Annuler la séance'), message: t('Les {n} personne(s) inscrite(s) seront prévenues par courriel et pourront choisir une autre date.', { n: inscrits.length + attente.length }), bouton: t('Annuler la séance'), danger: true }))
                      agir({ action: 'annuler_seance', seanceId: s.id }, () => t('Séance annulée.'))
                  }} className="text-xs text-red-600 hover:underline">{t('Annuler la séance')}</button>}
                </div>
              )}
            </div>

            {inscrits.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{passee(s) ? t('Présences') : t('Inscrits')}</p>
                  {passee(s) && !s.annulee && <span className="text-xs space-x-3">
                    <button type="button" className="text-indigo-600 hover:underline" onClick={() => setPresences({ ...presences, [s.id]: inscrits.map(i => i.employe_id) })}>{t('Tous présents')}</button>
                  </span>}
                </div>
                <ul className="divide-y divide-gray-100">
                  {inscrits.map(i => (
                    <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
                      {passee(s) && !s.annulee && (
                        <input type="checkbox" checked={coches.includes(i.employe_id)} aria-label={t('Présent')}
                          onChange={() => setPresences({ ...presences, [s.id]: coches.includes(i.employe_id) ? coches.filter(x => x !== i.employe_id) : [...coches, i.employe_id] })} />
                      )}
                      <span className="flex-1">{i.nom}{i.poste && <span className="block text-xs text-gray-500">{i.poste}</span>}</span>
                      {i.present === true && <span className="text-xs text-green-700">✓ {t('Présent')}</span>}
                      {i.present === false && <span className="text-xs text-gray-400">{t('Absent')}</span>}
                      {!passee(s) && <button type="button" disabled={envoi} onClick={async () => {
                        if (await confirmer({ message: t('Retirer {nom} de cette séance ?', { nom: i.nom }), bouton: t('Retirer'), danger: true })) agir({ action: 'retirer_inscription', inscriptionId: i.id }, () => t('Inscription retirée.'))
                      }} className="text-xs text-gray-400 hover:text-red-600">{t('Retirer')}</button>}
                    </li>
                  ))}
                </ul>
                {passee(s) && !s.annulee && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" disabled={envoi} onClick={() => agir({ action: 'presence', seanceId: s.id, presents: coches }, d => t('Présences enregistrées.') + (Number(d.certificats) ? ' ' + t('{n} certificat(s) délivré(s).', { n: Number(d.certificats) }) : ''))}
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Enregistrer les présences')}</button>
                    {evenement.aFormation && <span className="text-xs text-gray-500">{t('Les présents reçoivent la formation liée comme terminée, avec son certificat.')}</span>}
                  </div>
                )}
              </div>
            )}

            {attente.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('Liste d’attente')}</p>
                <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">{attente.map(i => <li key={i.id}>{i.nom}</li>)}</ol>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
