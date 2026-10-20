import { redirect, notFound } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { politiquesDeLEmploye, texteConfirmationPolitique } from '@/lib/politiques'
import { i18n } from '@/lib/i18n/serveur'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import ConfirmerPolitique from './ConfirmerPolitique'

export default async function PolitiquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc, langue } = await i18n()

  const p = (await politiquesDeLEmploye(serviceClient(), acteur)).find(x => x.id === id)
  if (!p) notFound()
  const url = (await signerUrlsMedias([p.fichier]))[p.fichier]
  const estPdf = (p.nom_fichier ?? p.fichier).toLowerCase().endsWith('.pdf')

  return (
    <div style={{ maxWidth: '960px' }}>
      <a href="/dashboard/politiques" style={{ fontSize: '14px', color: 'var(--accent-clinique)', textDecoration: 'none' }}>{t('← Politiques')}</a>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>{p.titre}</h1>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px' }}>
        {t('Version {version} · publiée le {date}', { version: p.version, date: new Date(p.publiee_le).toLocaleDateString(loc, { dateStyle: 'long' }) })}
      </p>
      {p.a_reconfirmer && !p.confirme_le && (
        <div style={{ background: 'var(--accent-clinique-clair)', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '12px' }}>
          🔄 {p.note_version ? t('Cette politique a été mise à jour : {note}. Merci de la relire et de confirmer à nouveau.', { note: p.note_version }) : t('Cette politique a été mise à jour. Merci de la relire et de confirmer à nouveau.')}
        </div>
      )}
      {p.description && <p style={{ color: '#374151', fontSize: '15px', margin: '0 0 16px' }}>{p.description}</p>}

      {url && estPdf ? (
        <iframe src={url} title={p.titre} style={{ width: '100%', height: '70vh', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }} />
      ) : null}
      {url && (
        <p style={{ margin: '10px 0 0', fontSize: '14px' }}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-clinique)' }}>
            📄 {estPdf ? t('Ouvrir dans un nouvel onglet') : `${t('Télécharger le document')}${p.nom_fichier ? ` (${p.nom_fichier})` : ''}`}
          </a>
        </p>
      )}

      <ConfirmerPolitique id={p.id} version={p.version} texte={texteConfirmationPolitique(langue)} confirmeLe={p.confirme_le} />
    </div>
  )
}
