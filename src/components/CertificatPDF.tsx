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
    credits_admissible?: boolean | null
    credits_heures?: number | null
    credits_organisme?: string | null
    credits_numero?: string | null
    clinique?: string | null
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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Great+Vibes&family=Montserrat:wght@500;600&display=swap');
        .cert-cadre { container-type: inline-size; width: 100%; }
        .cert-abs { position: absolute; inset: 0; pointer-events: none; }
        .cert-serif { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; }
        .cert-script { font-family: 'Great Vibes', 'Brush Script MT', cursive; }
        .cert-sans { font-family: Montserrat, Arial, sans-serif; }
        .cert-relief { text-shadow: 0 1px 0 #fff, 0 -1px 0 rgba(20,42,82,.35), 0 0.15cqw 0.25cqw rgba(20,42,82,.25); }
        .cert {
          position: relative; width: 100%; aspect-ratio: 297 / 210; box-sizing: border-box;
          background: radial-gradient(ellipse at 50% 45%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%), linear-gradient(135deg, #fbf8f1 0%, #f4eedf 100%);
          color: #1f2937; font-family: 'Cormorant Garamond', Georgia, serif;
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
              {/* Motif guilloché discret */}
              <svg aria-hidden className="cert-abs" viewBox="0 0 1320 920" preserveAspectRatio="none" style={{ opacity: 0.5 }}>
                <defs><pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M0 20 Q10 0 20 20 T40 20" fill="none" stroke="#e7dcc0" strokeWidth=".7" />
                  <path d="M0 30 Q10 10 20 30 T40 30" fill="none" stroke="#efe6cf" strokeWidth=".6" />
                </pattern></defs>
                <rect width="1320" height="920" fill="url(#guilloche)" />
              </svg>
              {/* Double cadre */}
              <div className="cert-abs" style={{ inset: '1.97cqw', border: `0.76cqw solid ${theme.principale}`, boxShadow: `inset 0 0 0 0.15cqw ${theme.accent}, inset 0 0 0 0.68cqw #fbf8f1, inset 0 0 0 0.76cqw ${theme.accent}` }} />
              <div className="cert-abs" style={{ inset: '4.4cqw', border: `0.08cqw solid ${theme.accent}88` }} />
              {/* Coins ornementaux */}
              {[{ top: '3.33cqw', left: '3.33cqw' }, { top: '3.33cqw', right: '3.33cqw', transform: 'scaleX(-1)' }, { bottom: '3.33cqw', left: '3.33cqw', transform: 'scaleY(-1)' }, { bottom: '3.33cqw', right: '3.33cqw', transform: 'scale(-1,-1)' }].map((pos, i) => (
                <svg key={i} aria-hidden viewBox="0 0 90 90" style={{ position: 'absolute', width: '6.8cqw', height: '6.8cqw', pointerEvents: 'none', ...pos }}>
                  <path d="M4 86 V30 Q4 4 30 4 H86" fill="none" stroke={theme.accent} strokeWidth="2" />
                  <path d="M14 86 V36 Q14 14 36 14 H86" fill="none" stroke={theme.accent} strokeWidth="1" />
                  <circle cx="24" cy="24" r="5" fill={theme.accent} />
                  <path d="M24 34 L30 44 L24 54 L18 44Z" fill={theme.principale} /><path d="M34 24 L44 30 L54 24 L44 18Z" fill={theme.principale} />
                </svg>
              ))}
              {apercu && (
                <div className="cert-abs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                  <div style={{ transform: 'rotate(-18deg)', fontSize: '11cqw', fontWeight: 'bold', letterSpacing: '1.5cqw', color: 'rgba(220, 38, 38, 0.13)', fontFamily: 'Arial, sans-serif' }}>APERÇU</div>
                </div>
              )}

              {/* Contenu */}
              <div style={{ position: 'absolute', inset: '5.6cqw 9.8cqw 18.6cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2.5cqw' }}>
                  {liste.map(c => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c} src={CLINIQUE_INFO[c].logo} alt={CLINIQUE_INFO[c].nom} style={{ height: '4.9cqw', width: 'auto', borderRadius: c === 'WSSC' ? '0.45cqw' : 0 }} />
                  ))}
                </div>
                <div className="cert-sans" style={{ marginTop: '0.9cqw', fontWeight: 600, fontSize: '0.98cqw', letterSpacing: '0.45cqw', color: theme.principale, textTransform: 'uppercase' }}>{noms.join('  ·  ')}</div>
                <div className="cert-serif cert-relief" style={{ marginTop: '0.9cqw', fontWeight: 700, fontSize: '4.2cqw', letterSpacing: '0.76cqw', textTransform: 'uppercase', color: theme.principale }}>{t('Certificat')}</div>
                <div className="cert-sans" style={{ fontWeight: 500, fontSize: '1.14cqw', letterSpacing: '0.6cqw', color: theme.accent, textTransform: 'uppercase', filter: 'brightness(0.75)' }}>{t('de formation')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.06cqw', margin: '0.9cqw 0 0.7cqw', color: theme.accent }}>
                  <span style={{ width: '12cqw', height: '1px', background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />◆<span style={{ width: '12cqw', height: '1px', background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
                </div>
                <div className="cert-serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: '1.82cqw', color: '#5b6472' }}>{t('Ce certificat est fièrement décerné à')}</div>
                <div className="cert-script" style={{ fontSize: '5.6cqw', lineHeight: 1.1, color: theme.principale, margin: '0.3cqw 0 0.15cqw' }}>{employe.prenom} {employe.nom}</div>
                <div style={{ width: '42cqw', height: '0.15cqw', background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
                <div className="cert-serif" style={{ marginTop: '1cqw', fontStyle: 'italic', fontWeight: 500, fontSize: '1.55cqw', color: '#5b6472' }}>{t('pour avoir complété avec succès la formation')}</div>
                <div className="cert-serif" style={{ marginTop: '0.45cqw', fontWeight: 700, fontSize: '2.5cqw', color: theme.principale, maxWidth: '68cqw', lineHeight: 1.15 }}>{f?.titre}</div>
                {sousTitre && <div className="cert-sans" style={{ fontSize: '1cqw', color: '#6b7280', marginTop: '0.4cqw' }}>{sousTitre}</div>}
                <div style={{ display: 'flex', gap: '0.8cqw', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.7cqw' }}>
                  {certificat.note_finale != null && (
                    <span className="cert-sans" style={{ fontSize: '1.06cqw', fontWeight: 600, letterSpacing: '0.08cqw', color: theme.principale, padding: '0.45cqw 1.36cqw', border: `0.08cqw solid ${theme.accent}`, borderRadius: '99cqw', background: 'rgba(255,255,255,.6)' }}>
                      {t('Note obtenue : {note} %', { note: Math.round(Number(certificat.note_finale)) })}
                    </span>
                  )}
                  {f?.credits_admissible && f.credits_heures ? (
                    <span className="cert-sans" style={{ fontSize: '1.06cqw', fontWeight: 600, color: theme.principale, padding: '0.45cqw 1.36cqw', border: `0.08cqw solid ${theme.accent}`, borderRadius: '99cqw', background: 'rgba(255,255,255,.6)' }}>
                      {t('Formation continue : {h} heure(s) créditable(s)', { h: String(Number(f.credits_heures)).replace('.', ',') })}
                      {f.credits_organisme ? ` — ${f.credits_organisme}` : ''}{f.credits_numero ? ` (${t('n°')} ${f.credits_numero})` : ''}
                    </span>
                  ) : null}
                </div>
                {/* WSSC, formation non créditée : préciser la portée interne du certificat */}
                {(f?.clinique ? f.clinique === 'WSSC' : liste.length === 1 && liste[0] === 'WSSC') && !(f?.credits_admissible && f.credits_heures) && (
                  <div className="cert-sans" style={{ marginTop: '0.8cqw', maxWidth: '62cqw', fontSize: '0.92cqw', lineHeight: 1.4, color: '#6b7280', fontStyle: 'italic' }}>
                    {t('Attestation de formation interne au Centre de chirurgie Westmount Square. Ce document n’est ni un diplôme ni une certification professionnelle et n’est pas reconnu à l’extérieur du WSSC.')}
                  </div>
                )}
              </div>

              {/* Pied : date, sceau en relief, signature et numéro */}
              <div className="cert-sans" style={{ position: 'absolute', left: '9.8cqw', right: '9.8cqw', bottom: '6.36cqw', display: 'grid', gridTemplateColumns: '1fr 17.4cqw 1fr', alignItems: 'end', zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: '0.83cqw', letterSpacing: '0.15cqw', color: '#8b93a0', textTransform: 'uppercase' }}>{t('Date de délivrance')}</div>
                  <div className="cert-serif" style={{ fontWeight: 600, fontSize: '1.82cqw', color: '#1f2937', marginTop: '0.15cqw' }}>{dateLongue(certificat.date_emission)}</div>
                  {certificat.date_expiration && <div style={{ fontSize: '0.83cqw', color: '#8b93a0', marginTop: '0.45cqw' }}>{t('Valide jusqu’au {date}', { date: dateLongue(certificat.date_expiration) })}</div>}
                </div>
                <svg viewBox="0 0 220 220" aria-label={t('Certifié')} style={{ width: '14.4cqw', height: '14.4cqw', margin: '0 auto', position: 'relative', top: '2.3cqw', filter: 'drop-shadow(0 0.45cqw 0.6cqw rgba(80,60,10,.35))' }}>
                  <defs>
                    <radialGradient id="sceauOr" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fbeab0" /><stop offset=".45" stopColor="#d9b65a" /><stop offset=".8" stopColor="#a7822e" /><stop offset="1" stopColor="#7c5f1c" /></radialGradient>
                    <radialGradient id="sceauOr2" cx="62%" cy="70%" r="70%"><stop offset="0" stopColor="#8d6c22" /><stop offset="1" stopColor="#e7cd84" /></radialGradient>
                    <path id="sceauCercle" d="M110 110 m-61 0 a61 61 0 1 1 122 0 a61 61 0 1 1 -122 0" />
                  </defs>
                  <path d="M82 170 L66 218 L82 210 L92 222 L104 176Z" fill={theme.principale} />
                  <path d="M138 170 L154 218 L138 210 L128 222 L116 176Z" fill={theme.principale} opacity=".85" />
                  <circle cx="110" cy="110" r="84" fill="none" stroke="url(#sceauOr)" strokeWidth="14" strokeDasharray="4.4 2.2" />
                  <circle cx="110" cy="110" r="80" fill="url(#sceauOr)" />
                  <circle cx="110" cy="110" r="78" fill="url(#sceauOr2)" />
                  <circle cx="110" cy="110" r="72" fill="url(#sceauOr)" />
                  <circle cx="110" cy="110" r="48" fill="none" stroke="#8a6d24" strokeWidth="1.5" />
                  <circle cx="110" cy="110" r="45" fill="none" stroke="#fff3c9" strokeWidth="1" opacity=".7" />
                  <text fontFamily="Montserrat, Arial, sans-serif" fontWeight="600" fontSize="9.5" letterSpacing="1.6" fill="#6b5216">
                    <textPath href="#sceauCercle" textLength="370" lengthAdjust="spacingAndGlyphs">{`• ${t('FORMATION CERTIFIÉE')} • ${liste.map(c => CLINIQUE_INFO[c].court).join(' · ')} • ${t('FORMATION CERTIFIÉE')}`}</textPath>
                  </text>
                  {[{ c: '#fff3c9', o: 0.9, d: -1.2 }, { c: '#6b5216', o: 0.7, d: 1.2 }, { c: '#b38f3a', o: 1, d: 0 }].map((x, i) => (
                    <text key={i} x="110" y="121" dy={x.d} textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fontSize="23" fill={x.c} opacity={x.o}>{t('CERTIFIÉ')}</text>
                  ))}
                  <text x="110" y="141" textAnchor="middle" fontFamily="Montserrat, Arial, sans-serif" fontWeight="600" fontSize="9" letterSpacing="2" fill="#6b5216">★ ★ ★</text>
                </svg>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ width: '22.7cqw', marginLeft: 'auto' }}>
                    {f?.responsable_formation && <div className="cert-script" style={{ fontSize: '3cqw', color: theme.principale, textAlign: 'center', lineHeight: 1.2 }}>{f.responsable_formation}</div>}
                    <div style={{ borderTop: '0.08cqw solid #9aa3b0', paddingTop: '0.45cqw', textAlign: 'center', fontSize: '0.91cqw', color: '#6b7280', letterSpacing: '0.08cqw' }}>{t('Responsable de la formation')}</div>
                  </div>
                  <div style={{ marginTop: '0.76cqw', fontSize: '0.83cqw', color: '#8b93a0', letterSpacing: '0.08cqw' }}>
                    {t('N°')} <b style={{ fontFamily: 'monospace', color: theme.principale, fontSize: '0.98cqw' }}>{certificat.numero_certificat}</b>
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
