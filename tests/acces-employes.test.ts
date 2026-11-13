import { describe, it, expect } from 'vitest'
import { etatAcces, courrielParti, type LogInvitation } from '@/lib/acces-employes'

const log = (type_action: string, description: string, metadata: Record<string, unknown> | null, created_at: string): LogInvitation =>
  ({ cible_employe_id: 'e1', type_action, description, metadata, created_at })

describe('accès des employés', () => {
  it('import sans invitation : jamais invité', () => {
    const r = etatAcces({ derniereConnexion: null, logs: [log('EMPLOYE_CREE', 'Nouvel employé importé', { invitation_envoyee: false, invitation_differee: true }, '2026-11-11T10:00:00Z')] })
    expect(r).toEqual({ etat: 'jamais', date: null, derniereConnexion: null })
  })

  it('lien copié par un administrateur : pas un courriel', () => {
    expect(courrielParti(log('INVITATION_ENVOYEE', 'Lien d\'accès au portail copié par un administrateur pour A B', null, '2026-11-12T10:00:00Z'))).toBe(false)
  })

  it('invitation renvoyée par courriel : invité, à la date du dernier envoi', () => {
    const r = etatAcces({ derniereConnexion: null, logs: [
      log('EMPLOYE_CREE', 'Nouvel employé créé', { invitation_envoyee: true }, '2026-11-01T10:00:00Z'),
      log('INVITATION_ENVOYEE', 'Lien d\'accès au portail envoyé par courriel pour A B', null, '2026-11-13T19:40:00Z'),
    ] })
    expect(r.etat).toBe('invite')
    expect(r.date).toBe('2026-11-13T19:40:00Z')
  })

  it('mot de passe oublié non envoyé : ne compte pas', () => {
    expect(courrielParti(log('INVITATION_ENVOYEE', 'Mot de passe oublié : le courriel n’a pas pu être envoyé', { motif: 'mdp_oublie', envoye: false }, '2026-11-13T10:00:00Z'))).toBe(false)
  })

  it('déjà connecté : activé, à la date du premier lien utilisé', () => {
    const r = etatAcces({ derniereConnexion: '2026-11-13T12:00:00Z', lienUtiliseLe: '2026-11-05T09:00:00Z', logs: [
      log('INVITATION_ENVOYEE', 'Compte activé : mot de passe choisi depuis le lien d’invitation', null, '2026-11-05T09:00:01Z'),
    ] })
    expect(r).toEqual({ etat: 'active', date: '2026-11-05T09:00:00Z', derniereConnexion: '2026-11-13T12:00:00Z' })
  })

  it('connecté sans trace d’activation : date de la dernière connexion', () => {
    const r = etatAcces({ derniereConnexion: '2026-10-01T12:00:00Z', logs: [] })
    expect(r.etat).toBe('active')
    expect(r.date).toBe('2026-10-01T12:00:00Z')
  })
  it('compte ancien sans lien d’invitation : date de la première connexion du journal', () => {
    const r = etatAcces({ derniereConnexion: '2026-11-11T14:46:38Z', logs: [], connexionsJournal: { premiere: '2026-05-29T21:02:29Z', derniere: '2026-11-13T15:00:00Z' } })
    expect(r).toEqual({ etat: 'active', date: '2026-05-29T21:02:29Z', derniereConnexion: '2026-11-13T15:00:00Z' })
  })
  it('mot de passe choisi mais jamais connecté : activé, à la date d’activation', () => {
    const r = etatAcces({ derniereConnexion: null, logs: [
      log('INVITATION_ENVOYEE', 'Lien d\'accès au portail envoyé par courriel pour A B', null, '2026-11-13T19:39:22Z'),
      log('INVITATION_ENVOYEE', 'Compte activé : mot de passe choisi depuis le lien d’invitation', null, '2026-11-13T22:31:03Z'),
    ] })
    expect(r).toEqual({ etat: 'active', date: '2026-11-13T22:31:03Z', derniereConnexion: null })
  })
})
