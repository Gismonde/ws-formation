'use client'
import { useT } from '@/lib/i18n/client'
import { useMemo, useState } from 'react'

export type LigneConfirmation = {
  id: string
  nom: string
  email: string
  departement: string
  clinique: string
  confirme_le: string | null
}

const dateEn = (loc: string) => (iso: string) => new Date(iso).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' })

export default function ListeConfirmations({ lignes, filtreInitial, titre, version }: {
  lignes: LigneConfirmation[]; filtreInitial: 'tous' | 'confirmes' | 'attente'; titre: string; version: number
}) {
  const { t, loc } = useT()
  const date = dateEn(loc)
  const [filtre, setFiltre] = useState(filtreInitial)
  const [recherche, setRecherche] = useState('')
  const confirmes = lignes.filter(l => l.confirme_le).length

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return lignes
      .filter(l => filtre === 'tous' || (filtre === 'confirmes' ? !!l.confirme_le : !l.confirme_le))
      .filter(l => !q || `${l.nom} ${l.email} ${l.departement}`.toLowerCase().includes(q))
      .sort((a, b) => Number(!!a.confirme_le) - Number(!!b.confirme_le) || a.departement.localeCompare(b.departement) || a.nom.localeCompare(b.nom))
  }, [lignes, filtre, recherche])

  function exporter() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = ['Employé;Courriel;Département;Clinique;Statut;Confirmé le',
      ...visibles.map(l => [l.nom, l.email, l.departement, l.clinique, l.confirme_le ? 'Lu et compris' : 'En attente', l.confirme_le ? date(l.confirme_le) : ''].map(esc).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${titre.replace(/[^A-Za-zÀ-ÿ0-9]+/g, '_')}_v${version}_confirmations.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const onglet = (cle: typeof filtre, libelle: string, n: number) => (
    <button type="button" onClick={() => setFiltre(cle)}
      className={'px-3 py-1.5 rounded-lg text-sm ' + (filtre === cle ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
      {libelle} <span className="opacity-70">({n})</span>
    </button>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        {onglet('tous', 'Tous', lignes.length)}
        {onglet('confirmes', t('✅ Lu et compris'), confirmes)}
        {onglet('attente', '⏳ En attente', lignes.length - confirmes)}
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={t('Rechercher un employé…')}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" />
        <button type="button" onClick={exporter} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">⬇ Exporter (CSV)</button>
      </div>
      {visibles.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">{t('Aucun employé dans cette liste.')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500">
              <th className="text-left px-5 py-2 font-semibold">{t('Employé')}</th>
              <th className="text-left px-3 py-2 font-semibold">{t('Département')}</th>
              <th className="text-left px-3 py-2 font-semibold">{t('Clinique')}</th>
              <th className="text-left px-3 py-2 font-semibold">{t('Statut')}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(l => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-5 py-2.5">
                  <a href={`/admin/employes/${l.id}`} className="text-gray-900 hover:text-blue-700">{l.nom}</a>
                  <div className="text-xs text-gray-400">{l.email}</div>
                </td>
                <td className="px-3 py-2.5 text-gray-600">{l.departement}</td>
                <td className="px-3 py-2.5 text-gray-600">{l.clinique}</td>
                <td className="px-3 py-2.5">
                  {l.confirme_le
                    ? <span className="text-green-700">✅ {date(l.confirme_le)}</span>
                    : <span className="text-amber-700 font-medium">{t('⏳ En attente')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
