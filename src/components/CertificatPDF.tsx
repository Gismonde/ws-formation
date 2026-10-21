'use client'

import Link from 'next/link'
import { CLINIQUE_INFO, cliniquesDe } from '@/lib/cliniques'
import { useT } from '@/lib/i18n/client'

interface Certificat {
  id: string
  numero_certificat: string
  date_emission: string
  date_expiration?: string | null
  note_finale: number | null
  valide: boolean
  formations: {
    titre: string
    categorie: string | null
    niveau: string | null
    description: string | null
    responsable_formation?: string | null
  } | null
}

interface Employe {
  id: string
  prenom: string
  nom: string
  departement: string | null
}

interface Props {
  certificat: Certificat
  employe: Employe
  /** CMC, WSSC, LES_DEUX (ou null : les deux cliniques) */
  clinique: string | null
  /** Lien de retour (par défaut : « Mes certificats ») */
  retour?: { href: string; libelle: string }
  /** Aperçu pour les créateurs de formations : filigrane « APERÇU » */
  apercu?: boolean
}

// Couleurs du certificat selon la clinique
const THEMES = {
  CMC: { principale: '#7a6a5b', claire: '#efe8df', accent: '#b29a6d' },
  WSSC: { principale: '#1e3a6e', claire: '#e8edf6', accent: '#b8963e' },
  LES_DEUX: { principale: '#2f3f5c', claire: '#ece9e4', accent: '#a88d5a' },
}

const NIVEAUX: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }

