// Validation des catégories de politiques (côté serveur).
import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliserCode } from '@/lib/politiques-categories'

export async function validerCategorie(sb: SupabaseClient, c: Record<string, unknown>, id?: string) {
  const code = normaliserCode(c.code)
  if (code.length < 2) return { erreur: 'Le code doit contenir au moins 2 lettres (ex. MED, CON).' }
  const nom = String(c.nom ?? '').trim().slice(0, 80)
  if (!nom) return { erreur: 'Le nom de la catégorie est obligatoire.' }
  const emoji = String(c.emoji ?? '').trim().slice(0, 8) || null
  const departements = Array.isArray(c.departements) ? Array.from(new Set(c.departements.map(String))) : []
  if (departements.length) {
    const { data } = await sb.from('departements').select('id').in('id', departements)
    if ((data ?? []).length !== departements.length) return { erreur: 'Département inconnu' }
  }
  const { data: meme } = await sb.from('politiques_categories').select('id').eq('code', code)
  if ((meme ?? []).some(x => x.id !== id)) return { erreur: `Le code ${code} est déjà utilisé.` }
  return { valeurs: { code, nom, emoji, departements } }
}
