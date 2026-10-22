'use server'

// Suivi d'une leçon par l'employé : vidéos obligatoires vues, « J'ai lu et compris », leçon terminée.
// Les écritures passent par le serveur (clé de service) après identification de l'employé connecté.

import { headers } from 'next/headers'
import { getActeur, serviceClient } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { texteAttestationDefaut } from '@/lib/suivi-constantes'
import { langueCourante } from '@/lib/i18n/serveur'
import { prerequisManquants, messagePrerequis } from '@/lib/prerequis'
import { aAccesAdmin } from '@/lib/cliniques'


export type EtatSuivi = {
  videosVues: string[]
  attestationLe: string | null
  termineeLe: string | null
}

type Resultat<T = undefined> = { ok: true; data?: T } | { ok: false; erreur: string }

async function contexte() {
  const acteur = await getActeur()
  if (!acteur) return null
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '').split(',')[0].trim() || null
  return { acteur, ip, ua: h.get('user-agent') }
}

export async function getEtatSuivi(lessonId: string): Promise<EtatSuivi> {
  const acteur = await getActeur()
  const vide: EtatSuivi = { videosVues: [], attestationLe: null, termineeLe: null }
  if (!acteur) return vide
  const sb = serviceClient()
  const [{ data: preuves }, { data: prog }] = await Promise.all([
    sb.from('preuves_lecture').select('type, bloc_id, created_at').eq('employe_id', acteur.id).eq('lesson_id', lessonId),
    sb.from('lesson_progressions').select('statut, date_fin').eq('employe_id', acteur.id).eq('lesson_id', lessonId).maybeSingle(),
  ])
  return {
    videosVues: (preuves ?? []).filter(p => p.type === 'video_complete' && p.bloc_id).map(p => p.bloc_id as string),
    attestationLe: (preuves ?? []).find(p => p.type === 'attestation')?.created_at ?? null,
    termineeLe: prog?.statut === 'termine' ? (prog.date_fin ?? new Date().toISOString()) : null,
  }
}

/** Une vidéo obligatoire a été regardée en entier. */
export async function enregistrerVideoVue(blocId: string): Promise<Resultat> {
  const ctx = await contexte()
  if (!ctx) return { ok: false, erreur: 'Non authentifié' }
  const sb = serviceClient()
  const { data: bloc } = await sb.from('content_blocks').select('id, lesson_id, type').eq('id', blocId).single()
  if (!bloc || bloc.type !== 'video') return { ok: false, erreur: 'Vidéo introuvable' }
  const { error } = await sb.from('preuves_lecture').insert({
    employe_id: ctx.acteur.id, lesson_id: bloc.lesson_id, bloc_id: blocId, type: 'video_complete',
    ip_address: ctx.ip, user_agent: ctx.ua,
  })
  // Déjà enregistrée : l'index unique renvoie l'erreur 23505, sans gravité
  if (error && error.code !== '23505') return { ok: false, erreur: error.message }
  return { ok: true }
}

/** « J'ai lu et compris » : horodaté, avec le texte exact accepté, et inscrit au journal d'audit. */
export async function attesterLecture(lessonId: string): Promise<Resultat<string>> {
  const ctx = await contexte()
  if (!ctx) return { ok: false, erreur: 'Non authentifié' }
  const sb = serviceClient()
  const { data: lecon } = await sb.from('lessons').select('id, titre, attestation_requise, texte_attestation').eq('id', lessonId).single()
  if (!lecon) return { ok: false, erreur: 'Leçon introuvable' }
  const texte = lecon.texte_attestation?.trim() || texteAttestationDefaut(await langueCourante())

  const { data: existante } = await sb.from('preuves_lecture').select('created_at')
    .eq('employe_id', ctx.acteur.id).eq('lesson_id', lessonId).eq('type', 'attestation').maybeSingle()
  if (existante) return { ok: true, data: existante.created_at }

  const { data, error } = await sb.from('preuves_lecture').insert({
    employe_id: ctx.acteur.id, lesson_id: lessonId, type: 'attestation', texte,
    ip_address: ctx.ip, user_agent: ctx.ua,
  }).select('created_at').single()
  if (error) return { ok: false, erreur: error.message }

  await logAudit({
    acteur_id: ctx.acteur.id,
    type_action: 'ATTESTATION_LECTURE',
    description: `Attestation « J'ai lu et compris » : ${lecon.titre}`,
    cible_employe_id: ctx.acteur.id,
    metadata: { lesson_id: lessonId, texte },
    ip_address: ctx.ip,
    user_agent: ctx.ua,
  })
  return { ok: true, data: data.created_at }
}

/** Termine la leçon si toutes les exigences sont remplies (vidéos obligatoires, attestation). */
export async function terminerLecon(lessonId: string): Promise<Resultat<string> & { manquants?: string[] }> {
  const ctx = await contexte()
  if (!ctx) return { ok: false, erreur: 'Non authentifié' }
  const sb = serviceClient()
  const { data: lecon } = await sb.from('lessons').select('id, titre, attestation_requise').eq('id', lessonId).single()
  if (!lecon) return { ok: false, erreur: 'Leçon introuvable' }

  // Prérequis bloquants (l'équipe garde l'accès pour prévisualiser)
  if (!aAccesAdmin(ctx.acteur)) {
    const { data: mod } = await sb.from('lessons').select('modules(formation_id)').eq('id', lessonId).single()
    const formationId = (mod?.modules as { formation_id?: string } | null)?.formation_id
    if (formationId) {
      const manquants = await prerequisManquants(sb, ctx.acteur.id, formationId)
      if (manquants.length) return { ok: false, erreur: messagePrerequis(manquants) }
    }
  }

  const [{ data: blocs }, etat] = await Promise.all([
    sb.from('content_blocks').select('id, titre, type, metadata').eq('lesson_id', lessonId),
    getEtatSuivi(lessonId),
  ])
  const manquants: string[] = []
  for (const b of blocs ?? []) {
    const obligatoire = b.type === 'video' && (b.metadata as Record<string, unknown> | null)?.obligatoire === true
    if (obligatoire && !etat.videosVues.includes(b.id)) manquants.push(`Regarder la vidéo « ${b.titre || 'sans titre'} » en entier`)
  }
  if (lecon.attestation_requise && !etat.attestationLe) manquants.push("Cocher « J'ai lu et compris »")
  if (manquants.length) return { ok: false, erreur: 'Leçon incomplète', manquants }

  if (etat.termineeLe) return { ok: true, data: etat.termineeLe }
  const maintenant = new Date().toISOString()
  const { error } = await sb.from('lesson_progressions').upsert({
    employe_id: ctx.acteur.id, lesson_id: lessonId, statut: 'termine', pourcentage_complete: 100, date_fin: maintenant,
  }, { onConflict: 'employe_id,lesson_id' })
  if (error) return { ok: false, erreur: error.message }

  await logAudit({
    acteur_id: ctx.acteur.id,
    type_action: 'LECON_TERMINEE',
    description: `Leçon terminée : ${lecon.titre}`,
    cible_employe_id: ctx.acteur.id,
    metadata: { lesson_id: lessonId },
    ip_address: ctx.ip,
    user_agent: ctx.ua,
  })
  return { ok: true, data: maintenant }
}