export default function CertificatPDF({ certificat, employe, clinique, retour, apercu }: Props) {
  const { t, loc } = useT()
  const dateLongue = (iso: string) =>
    new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric' })
  const cliniques = cliniquesDe(clinique ?? 'LES_DEUX')
  const liste = cliniques.length ? cliniques : cliniquesDe('LES_DEUX')
  const theme = liste.length === 1 ? THEMES[liste[0]] : THEMES.LES_DEUX
  const noms = liste.map(c => CLINIQUE_INFO[c].nom)

  const f = certificat.formations
  const sousTitre = [f?.categorie, f?.niveau ? t('Niveau : {niveau}', { niveau: NIVEAUX[f.niveau] ? t(NIVEAUX[f.niveau]) : f.niveau }) : null].filter(Boolean).join(' — ')

  return (
    <>
      <style>{`
        .cert-cadre { container-type: inline-size; width: 100%; }
        .cert {
          position: relative; width: 100%; aspect-ratio: 297 / 210; box-sizing: border-box;
          background: #fdfbf7; color: #1f2937; font-family: Georgia, 'Times New Roman', serif;
          padding: 3.2cqw 4.5cqw; display: flex; flex-direction: column; justify-content: space-between;
          overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        @media screen { .cert { box-shadow: 0 20px 50px rgba(0,0,0,.18); border-radius: 6px; } }
        @media print {
          .no-print, body > footer { display: none !important; }
          body { min-height: 0 !important; display: block !important; }
          .cert-page { min-height: 0 !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          @page { size: A4 landscape; margin: 0; }
          .cert-page { padding: 0 !important; max-width: none !important; }
          .cert-cadre { width: 297mm; }
          .cert { width: 297mm; height: 210mm; aspect-ratio: auto; }
        }
      `}</style>

      <div className="no-print bg-gray-50 border-b border-gray-200">
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <Link href={retour?.href ?? '/dashboard/certificats'} className="text-gray-500 hover:text-gray-900">{retour?.libelle ?? t('Mes certificats')}</Link>
            <span className="text-gray-300">›</span>
            <span className="font-medium text-gray-900 truncate">{f?.titre}</span>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
            style={{ background: theme.principale }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('Télécharger en PDF')}
          </button>
        </nav>
        <p className="no-print text-xs text-gray-500 text-center pb-3">
          {apercu ? 'Aperçu : voici le certificat que recevront les employés qui réussissent cette formation (nom, date et numéro d’exemple). Vérifiez le titre et la catégorie.' : t('Dans la fenêtre d’impression, choisissez « Enregistrer en PDF ».')}
        </p>
      </div>

      <div className="cert-page bg-gray-50 min-h-screen px-6 py-10">
        <div className="cert-page max-w-5xl mx-auto">
          <div className="cert-cadre">
            <div className="cert">
              {/* Double bordure aux couleurs de la clinique */}
              <div style={{ position: 'absolute', inset: '1.4cqw', border: `0.35cqw solid ${theme.principale}`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: '2cqw', border: `0.1cqw solid ${theme.accent}`, pointerEvents: 'none' }} />
              {apercu && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
                  <div style={{ transform: 'rotate(-18deg)', fontSize: '11cqw', fontWeight: 'bold', letterSpacing: '1.5cqw', color: 'rgba(220, 38, 38, 0.13)', fontFamily: 'Arial, sans-serif' }}>APERÇU</div>
                </div>
              )}
              {/* Coins décoratifs */}
              {[{ top: '2.6cqw', left: '2.6cqw' }, { top: '2.6cqw', right: '2.6cqw' }, { bottom: '2.6cqw', left: '2.6cqw' }, { bottom: '2.6cqw', right: '2.6cqw' }].map((pos, i) => (
                <div key={i} style={{ position: 'absolute', ...pos, width: '1.4cqw', height: '1.4cqw', background: theme.accent, transform: 'rotate(45deg)', pointerEvents: 'none' }} />
              ))}

              {/* En-tête : logos + nom de la clinique */}
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, paddingTop: '1cqw' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3cqw' }}>
                  {liste.map(c => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c} src={CLINIQUE_INFO[c].logo} alt={CLINIQUE_INFO[c].nom}
                      style={{ height: '6cqw', width: 'auto', borderRadius: c === 'WSSC' ? '0.4cqw' : 0 }} />
                  ))}
                </div>
                <div style={{ marginTop: '1.1cqw', fontSize: '1.05cqw', letterSpacing: '0.35cqw', textTransform: 'uppercase', color: theme.principale }}>
                  {noms.join('  ·  ')}
                </div>
              </div>

              {/* Corps */}
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '3.4cqw', letterSpacing: '0.5cqw', textTransform: 'uppercase', color: theme.principale, fontWeight: 'bold' }}>
                  {t('Certificat de formation')}
                </div>
                <div style={{ width: '14cqw', height: '0.18cqw', background: theme.accent, margin: '1.2cqw auto 1.6cqw' }} />
                <div style={{ fontSize: '1.4cqw', fontStyle: 'italic', color: '#6b7280' }}>{t('Ce certificat est décerné à')}</div>
                <div style={{ fontSize: '4.2cqw', fontWeight: 'bold', color: '#111827', margin: '0.6cqw 0 0.2cqw' }}>
                  {employe.prenom} {employe.nom}
                </div>
                {employe.departement && (
                  <div style={{ fontSize: '1.3cqw', color: theme.principale, letterSpacing: '0.1cqw' }}>{employe.departement}</div>
                )}
                <div style={{ fontSize: '1.4cqw', color: '#6b7280', marginTop: '1.8cqw' }}>
                  {t('pour avoir complété avec succès la formation')}
                </div>
                <div style={{ fontSize: '2.5cqw', fontWeight: 'bold', color: theme.principale, margin: '0.6cqw auto 0', lineHeight: 1.25, maxWidth: '75cqw' }}>
                  {f?.titre}
                </div>
                {sousTitre && <div style={{ fontSize: '1.2cqw', color: '#6b7280', marginTop: '0.4cqw' }}>{sousTitre}</div>}
                {certificat.note_finale != null && (
                  <div style={{
                    display: 'inline-block', marginTop: '1.2cqw', padding: '0.4cqw 1.6cqw', borderRadius: '99cqw',
                    background: theme.claire, color: theme.principale, fontSize: '1.2cqw', fontFamily: 'Arial, sans-serif', fontWeight: 600,
                  }}>
                    {t('Note obtenue : {note} %', { note: Math.round(Number(certificat.note_finale)) })}
                  </div>
                )}
              </div>

              {/* Pied : date, sceau, numéro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', position: 'relative', zIndex: 1, fontFamily: 'Arial, sans-serif', paddingBottom: '0.6cqw' }}>
                <div>
                  <div style={{ fontSize: '0.95cqw', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1cqw' }}>{t('Date de délivrance')}</div>
                  <div style={{ fontSize: '1.35cqw', color: '#111827', marginTop: '0.2cqw' }}>{dateLongue(certificat.date_emission)}</div>
                  {certificat.date_expiration && (
                    <div style={{ fontSize: '1.05cqw', color: '#6b7280', marginTop: '0.3cqw' }}>{t('Valide jusqu’au {date}', { date: dateLongue(certificat.date_expiration) })}</div>
                  )}
                </div>

                <div style={{
                  width: '8.5cqw', height: '8.5cqw', borderRadius: '50%', margin: '0 auto',
                  background: theme.principale, border: `0.35cqw solid ${theme.accent}`,
                  boxShadow: `0 0 0 0.25cqw ${theme.claire}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <div style={{ fontSize: '2.6cqw', lineHeight: 1 }}>✓</div>
                  <div style={{ fontSize: '0.75cqw', letterSpacing: '0.12cqw', textTransform: 'uppercase', marginTop: '0.3cqw' }}>{t('Certifié')}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {f?.responsable_formation && (
                    <div style={{ width: '24cqw', marginLeft: 'auto', textAlign: 'center', fontSize: '1.45cqw', color: '#111827', fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', marginBottom: '0.3cqw' }}>
                      {f.responsable_formation}
                    </div>
                  )}
                  <div style={{ width: '24cqw', marginLeft: 'auto', textAlign: 'center', borderTop: '0.1cqw solid #9ca3af', paddingTop: '0.4cqw', fontSize: '1cqw', color: '#6b7280' }}>
                    {t('Responsable de la formation')}
                  </div>
                  <div style={{ fontSize: '0.95cqw', color: '#9ca3af', marginTop: '0.9cqw' }}>
                    {t('N°')} <span style={{ fontFamily: 'monospace', color: theme.principale, letterSpacing: '0.08cqw' }}>{certificat.numero_certificat}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
