# SOP-06 — Validation d'une preuve de formation externe

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Gestionnaires, Admins
**Responsable :** Gestionnaire de formation

---

## Objectif

Cette procédure guide le gestionnaire dans la révision et la validation (ou le refus) des preuves de formation externe soumises par les employés — formations suivies en dehors de la plateforme WS Formation.

---

## Déclencheur

Utilise cette procédure quand :
- Un employé soumet une preuve de formation externe dans la plateforme
- Tu reçois une notification de nouvelle preuve en attente de validation
- Tu effectues une révision périodique des preuves en attente

---

## Exemples de preuves acceptables

| Type | Exemples |
|------|---------|
| Attestation officielle | Diplôme, certificat d'organisme accrédité |
| Confirmation de participation | Lettre de l'organisme, formulaire signé |
| Reçu de formation | Facture d'un cours suivi avec dates |
| Capture d'écran | Complétion d'une plateforme en ligne (LinkedIn Learning, Coursera) |
| Badge numérique | Credly, Open Badges |

---

## Critères d'évaluation

Pour être acceptée, une preuve doit satisfaire **tous** les critères suivants :

- [ ] **Identifiant** : Le nom de l'employé est visible sur le document
- [ ] **Date** : La date de la formation est indiquée et récente (selon la politique)
- [ ] **Contenu** : Le sujet de la formation correspond à un besoin identifié
- [ ] **Source** : L'organisme formateur est reconnu ou légitime
- [ ] **Lisible** : Le document est lisible (pas flou, pas tronqué)

---

## Étapes

### Étape 1 — Accéder aux preuves en attente

1. Connecte-toi à la plateforme WS Formation en tant que gestionnaire ou admin
2. Dans le menu de gauche, clique sur **Admin → Preuves**
3. Filtre par statut **"En attente"**
4. Tu vois la liste des preuves soumises avec :
   - Nom de l'employé
   - Type de formation déclaré
   - Date de soumission
   - Document joint

---

### Étape 2 — Examiner la preuve

Pour chaque preuve en attente :

1. Clique sur la preuve pour l'ouvrir
2. Télécharge ou visualise le document joint
3. Vérifie les 5 critères d'évaluation (voir ci-dessus)
4. Consulte le profil de formation de l'employé si nécessaire :
   - A-t-il des formations similaires déjà validées ?
   - Cette formation comble-t-elle un besoin réel ?

---

### Étape 3A — Approuver la preuve

Si la preuve satisfait tous les critères :

1. Clique sur **"Approuver"**
2. Dans le champ commentaire (optionnel), tu peux ajouter une note :
   - Ex : "Attestation de l'UQAM — valide pour 2 ans"
3. Clique sur **"Confirmer l'approbation"**
4. Le système :
   - Met à jour le statut de la preuve à **"Approuvée"**
   - Génère un certificat si applicable
   - Notifie l'employé par courriel
5. Documente l'approbation dans le dossier de l'employé si requis

---

### Étape 3B — Refuser la preuve

Si la preuve ne satisfait pas un ou plusieurs critères :

1. Clique sur **"Refuser"**
2. Dans le champ **Motif de refus** (obligatoire), explique clairement pourquoi :
   - Exemples :
     - "Document illisible — veuillez soumettre une version plus claire"
     - "La date de formation n'est pas visible"
     - "L'organisme formateur n'est pas reconnu pour ce type de formation"
     - "Le contenu de la formation ne correspond pas aux besoins identifiés"
3. Clique sur **"Confirmer le refus"**
4. L'employé reçoit une notification avec le motif
5. L'employé peut soumettre une nouvelle preuve corrigée

---

### Étape 4 — Cas particuliers

**Preuve partiellement acceptable :**
Si le document est acceptable mais incomplet, contacter l'employé directement avant de refuser :
1. Note la preuve comme **"En révision"** si disponible
2. Envoie un message à l'employé lui demandant le document manquant
3. Donne un délai raisonnable (ex : 5 jours ouvrables)
4. Traite la preuve à la réception du complément

**Document suspect ou frauduleux :**
Si tu as des doutes sur l'authenticité du document :
1. Ne pas approuver
2. Contacter l'employé pour obtenir des clarifications
3. Si les doutes persistent, escalader aux Ressources humaines
4. Documenter le cas dans le dossier de l'employé

---

### Étape 5 — Suivi des preuves refusées

1 semaine après un refus :

1. Vérifie si l'employé a soumis une nouvelle preuve
2. Si oui, la traiter immédiatement (Étapes 2-3)
3. Si non, envoie un rappel à l'employé
4. Si la formation est obligatoire, vérifier si l'employé peut compléter la version interne

---

## Délais de traitement

| Priorité | Formation | Délai cible |
|----------|-----------|-------------|
| Urgente | Formation réglementaire, audit imminent | 24 heures |
| Normale | Formation standard | 3 jours ouvrables |
| Faible | Formation optionnelle ou développement personnel | 5 jours ouvrables |

---

## Modèle de courriel — Demande d'information complémentaire

> **Objet :** Votre preuve de formation — Information requise
>
> Bonjour [Prénom],
>
> J'ai bien reçu ta preuve pour la formation **[Nom de la formation]** soumise le [date].
>
> Pour finaliser la validation, j'aurais besoin du document suivant :
> **[Description de ce qui manque]**
>
> Merci de me faire parvenir ce document d'ici le **[date limite]**.
>
> [Ton nom]

---

## Points de contact

| Situation | Qui contacter |
|-----------|--------------|
| Document frauduleux suspecté | Ressources humaines + Administrateur |
| Problème technique (upload) | Administrateur système |
| Politique de reconnaissance externe | Direction / RH |

---

## Références

- [SOP-05 — Formations en retard](./SOP-05-formations-en-retard.md)
- [Workflows — Soumission de preuve](../workflows.md)
- Politique de reconnaissance des formations externes de l'organisation
