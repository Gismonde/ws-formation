// Page d'accueil de l'espace employé, propre à chaque clinique (photos, liens, informations).
// Contenu modifiable par les administrateurs (table pages_accueil) ; à défaut, contenu par défaut ci-dessous.
import type { Clinique } from '@/lib/cliniques'

export type CarteAccueil = { titre: string; texte: string; image: string; lien: string }
export type PhotoAccueil = { url: string; legende: string }

export type ContenuAccueil = {
  banniere: { titre: string; texte: string; image: string }
  cartes: CarteAccueil[]
  visite: { titre: string; texte: string; photos: PhotoAccueil[] }
  infos: string
}

// Photos de l’aménagement du WSSC (Entre Quatre Murs / Espace 313), hébergées dans le stockage de la plateforme
const B_WSSC = 'https://vtuegggoruiowjxoiocd.supabase.co/storage/v1/object/public/lesson-images/cdee052a-af6e-4209-a182-5f9aa074abf9/'
const photosWssc = [
  { url: B_WSSC + '1792597624209.webp', legende: 'Accueil' },
  { url: B_WSSC + '1792597627366.webp', legende: 'Réception' },
  { url: B_WSSC + '1792597629056.webp', legende: 'Salle d’attente' },
  { url: B_WSSC + '1792597631315.webp', legende: 'Coin café' },
  { url: B_WSSC + '1792597634377.webp', legende: 'Bibliothèque' },
  { url: B_WSSC + '1792597641381.webp', legende: 'Salle de réunion' },
  { url: B_WSSC + '1792597644117.webp', legende: 'Salon des patients' },
  { url: B_WSSC + '1792597648047.webp', legende: 'Salle de réunion — mur terracotta' },
  { url: B_WSSC + '1792597654000.webp', legende: 'Bureau de consultation' },
  { url: B_WSSC + '1792597658524.webp', legende: 'Salon près des fenêtres' },
  { url: B_WSSC + '1792597660158.webp', legende: 'Vestiaire' },
  { url: B_WSSC + '1792597662415.webp', legende: 'Salle de traitement' },
  { url: B_WSSC + '1792597663504.webp', legende: 'Corridor vers la salle d’examen' },
  { url: B_WSSC + '1792597665360.webp', legende: 'Corridor' },
]

// Galerie « Enjoyable interior and experience » de wssurgical.com/about-us (images hébergées par le WSSC)
const galerieWssc = [
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy0xLmpwZw==?fm=webp&s=4453a36bcfbf9a87e788700000452796',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy01LnBuZw==?fm=webp&s=6f675ac171752e55f3982f586081705a',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy05LnBuZw==?fm=webp&s=94476364967c778670502c51936eaf1a',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy0xMy5wbmc=?fm=webp&s=8a0374c4c1bbb39ef1e5bff9eaed759a',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy0yLnBuZw==?fm=webp&s=5e7a98a398fca569628c4620db780955',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy02LnBuZw==?fm=webp&s=0d2d0305035726e2ac1485583025591e',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy0xMC5wbmc=?fm=webp&s=ea0b1fa656968d1b322d165346e4fef0',
  'YXNzZXRzL2ltYWdlcy93b3JrLXNwYWNlLWltZy0xNC5wbmc=?fm=webp&s=23f92dc3e1ed7680e566e3dbed315211',
].map(c => ({ url: `https://wssurgical.com/img/asset/${c}`, legende: '' }))

