'use client'

import { useRef } from 'react'
import Link from 'next/link'

interface Certificat {
  id: string
  numero_certificat: string
  date_emission: string
  note_finale: number | null
  valide: boolean
  formations: {
    titre: string
    categorie: string
    niveau: string
    description: string
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
}

export default function CertificatPDF({ certificat, employe }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const dateEmission = new Date(certificat.date_emission).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const annee = new Date(certificat.date_emission).getFullYear()

  return (
    <>
      {/* Styles d impression - masquer l interface, afficher seulement le certificat */}
      <style>{
        `@media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { margin: 0; padding: 0; background: white; }
          @page { size: landscape; margin: 0; }
        }
        @media screen {
          .print-only { display: none; }
        }`
      }</style>

      {/* Barre de navigation - masquee a l impression */}
      <div className="no-print min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/certificats" className="text-gray-500 hover:text-gray-900 text-sm">
                Mes certificats
              </Link>
              <span className="text-gray-300">›</span>
              <span className="text-sm font-medium text-gray-900">{certificat.formations?.titre}</span>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Telecharger en PDF
            </button>
          </div>
        </nav>

        {/* Apercu du certificat */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Apercu du certificat — Cliquez sur &laquo; Telecharger en PDF &raquo; pour sauvegarder
          </p>

          {/* Le certificat lui-meme */}
          <div
            ref={printRef}
            style={{
              width: '100%',
              aspectRatio: '1.414 / 1',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
              borderRadius: '16px',
              padding: '60px 80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: 'Georgia, serif',
              color: 'white',
            }}
          >
            {/* Decorations de fond */}
            <div style={{
              position: 'absolute', top: -100, right: -100,
              width: 400, height: 400,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -80, left: -80,
              width: 300, height: 300,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }} />

            {/* Bordure decorative */}
            <div style={{
              position: 'absolute', inset: 20,
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              pointerEvents: 'none',
            }} />

            {/* En-tete */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(196,181,253,0.9)', marginBottom: 4 }}>
                  WS Formation
                </div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                  Plateforme de formation professionnelle
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  No.
                </div>
                <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(196,181,253,0.9)', letterSpacing: 2 }}>
                  {certificat.numero_certificat}
                </div>
              </div>
            </div>

            {/* Corps principal */}
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{
                fontSize: 11, letterSpacing: 6, textTransform: 'uppercase',
                color: 'rgba(196,181,253,0.8)', marginBottom: 24,
              }}>
                Certificat de competence
              </div>

              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16, fontStyle: 'italic',
              }}>
                Ce certificat est decerne a
              </div>

              <div style={{
                fontSize: 48, fontWeight: 'bold', letterSpacing: 2,
                color: 'white', marginBottom: 8,
                textShadow: '0 2px 20px rgba(255,255,255,0.2)',
              }}>
                {employe.prenom} {employe.nom}
              </div>

              {employe.departement && (
                <div style={{ fontSize: 14, color: 'rgba(196,181,253,0.7)', marginBottom: 28 }}>
                  {employe.departement}
                </div>
              )}

              <div style={{
                width: 120, height: 2,
                background: 'linear-gradient(to right, transparent, rgba(196,181,253,0.6), transparent)',
                margin: '0 auto 28px',
              }} />

              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12,
              }}>
                pour avoir complete avec succes la formation
              </div>

              <div style={{
                fontSize: 26, fontWeight: 'bold', color: 'white',
                marginBottom: 8, lineHeight: 1.3,
              }}>
                {certificat.formations?.titre}
              </div>

              {certificat.formations?.categorie && (
                <div style={{ fontSize: 13, color: 'rgba(196,181,253,0.7)' }}>
                  {certificat.formations.categorie}
                  {certificat.formations.niveau ? ` — Niveau ${certificat.formations.niveau}` : ''}
                </div>
              )}

              {certificat.note_finale != null && (
                <div style={{
                  display: 'inline-block', marginTop: 20,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  padding: '6px 20px',
                  fontSize: 13, color: 'rgba(196,181,253,1)',
                }}>
                  Note finale : {Math.round(certificat.note_finale)}%
                </div>
              )}
            </div>

            {/* Pied */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  Date de delivrance
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
                  {dateEmission}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, margin: '0 auto 6px',
                }}>
                  🏆
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>
                  Valide
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.3)',
                  paddingTop: 6,
                  fontSize: 11, color: 'rgba(255,255,255,0.4)',
                }}>
                  WS Formation — {annee}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version impression uniquement */}
      <div
        className="print-only"
        style={{
          width: '100vw', height: '100vh',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
          padding: '40px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'Georgia, serif',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Meme contenu pour impression */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(196,181,253,0.9)', marginBottom: 4 }}>WS Formation</div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Plateforme de formation professionnelle</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>No.</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(196,181,253,0.9)', letterSpacing: 2 }}>{certificat.numero_certificat}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(196,181,253,0.8)', marginBottom: 20 }}>Certificat de competence</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontStyle: 'italic' }}>Ce certificat est decerne a</div>
          <div style={{ fontSize: 42, fontWeight: 'bold', color: 'white', marginBottom: 6 }}>{employe.prenom} {employe.nom}</div>
          {employe.departement && <div style={{ fontSize: 13, color: 'rgba(196,181,253,0.7)', marginBottom: 24 }}>{employe.departement}</div>}
          <div style={{ width: 100, height: 1, background: 'rgba(255,255,255,0.3)', margin: '0 auto 24px' }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>pour avoir complete avec succes la formation</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 6 }}>{certificat.formations?.titre}</div>
          {certificat.formations?.categorie && <div style={{ fontSize: 12, color: 'rgba(196,181,253,0.7)' }}>{certificat.formations.categorie}{certificat.formations.niveau ? ` — Niveau ${certificat.formations.niveau}` : ''}</div>}
          {certificat.note_finale != null && <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(196,181,253,1)' }}>Note finale : {Math.round(certificat.note_finale)}%</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Date de delivrance</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{dateEmission}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🏆</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>Valide</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>WS Formation — {annee}</div>
          </div>
        </div>
      </div>
    </>
  )
      }
