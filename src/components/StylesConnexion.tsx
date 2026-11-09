// Styles communs des pages d'accès (connexion, mot de passe oublié, choix du mot de passe) : fond, carte vitrée, champs, bouton.
export const CHAMP_CONNEXION: React.CSSProperties = {
  width: '100%', padding: '14px 16px', border: '1px solid rgba(124, 92, 196, 0.25)', borderRadius: '14px',
  fontSize: '16px', boxSizing: 'border-box', outline: 'none', background: 'rgba(255,255,255,0.85)', color: '#1f2937',
}

export default function StylesConnexion() {
  return (
    <style>{`
        .fond-connexion { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif;
          background: #e9dcfa url('/fonds/connexion.webp') center / cover no-repeat; }
        @media (max-width: 700px) { .fond-connexion { background-image: url('/fonds/connexion-mobile.webp'); } .logo-connexion { height: 72px !important; } }
        .carte-connexion { position: relative; z-index: 1; width: 100%; max-width: 440px; padding: clamp(26px, 6vw, 44px); border-radius: 28px; box-sizing: border-box;
          background: rgba(255,255,255,0.62); border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 24px 60px rgba(91, 61, 160, 0.16); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
        .champ-connexion:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18); }
        .bouton-connexion { width: 100%; padding: 15px; border: none; border-radius: 999px; color: #fff; font-size: 17px; font-weight: 600; cursor: pointer;
          background: linear-gradient(90deg, #7c6cf2 0%, #a77ce8 50%, #e07ac8 100%); box-shadow: 0 10px 24px rgba(124, 92, 230, 0.28); transition: transform .15s, box-shadow .15s; }
        .bouton-connexion:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(124, 92, 230, 0.34); }
        .lien-connexion { color: #6d4fd8; font-size: 14px; font-weight: 600; text-decoration: none; }
        .lien-connexion:hover { text-decoration: underline; }
      `}</style>
  )
}

/** En-tête commun : logo, titre, sous-titre. */
export function EnteteConnexion({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/ws-formation-v2.webp" alt="WS Formation" width={117} height={120} className="logo-connexion" style={{ height: '120px', width: 'auto' }} />
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: '30px', fontWeight: 800, color: '#1b1640', letterSpacing: '-0.01em' }}>{titre}</h1>
      <p style={{ margin: 0, color: '#5b5675', fontSize: '16px' }}>{sousTitre}</p>
    </div>
  )
}
