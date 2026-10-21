'use client'
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { CliniqueContenu } from '@/lib/cliniques'
import DupliquerFormation from '../[id]/DupliquerFormation'

export default function CopierExistante({ formations, cliniques }: { formations: { id: string; titre: string; clinique: CliniqueContenu }[]; cliniques: CliniqueContenu[] }) {
  const { t } = useT()
  const [id, setId] = useState('')
  const f = formations.find(x => x.id === id)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={id} onChange={e => setId(e.target.value)} className="min-w-[260px] flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="">{t('Choisir une formation…')}</option>
        {formations.map(x => <option key={x.id} value={x.id}>{x.titre} ({x.clinique === 'LES_DEUX' ? t('Les deux') : x.clinique})</option>)}
      </select>
      {f && <DupliquerFormation key={f.id} formationId={f.id} titre={f.titre} clinique={f.clinique} cliniques={cliniques} />}
    </div>
  )
}
