import { describe, it, expect } from 'vitest'
import { feuillesDossiers, statutPreuve, type Dossier } from '@/lib/dossier-employe'

const dossier = (prenom: string, journal = false): Dossier => ({
  profil: { id: prenom, prenom, nom: 'Test', email: `${prenom}@x.ca`, poste: '', role: 'employe', role_libelle: 'Employé', clinique: 'CMC', departement: 'Bloc', date_embauche: null, actif: true, invitation_acceptee: true, cree_le: null },
  formations: [{ formation_id: 'f', titre: 'Hygiène', obligatoire: true, assignee_le: '2026-01-01', echeance: '2026-02-01', en_retard: true, statut: 'en_cours', statut_libelle: 'En cours', progression: 40, lecons: '2/5', certificat: '' }],
  lecons: [], certificats: [], preuves: [], politiques: [],
  journal: journal ? [{ date: '2026-01-01T10:00:00Z', action: 'Connexion', description: '', par: prenom }] : [],
})

describe('Dossier employé', () => {
  it('un employé : feuilles du dossier, sans colonne « Employé »', () => {
    const f = feuillesDossiers([dossier('Ana')])
    expect(f.map(x => x.nom)).toEqual(['Profil', 'Formations', 'Leçons', 'Certificats', 'Preuves externes', 'Politiques'])
    expect(f[1].colonnes[0].titre).toBe('Formation')
  })

  it('plusieurs employés : colonne « Employé » en tête, lignes de chacun', () => {
    const f = feuillesDossiers([dossier('Ana'), dossier('Léo', true)])
    const formations = f.find(x => x.nom === 'Formations')!
    expect(formations.colonnes[0].titre).toBe('Employé')
    expect(formations.lignes).toHaveLength(2)
    expect(f.some(x => x.nom === 'Journal')).toBe(true)
  })

  it('normalise les statuts de preuve', () => {
    expect(statutPreuve('validee')).toBe('valide')
    expect(statutPreuve('refuse')).toBe('refuse')
    expect(statutPreuve(null)).toBe('en_attente')
  })
})
