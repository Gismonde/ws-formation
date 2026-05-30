# SOP-04 — Créer et publier une nouvelle formation

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Gestionnaires, Admins
**Responsable :** Gestionnaire de formation

---

## Objectif

Cette procédure guide le gestionnaire dans la création d'une nouvelle formation sur WS Formation, de la rédaction du contenu jusqu'à l'assignation aux employés.

---

## Déclencheur

Utilise cette procédure quand :
- Une nouvelle exigence réglementaire ou de conformité nécessite une formation
- Un changement de processus interne doit être communiqué via une formation
- Un renouvellement de cycle de formation annuelle est requis
- Une demande de formation a été approuvée par la direction

---

## Avant de commencer — Préparer le contenu

Avant de créer la formation dans la plateforme, assure-toi d'avoir :

- [ ] Le titre exact de la formation
- [ ] La description (2-3 phrases expliquant l'objectif)
- [ ] La liste des leçons et leur ordre
- [ ] Le contenu de chaque leçon (texte, vidéo, quiz)
- [ ] La durée estimée (en heures ou minutes)
- [ ] La liste des employés ou départements ciblés
- [ ] La date limite de complétion souhaitée
- [ ] La durée de validité du certificat (ex : 1 an)

---

## Étapes

### Étape 1 — Créer la formation

1. Connecte-toi à la plateforme WS Formation en tant que gestionnaire ou admin
2. Dans le menu de gauche, clique sur **"Admin"** → **"Formations"**
3. Clique sur le bouton **"+ Nouvelle formation"**
4. Remplis le formulaire :
   - **Titre** : Nom clair et descriptif (ex : "Sécurité informatique 2026")
   - **Description** : Expliquer l'objectif de la formation en 2-3 phrases
   - **Durée estimée** : En heures (ex : 2.5)
   - **Validité du certificat** : En mois (ex : 12 pour 1 an)
   - **Statut** : Laisser sur **"Brouillon"** pendant la création
5. Clique sur **"Enregistrer"**

---

### Étape 2 — Ajouter les leçons

Pour chaque leçon de la formation :

1. Dans la formation nouvellement créée, clique sur **"+ Ajouter une leçon"**
2. Remplis les informations de la leçon :
   - **Titre** : Nom de la leçon
   - **Ordre** : Numéro séquentiel (1, 2, 3...)
   - **Type** : Texte / Vidéo / Quiz
   - **Contenu** : Colle le contenu de la leçon
   - **Durée estimée** : En minutes
3. Clique sur **"Enregistrer la leçon"**
4. Répète pour chaque leçon

**Ordre recommandé des leçons :**
- Leçon 1 : Introduction et contexte
- Leçons 2-N : Contenu principal
- Dernière leçon : Résumé ou quiz de validation

---

### Étape 3 — Ajouter un quiz (si applicable)

Si la formation inclut un quiz de validation :

1. Dans la leçon de type "Quiz", clique sur **"+ Ajouter une question"**
2. Pour chaque question :
   - Entre la question
   - Ajoute les choix de réponse (minimum 2)
   - Indique la bonne réponse
   - Définis la pondération (points)
3. Définis la **note de passage** (ex : 70%)
4. Active l'option **"Doit être réussi pour continuer"** si nécessaire

---

### Étape 4 — Vérifier et tester la formation

Avant de la publier :

1. Clique sur **"Aperçu"** pour visualiser la formation comme un employé la verrait
2. Vérifie que :
   - Toutes les leçons s'affichent correctement
   - L'ordre des leçons est bon
   - Le contenu est lisible et sans erreur
   - Les liens et médias fonctionnent
   - Le quiz fonctionne comme attendu
3. Demande à un collègue de tester si possible

---

### Étape 5 — Publier la formation

Une fois satisfait du contenu :

1. Dans la formation, clique sur **"Paramètres"**
2. Change le statut de **"Brouillon"** à **"Actif"**
3. Clique sur **"Enregistrer"**

La formation est maintenant disponible pour assignation. Elle n'est pas encore visible par les employés tant qu'elle n'est pas assignée.

---

### Étape 6 — Assigner la formation aux employés

1. Dans la formation, clique sur **"Assigner"**
2. Choisis le mode d'assignation :
   - **Par employé individuel** : Sélectionne les noms dans la liste
   - **Par département** : Sélectionne un ou plusieurs départements
   - **Tous les employés actifs** : Option globale
3. Définis la **date limite** de complétion (obligatoire)
4. Ajoute une note optionnelle pour les employés (ex : "Formation obligatoire pour la conformité annuelle")
5. Clique sur **"Assigner"**

Les employés sélectionnés verront la formation dans leur tableau de bord immédiatement.

---

### Étape 7 — Confirmer et suivre

Après l'assignation :

1. Va dans **Admin → Rapports**
2. Sélectionne la formation que tu viens de créer
3. Vérifie que tous les employés ciblés apparaissent avec le statut **"Non commencé"**
4. Note la date d'assignation et la date limite dans ton calendrier pour assurer le suivi (voir SOP-05)

---

## Bonnes pratiques

| Pratique | Pourquoi |
|----------|---------|
| Tester avant de publier | Évite les erreurs visibles par les employés |
| Titre clair avec l'année | Ex : "WHMIS 2026" — facilite l'identification pour les audits |
| Date limite réaliste | Donner au moins 2-3 semaines selon la durée de la formation |
| Description claire | Les employés comprennent pourquoi ils font la formation |
| Quiz à la fin | Valide la compréhension et renforce la valeur du certificat |

---

## Points de contact

| Situation | Qui contacter |
|-----------|--------------|
| Problème technique lors de la création | Administrateur système |
| Contenu de formation à valider | Direction / Expert métier |
| Employé introuvable dans la liste | Vérifier si le compte est actif — Administrateur système |

---

## Références

- [SOP-05 — Gestion des formations en retard](./SOP-05-formations-en-retard.md)
- [Workflows — Formation et progression](../workflows.md)
- [Permissions — Routes admin](../permissions.md)
