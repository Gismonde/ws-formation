// « La Passerelle » : le journal de la clinique (portail employé, espace WSSC).
//  - Les administrateurs déposent chaque édition en PDF (espace privé) ; la couverture est la page 1.
//  - Une édition en brouillon n'est visible que par les administrateurs.
//  - Ouvrir une édition est noté (badge « Lecteur de La Passerelle »).
import type { SupabaseClient } from '@supabase/supabase-js'
import { estAdministrateur, cliniquesDe } from '@/lib/cliniques'

export const CLINIQUE_PASSERELLE = 'WSSC'
export const CLE_APPEL_PASSERELLE = 'passerelle_appel'

export type LigneSommaire = { titre: string; page: number | null }
export type Edition = {
  id: string; numero: number; volume: number; date_parution: string; temps_lecture: number | null
  accroche: string; sommaire: LigneSommaire[]; couleur: string; pdf: string; couverture: string; publie: boolean
}

/** Couleurs des éditions (reprises des couvertures) */
export const COULEURS_EDITION: Record<string, { fond: string; texte: string; accent: string; libelle: string }> = {
  bleu: { fond: '#E6F1FB', texte: '#0C447C', accent: '#185FA5', libelle: 'Bleu' },
  turquoise: { fond: '#E1F5EE', texte: '#085041', accent: '#1D9E75', libelle: 'Turquoise' },
  rose: { fond: '#FBEAF0', texte: '#72243E', accent: '#D4537E', libelle: 'Rose' },
  orange: { fond: '#FAEEDA', texte: '#633806', accent: '#EF9F27', libelle: 'Orange' },
  violet: { fond: '#EEEDFE', texte: '#3C3489', accent: '#7F77DD', libelle: 'Violet' },
  vert: { fond: '#EAF3DE', texte: '#27500A', accent: '#639922', libelle: 'Vert' },
}
export const couleurEdition = (c: string) => COULEURS_EDITION[c] ?? COULEURS_EDITION.bleu

/** Texte par défaut de l'encadré « On veut vous lire ! » (repris de l'édition 3) */
export const APPEL_DEFAUT = {
  titre: 'On veut vous lire !',
  texte: 'Pas besoin d’être une personne qui aime écrire ou d’avoir une idée d’article déjà toute prête. Une simple suggestion de sujet, une nouvelle pratique à faire connaître, un conseil en santé et sécurité, une recette à partager, quelques photos d’une activité ou encore une initiative inspirante peuvent suffire.\n\nAlors, si une idée vous passe par la tête, même toute simple, n’hésitez pas à nous l’envoyer. Le prochain article pourrait bien commencer avec vous ! Les membres de l’équipe journal sont : Amman Y., Azadeh A., Delphine C., Farah M., Luiza B. et Marine C.',
}
export type AppelPasserelle = typeof APPEL_DEFAUT

/** Administrateurs qui voient le WSSC : déposent les éditions et voient les brouillons. */
export function peutGererPasserelle(a: { role: string; clinique: string | null } | null): boolean {
  if (!a || !estAdministrateur(a.role)) return false
  return a.role === 'super_admin' || cliniquesDe(a.clinique).includes(CLINIQUE_PASSERELLE)
}

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const entier = (v: unknown, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null }

/** Une ligne de sommaire par ligne : « Titre | 3 » (le numéro de page est facultatif). */
export function lireSommaire(v: unknown): LigneSommaire[] {
  const lignes = Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : `${x?.titre ?? ''}|${x?.page ?? ''}`)) : String(v ?? '').split(/\r?\n/)
  return lignes.map(l => {
    const m = /^(.*?)\s*\|\s*(\d{1,3})\s*$/.exec(l.trim())
    return m ? { titre: m[1].trim(), page: Number(m[2]) } : { titre: l.trim(), page: null }
  }).filter(l => l.titre).slice(0, 15).map(l => ({ titre: l.titre.slice(0, 200), page: l.page }))
}

export function lireEdition(c: Record<string, unknown>): { valeurs: Omit<Edition, 'id'> } | { erreur: string } {
  const numero = entier(c.numero, 1, 999)
  if (!numero) return { erreur: 'Le numéro de l’édition est requis.' }
  const date = texte(c.date_parution, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: 'La date de parution est requise.' }
  const pdf = texte(c.pdf, 500)
  if (!pdf.startsWith('media:')) return { erreur: 'Déposez le PDF de l’édition.' }
  const couverture = texte(c.couverture, 500)
  return { valeurs: {
    numero, volume: entier(c.volume, 1, 99) ?? 1, date_parution: date, temps_lecture: entier(c.temps_lecture, 1, 240),
    accroche: texte(c.accroche, 400), sommaire: lireSommaire(c.sommaire),
    couleur: COULEURS_EDITION[String(c.couleur)] ? String(c.couleur) : 'bleu',
    pdf, couverture: couverture.startsWith('media:') ? couverture : '', publie: c.publie === true,
  } }
}

/** Éditions, de la plus récente à la plus ancienne (brouillons : administrateurs). */
export async function chargerEditions(sb: SupabaseClient, brouillons: boolean): Promise<{ editions: Edition[]; migration?: boolean }> {
  let q = sb.from('passerelle_editions').select('*').eq('clinique', CLINIQUE_PASSERELLE).order('date_parution', { ascending: false }).order('numero', { ascending: false })
  if (!brouillons) q = q.eq('publie', true)
  const { data, error } = await q
  if (error) return { editions: [], migration: /passerelle/.test(error.message) }
  return { editions: (data ?? []) as Edition[] }
}

export async function chargerAppel(sb: SupabaseClient): Promise<AppelPasserelle> {
  const { data, error } = await sb.from('reglages').select('valeur').eq('cle', CLE_APPEL_PASSERELLE).maybeSingle()
  if (error || !data?.valeur) return APPEL_DEFAUT
  const v = data.valeur as Record<string, unknown>
  return { titre: texte(v.titre, 120) || APPEL_DEFAUT.titre, texte: texte(v.texte, 3000) }
}

/** Nom du fichier téléchargé : « La Passerelle — Édition 4 (2026-09-08).pdf » */
export const nomFichier = (e: Pick<Edition, 'numero' | 'date_parution'>) => `La Passerelle - Edition ${e.numero} (${e.date_parution}).pdf`

/** Repère dans le texte de la page 1 : date, volume, numéro et temps de lecture (pré-remplissage du formulaire). */
export function infosCouverture(texte: string): { date_parution?: string; volume?: number; numero?: number; temps_lecture?: number } {
  const t = texte.replace(/\s+/g, ' ')
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  const r: { date_parution?: string; volume?: number; numero?: number; temps_lecture?: number } = {}
  const d = new RegExp(`(\\d{1,2})(?:er)?\\s+(${MOIS.join('|')})\\s+(\\d{4})`, 'i').exec(t)
  if (d) r.date_parution = `${d[3]}-${String(MOIS.indexOf(d[2].toLowerCase()) + 1).padStart(2, '0')}-${d[1].padStart(2, '0')}`
  const v = /Volume\s*(\d{1,2})/i.exec(t); if (v) r.volume = Number(v[1])
  const n = /[ÉE]dition\s*(\d{1,3})/i.exec(t); if (n) r.numero = Number(n[1])
  const m = /environ\s+(\d{1,3})\s+minutes/i.exec(t); if (m) r.temps_lecture = Number(m[1])
  return r
}
