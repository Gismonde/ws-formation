// Symbole neutre de la plateforme : un livre ouvert et un point (la personne qui apprend). Dessin original.
export default function Symbole({ taille = 72 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 72 72" fill="none" role="img" aria-label="WS Formation">
      <defs>
        <linearGradient id="symbole-degrade" x1="8" y1="10" x2="64" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6cf2" />
          <stop offset="0.55" stopColor="#a77ce8" />
          <stop offset="1" stopColor="#e07ac8" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="15" r="7" fill="url(#symbole-degrade)" />
      <path d="M36 58C29 52 19 49 9 49V29c10 0 20 3 27 9v20Z" stroke="url(#symbole-degrade)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M36 58c7-6 17-9 27-9V29c-10 0-20 3-27 9v20Z" stroke="url(#symbole-degrade)" strokeWidth="4" strokeLinejoin="round" fill="url(#symbole-degrade)" fillOpacity="0.14" />
    </svg>
  )
}
