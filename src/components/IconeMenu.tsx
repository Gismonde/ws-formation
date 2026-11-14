// Icônes du menu employé (traits fins, style « Lucide » — licence ISC, https://lucide.dev).
// Dessinées en SVG : rendu identique sur tous les appareils, contrairement aux emojis.
const TRACES: Record<string, string> = {
  "accueil": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/> <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
  "formations": "<path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z\"/> <path d=\"M22 10v6\"/> <path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\"/>",
  "evenements": "<path d=\"M8 2v4\"/> <path d=\"M16 2v4\"/> <rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/> <path d=\"M3 10h18\"/> <path d=\"M8 14h.01\"/> <path d=\"M12 14h.01\"/> <path d=\"M16 14h.01\"/> <path d=\"M8 18h.01\"/> <path d=\"M12 18h.01\"/> <path d=\"M16 18h.01\"/>",
  "reussites": "<path d=\"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526\"/> <circle cx=\"12\" cy=\"8\" r=\"6\"/>",
  "politiques": "<path d=\"M12 7v14\"/> <path d=\"M16 12h2\"/> <path d=\"M16 8h2\"/> <path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"/> <path d=\"M6 12h2\"/> <path d=\"M6 8h2\"/>",
  "formulaires": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\"/> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5.5\"/> <path d=\"M4 13.5V6a2 2 0 0 1 2-2h2\"/> <path d=\"M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\"/>",
  "passerelle": "<path d=\"M15 18h-5\"/> <path d=\"M18 14h-8\"/> <path d=\"M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2\"/> <rect width=\"8\" height=\"4\" x=\"10\" y=\"6\" rx=\"1\"/>",
  "compte": "<path d=\"M18 20a6 6 0 0 0-12 0\"/> <circle cx=\"12\" cy=\"10\" r=\"4\"/> <circle cx=\"12\" cy=\"12\" r=\"10\"/>"
}

export default function IconeMenu({ id, taille = 20 }: { id: string; taille?: number }) {
  const traces = TRACES[id]
  if (!traces) return null
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: traces }} />
  )
}
