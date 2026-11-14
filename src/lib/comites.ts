// « Apprenez à connaître vos comités » : comités du WSSC présentés aux employés.
//  - Les administrateurs créent et modifient les comités (Administration → Comités).
//  - Un comité en brouillon n'est visible que des administrateurs (aperçu dans leur espace employé).
//  - Un membre peut être un employé de la plateforme (nom et poste à jour) ou une personne saisie librement.
import type { SupabaseClient } from '@supabase/supabase-js'
import { estAdministrateur, cliniquesDe } from '@/lib/cliniques'

export const CLINIQUE_COMITES = 'WSSC'

export const messageMigration = (m: string) => /comites/.test(m) ? 'Exécutez d’abord supabase/migrations/comites.sql dans Supabase.' : m

export type MembreComite = { employe_id: string | null; nom: string; poste: string; role: string }
export type Comite = {
  id: string; clinique: string; nom: string; icone: string; couleur: string
  presentation: string; description: string; activites: string; utilite: string; contact: string
  membres: MembreComite[]; ordre: number; publie: boolean; modifie_le?: string
}
export type DonneesComite = Omit<Comite, 'id' | 'clinique' | 'modifie_le'>

/** Couleurs proposées (fond clair, texte foncé) */
export const COULEURS_COMITE: Record<string, { fond: string; texte: string; bord: string; libelle: string }> = {
  violet: { fond: '#EEEDFE', texte: '#3C3489', bord: '#7F77DD', libelle: 'Violet' },
  turquoise: { fond: '#E1F5EE', texte: '#085041', bord: '#1D9E75', libelle: 'Turquoise' },
  rose: { fond: '#FBEAF0', texte: '#72243E', bord: '#D4537E', libelle: 'Rose' },
  bleu: { fond: '#E6F1FB', texte: '#0C447C', bord: '#378ADD', libelle: 'Bleu' },
  ambre: { fond: '#FAEEDA', texte: '#633806', bord: '#BA7517', libelle: 'Ambre' },
  corail: { fond: '#FAECE7', texte: '#712B13', bord: '#D85A30', libelle: 'Corail' },
}
export const couleurDe = (c: string) => COULEURS_COMITE[c] ?? COULEURS_COMITE.violet

/** Administrateurs qui voient le WSSC : gèrent les comités et en voient les brouillons. */
export function peutGererComites(a: { role: string; clinique: string | null } | null): boolean {
  if (!a || !estAdministrateur(a.role)) return false
  return a.role === 'super_admin' || cliniquesDe(a.clinique).includes(CLINIQUE_COMITES)
}

/** Initiales pour la pastille d'un membre */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/[\s-]+/).filter(Boolean)
  return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Valide ce qu'envoie le formulaire d'administration. */
export function lireComite(c: Record<string, unknown>): { valeurs: DonneesComite } | { erreur: string } {
  const nom = texte(c.nom, 150)
  if (!nom) return { erreur: 'Le nom du comité est requis.' }
  const membres = (Array.isArray(c.membres) ? c.membres : []).slice(0, 60).map((m: Record<string, unknown>) => ({
    employe_id: typeof m?.employe_id === 'string' && /^[0-9a-f-]{36}$/i.test(m.employe_id) ? m.employe_id : null,
    nom: texte(m?.nom, 120), poste: texte(m?.poste, 150), role: texte(m?.role, 150),
  })).filter(m => m.employe_id || m.nom)
  return { valeurs: {
    nom, icone: texte(c.icone, 8) || '🤝', couleur: COULEURS_COMITE[String(c.couleur)] ? String(c.couleur) : 'violet',
    presentation: texte(c.presentation, 300), description: texte(c.description, 5000), activites: texte(c.activites, 5000),
    utilite: texte(c.utilite, 5000), contact: texte(c.contact, 500), membres,
    ordre: Number.isFinite(Number(c.ordre)) ? Math.round(Number(c.ordre)) : 0, publie: c.publie === true,
  } }
}

/** Comités visibles : publiés seulement, ou aussi les brouillons (administrateurs). Membres de la plateforme : nom et poste à jour. */
export async function chargerComites(sb: SupabaseClient, options: { brouillons: boolean; id?: string }): Promise<{ comites: Comite[]; migration?: boolean }> {
  let q = sb.from('comites').select('*').eq('clinique', CLINIQUE_COMITES).order('ordre').order('nom')
  if (!options.brouillons) q = q.eq('publie', true)
  if (options.id) q = q.eq('id', options.id)
  const { data, error } = await q
  if (error) return { comites: [], migration: /comites/.test(error.message) }
  const comites = (data ?? []) as Comite[]
  const ids = Array.from(new Set(comites.flatMap(c => (c.membres ?? []).map(m => m.employe_id)).filter(Boolean) as string[]))
  if (ids.length) {
    const { data: emps } = await sb.from('employes').select('id, prenom, nom, poste, actif').in('id', ids)
    const parId = new Map((emps ?? []).map(e => [e.id as string, e]))
    for (const c of comites) {
      c.membres = (c.membres ?? []).flatMap(m => {
        const e = m.employe_id ? parId.get(m.employe_id) : null
        if (m.employe_id && e && e.actif === false) return []
        return [e ? { ...m, nom: [e.prenom, e.nom].filter(Boolean).join(' ') || m.nom, poste: m.poste || (e.poste ?? '') } : m]
      })
    }
  }
  return { comites }
}

/** Le menu « Comités » s'affiche-t-il ? (espace WSSC et au moins un comité visible) */
export async function aDesComites(sb: SupabaseClient, brouillons: boolean): Promise<boolean> {
  let q = sb.from('comites').select('id', { count: 'exact', head: true }).eq('clinique', CLINIQUE_COMITES)
  if (!brouillons) q = q.eq('publie', true)
  const { count, error } = await q
  return !error && (count ?? 0) > 0
}

/** Bannière « comités » de la page d'accueil (espace WSSC), modifiable dans Administration → Comités. */
export type BanniereComites = { titre: string; texte: string; image: string }
export const BANNIERE_COMITES_DEFAUT: BanniereComites = {
  titre: 'Apprenez à connaître vos comités',
  texte: 'Les comités du WSSC : ce qu’ils font, à quoi ils servent et qui en fait partie.',
  image: '',
}
export const CLE_BANNIERE_COMITES = 'banniere_comites'

/** Valide la bannière envoyée par le formulaire (image : adresse https:// ou chemin /…). */
export function lireBanniere(c: Record<string, unknown>): BanniereComites {
  const image = texte(c.image, 1000)
  return {
    titre: texte(c.titre, 120) || BANNIERE_COMITES_DEFAUT.titre,
    texte: texte(c.texte, 300),
    image: /^(https:\/\/|\/)/.test(image) ? image : '',
  }
}

export async function chargerBanniereComites(sb: SupabaseClient): Promise<BanniereComites & { reglagesAbsents?: boolean }> {
  const { data, error } = await sb.from('reglages').select('valeur').eq('cle', CLE_BANNIERE_COMITES).maybeSingle()
  if (error) return { ...BANNIERE_COMITES_DEFAUT, reglagesAbsents: /reglages/.test(error.message) }
  return data?.valeur ? lireBanniere(data.valeur as Record<string, unknown>) : BANNIERE_COMITES_DEFAUT
}