export const ACCUEIL_PAR_DEFAUT: Record<Clinique, ContenuAccueil> = {
  CMC: {
    banniere: {
      titre: 'Bienvenue au Centre Métropolitain de Chirurgie',
      texte: 'Votre portail de formation : retrouvez vos formations, les politiques et les procédures de la clinique, et découvrez nos installations.',
      image: '/cliniques/cmc/entree.webp',
    },
    cartes: [
      { titre: 'Visite virtuelle', texte: 'Découvrez nos installations en photos.', image: '/cliniques/cmc/visite-virtuelle.webp', lien: '#visite' },
      { titre: 'Nos installations', texte: 'Le Centre Métropolitain de Chirurgie sur le site de GrS Montréal.', image: '/cliniques/cmc/exterieur.webp', lien: 'https://www.grsmontreal.com/en/nos-installations/centre-metropolitain-de-chirurgie.html' },
      { titre: 'Bibliothèque', texte: 'Procédures (SOP) et documents de référence.', image: '/cliniques/cmc/bibliotheque.webp', lien: '/dashboard/sop' },
      { titre: 'Blogue Transavenue', texte: 'Articles et actualités sur l’affirmation de genre.', image: '/cliniques/cmc/questions.webp', lien: 'https://blog.grsmontreal.com/' },
    ],
    visite: {
      titre: 'Visite virtuelle',
      texte: 'Un aperçu des lieux où vous travaillez.',
      photos: [
        { url: '/cliniques/cmc/hall-information.webp', legende: 'Hall d’entrée et information' },
        { url: '/cliniques/cmc/consultation.webp', legende: 'Consultation' },
        { url: '/cliniques/cmc/unite-de-soins.webp', legende: 'Unité de soins' },
        { url: '/cliniques/cmc/salle-operation.webp', legende: 'Salle d’opération' },
        { url: '/cliniques/cmc/chambre.webp', legende: 'Chambre' },
        { url: '/cliniques/cmc/exterieur.webp', legende: 'Extérieur' },
      ],
    },
    infos: '',
  },
  WSSC: {
    banniere: {
      titre: 'Bienvenue au Westmount Square Surgical Center',
      texte: 'Votre portail de formation : retrouvez vos formations, les politiques et les procédures de la clinique, et découvrez nos installations.',
      image: B_WSSC + '1792597627366.webp',
    },
    cartes: [
      { titre: 'Visite virtuelle', texte: 'Découvrez nos installations en photos.', image: B_WSSC + '1792597624209.webp', lien: '#visite' },
      { titre: 'Site du WSSC', texte: 'Chirurgies, informations aux patients et articles.', image: B_WSSC + '1792597654000.webp', lien: 'https://wssurgical.com/' },
      { titre: 'Bibliothèque', texte: 'Procédures (SOP) et documents de référence.', image: B_WSSC + '1792597634377.webp', lien: '/dashboard/sop' },
      { titre: 'À propos', texte: 'Notre équipe et nos salles d’opération.', image: B_WSSC + '1792597662415.webp', lien: 'https://wssurgical.com/about-us' },
    ],
    visite: {
      titre: 'Visite virtuelle',
      texte: 'Un aperçu des lieux où vous travaillez.',
      photos: [
        ...photosWssc,
        ...galerieWssc,
      ],
    },
    infos: '1 Westmount Square, bureau C190, Westmount (Québec) H3Z 2P9 · 514 931-5055',
  },
}

// Version anglaise par défaut (mêmes photos et liens)
const traduireDefaut = (c: ContenuAccueil, t: Record<string, string>): ContenuAccueil => ({
  banniere: { ...c.banniere, titre: t[c.banniere.titre] ?? c.banniere.titre, texte: t[c.banniere.texte] ?? c.banniere.texte },
  cartes: c.cartes.map(k => ({ ...k, titre: t[k.titre] ?? k.titre, texte: t[k.texte] ?? k.texte })),
  visite: { titre: t[c.visite.titre] ?? c.visite.titre, texte: t[c.visite.texte] ?? c.visite.texte, photos: c.visite.photos.map(p => ({ ...p, legende: t[p.legende] ?? p.legende })) },
  infos: c.infos,
})
const ACCUEIL_EN: Record<string, string> = {
  'Bienvenue au Centre Métropolitain de Chirurgie': 'Welcome to the Centre Métropolitain de Chirurgie',
  'Bienvenue au Westmount Square Surgical Center': 'Welcome to the Westmount Square Surgical Center',
  'Votre portail de formation : retrouvez vos formations, les politiques et les procédures de la clinique, et découvrez nos installations.':
    'Your training portal: find your trainings, the clinic’s policies and procedures, and discover our facilities.',
  'Visite virtuelle': 'Virtual tour',
  'Découvrez nos installations en photos.': 'Discover our facilities in pictures.',
  'Nos installations': 'Our facilities',
  'Le Centre Métropolitain de Chirurgie sur le site de GrS Montréal.': 'The Centre Métropolitain de Chirurgie on the GrS Montréal website.',
  'Bibliothèque': 'Library',
  'Procédures (SOP) et documents de référence.': 'Procedures (SOPs) and reference documents.',
  'Blogue Transavenue': 'Transavenue blog',
  'Articles et actualités sur l’affirmation de genre.': 'Articles and news about gender affirmation.',
  'Site du WSSC': 'WSSC website',
  'Chirurgies, informations aux patients et articles.': 'Surgeries, patient information and articles.',
  'À propos': 'About us',
  'Notre équipe et nos salles d’opération.': 'Our team and our operating rooms.',
  'Un aperçu des lieux où vous travaillez.': 'A look at the place where you work.',
  'Hall d’entrée et information': 'Entrance hall and information',
  'Consultation': 'Consultation',
  'Unité de soins': 'Care unit',
  'Salle d’opération': 'Operating room',
  'Chambre': 'Patient room',
  'Extérieur': 'Exterior',
  'Salon': 'Lounge',
  'Entrée': 'Entrance',
  'Salle de réveil': 'Recovery room',
  'Accueil': 'Front desk',
  'Réception': 'Reception',
  'Salle d’attente': 'Waiting room',
  'Coin café': 'Coffee corner',
  'Salle de réunion': 'Meeting room',
  'Salon des patients': 'Patient lounge',
  'Salle de réunion — mur terracotta': 'Meeting room — terracotta wall',
  'Bureau de consultation': 'Consultation office',
  'Salon près des fenêtres': 'Lounge by the windows',
  'Vestiaire': 'Locker room',
  'Salle de traitement': 'Treatment room',
  'Corridor vers la salle d’examen': 'Hallway to the exam room',
  'Corridor': 'Hallway',
}
export const ACCUEIL_PAR_DEFAUT_EN: Record<Clinique, ContenuAccueil> = {
  CMC: traduireDefaut(ACCUEIL_PAR_DEFAUT.CMC, ACCUEIL_EN),
  WSSC: { ...traduireDefaut(ACCUEIL_PAR_DEFAUT.WSSC, ACCUEIL_EN), infos: '1 Westmount Square, Suite C190, Westmount, Quebec H3Z 2P9 · 514 931-5055' },
}

