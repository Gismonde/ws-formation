// Titre lisible tiré du nom d'un fichier : « politique_confidentialite-v2.pdf » → « Politique confidentialite v2 ».
export function titreDepuisFichier(nom: string): string {
  const base = nom.replace(/\.[a-z0-9]{1,5}$/i, '')
  const propre = base
    .replace(/[_]+/g, ' ')
    .replace(/(?<=\S)-(?=\S)/g, ' ')         // tirets collés (politique-de-vacances)
    .replace(/\s*-\s*/g, ' - ')             // tirets séparateurs gardés lisibles
    .replace(/\s+/g, ' ')
    .trim()
  if (!propre) return ''
  return (propre.charAt(0).toLocaleUpperCase('fr') + propre.slice(1)).slice(0, 300)
}
