'use client'
// Bandeau commun de l'assistant de création : point de départ choisi et retour au choix.
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'

export type PointDepart = 'zero' | 'document' | 'presentation'

export function EnteteCreation({ depart }: { depart: PointDepart }) {
  const { t } = useT()
  const libelle: Record<PointDepart, string> = {
    zero: t('Partir de zéro'),
    document: t('À partir d’un document'),
    presentation: t('À partir d’une présentation PowerPoint'),
  }
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/formations" className="text-gray-500 hover:text-gray-700">{t('Formations')}</Link>
        <span className="text-gray-300">/</span>
        <Link href="/admin/formations/creer" className="text-gray-500 hover:text-gray-700">{t('Nouvelle formation')}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-indigo-800">{libelle[depart]}</span>
      </div>
      <Link href="/admin/formations/creer" className="text-sm font-medium text-indigo-700 hover:underline">{t('← Changer de point de départ')}</Link>
    </div>
  )
}