export function accueilParDefaut(clinique: Clinique, langue: 'fr' | 'en'): ContenuAccueil {
  return (langue === 'en' ? ACCUEIL_PAR_DEFAUT_EN : ACCUEIL_PAR_DEFAUT)[clinique]
}

// ---------------------------------------------------------------------------
// Validation (contenu envoyé par l'éditeur)

const LIM = { titre: 120, texte: 600, lien: 500, legende: 120, infos: 1000, cartes: 8, photos: 40 }

/** Lien accepté : https://…, une page de la plateforme (/…) ou une ancre (#…). */
export function lienValide(v: string): boolean {
  if (!v) return true
  if (v.startsWith('#')) return /^#[\w-]{1,50}$/.test(v)
  if (v.startsWith('/')) return !v.startsWith('//') && !/\s/.test(v)
  try { return new URL(v).protocol === 'https:' } catch { return false }
}

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function validerContenu(brut: unknown): { erreur: string } | { contenu: ContenuAccueil } {
  if (!brut || typeof brut !== 'object') return { erreur: 'Contenu invalide' }
  const b = brut as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const liens: string[] = []
  const lien = (v: unknown) => { const s = texte(v, LIM.lien); liens.push(s); return s }
  const contenu: ContenuAccueil = {
    banniere: { titre: texte(b.banniere?.titre, LIM.titre), texte: texte(b.banniere?.texte, LIM.texte), image: lien(b.banniere?.image) },
    cartes: (Array.isArray(b.cartes) ? b.cartes : []).slice(0, LIM.cartes).map((c: Record<string, unknown>) => ({
      titre: texte(c?.titre, LIM.titre), texte: texte(c?.texte, LIM.texte), image: lien(c?.image), lien: lien(c?.lien),
    })).filter((c: CarteAccueil) => c.titre),
    visite: {
      titre: texte(b.visite?.titre, LIM.titre), texte: texte(b.visite?.texte, LIM.texte),
      photos: (Array.isArray(b.visite?.photos) ? b.visite.photos : []).slice(0, LIM.photos)
        .map((p: Record<string, unknown>) => ({ url: lien(p?.url), legende: texte(p?.legende, LIM.legende) }))
        .filter((p: PhotoAccueil) => p.url),
    },
    infos: texte(b.infos, LIM.infos),
  }
  if (!contenu.banniere.titre) return { erreur: 'Le titre de la bannière est requis.' }
  const mauvais = liens.find(l => !lienValide(l))
  if (mauvais) return { erreur: `Lien ou image refusé : « ${mauvais} ». Utilisez une adresse https://, une page de la plateforme (/…) ou #visite.` }
  return { contenu }
}
