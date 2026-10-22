import { describe, it, expect } from 'vitest'
import { placesRestantes, statutPourNouvelleInscription, premierEnAttente, peutSeDesinscrire, seanceOuverte, fichierIcs, estInvite } from '@/lib/evenements'

const s = { id: 's1', places: 2, debut: '2030-05-01T13:00:00Z', fin: '2030-05-01T15:00:00Z', annulee: false, lieu: null }
const ins = (statut: 'inscrit' | 'attente' | 'annule', le = '2030-01-01T00:00:00Z') => ({ seance_id: 's1', statut, inscrit_le: le })

describe('places et liste d’attente', () => {
  it('compte seulement les inscrits', () => {
    expect(placesRestantes(s, [ins('inscrit'), ins('attente'), ins('annule')])).toBe(1)
    expect(statutPourNouvelleInscription(s, [ins('inscrit')])).toBe('inscrit')
    expect(statutPourNouvelleInscription(s, [ins('inscrit'), ins('inscrit')])).toBe('attente')
  })
  it('le premier en attente est le plus ancien', () => {
    const a = ins('attente', '2030-01-02T00:00:00Z'), b = ins('attente', '2030-01-01T00:00:00Z')
    expect(premierEnAttente('s1', [a, b])).toBe(b)
    expect(premierEnAttente('s1', [ins('inscrit')])).toBeNull()
  })
})

describe('dates', () => {
  const maintenant = new Date('2030-04-30T12:00:00Z')
  it('désinscription jusqu’à X heures avant', () => {
    expect(peutSeDesinscrire(s, 24, maintenant)).toBe(true)
    expect(peutSeDesinscrire(s, 48, maintenant)).toBe(false)
  })
  it('séance ouverte si future et non annulée', () => {
    expect(seanceOuverte(s, maintenant)).toBe(true)
    expect(seanceOuverte({ ...s, annulee: true }, maintenant)).toBe(false)
    expect(seanceOuverte(s, new Date('2030-06-01'))).toBe(false)
  })
})

describe('calendrier', () => {
  it('génère un .ics valide', () => {
    const t = fichierIcs({ id: 'e', titre: 'Formation, incendie', description: 'Ligne 1\nLigne 2', lieu: 'Salle A' }, s, 'https://x/y')
    expect(t).toContain('DTSTART:20300501T130000Z')
    expect(t).toContain('SUMMARY:Formation\\, incendie')
    expect(t).toContain('LOCATION:Salle A')
    expect(t.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})

describe('invitation', () => {
  it('même ciblage que les politiques', () => {
    const ev = { clinique: 'WSSC' as const, departements: [], employes: [], roles: [], postes: ['Infirmière auxiliaire'] }
    expect(estInvite(ev, { clinique: 'WSSC', departement_id: null, poste: 'infirmière auxiliaire' })).toBe(true)
    expect(estInvite(ev, { clinique: 'CMC', departement_id: null, poste: 'Infirmière auxiliaire' })).toBe(false)
  })
})
