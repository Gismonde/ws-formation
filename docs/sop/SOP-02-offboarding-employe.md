# SOP-02 — Offboarding d'un employé

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Gestionnaires, Admins
**Responsable :** Gestionnaire direct + Administrateur système

---

## Objectif

Cette procédure garantit que lorsqu'un employé quitte l'organisation (démission, fin de contrat, retraite, congédiement), tous ses accès sont révoqués correctement, ses données sont archivées, et la conformité Loi 25 / RGPD est respectée.

---

## Déclencheur

Utilise cette procédure dès que tu es informé qu'un employé quitte l'organisation, que ce soit :
- Une démission (avec préavis)
- Une fin de contrat à durée déterminée
- Un congédiement ou mise à pied
- Un départ à la retraite
- Un transfert vers une autre organisation

---

## Délais obligatoires

| Événement | Action | Délai maximum |
|-----------|--------|---------------|
| Annonce du départ | Informer l'admin système | 24 heures |
| Dernier jour de travail | Désactiver le compte | Avant la fin de journée |
| Dernier jour de travail | Archiver les données | Dans les 48 heures |
| 30 jours après le départ | Révision finale des accès | Obligatoire |

---

## Étapes

### Étape 1 — Informer l'administrateur système (Gestionnaire)

Dès que tu sais qu'un employé va quitter :

1. Contacte l'administrateur système
2. Communique les informations suivantes :
   - Nom complet de l'employé
   - Date du dernier jour de travail
   - Raison du départ (optionnel, confidentiel)
3. Planifie ensemble la désactivation du compte

---

### Étape 2 — Vérifier les formations en cours (Gestionnaire)

Avant le départ de l'employé :

1. Connecte-toi à la plateforme WS Formation
2. Va dans **Admin → Employés**
3. Clique sur le profil de l'employé
4. Consulte l'onglet **"Formations"**
5. Note les formations non complétées et leur statut
6. Décide si les formations doivent être :
   - **Abandonnées** : pas de suite requise
   - **Transférées** : à un autre employé si pertinent
   - **Archivées** : pour les dossiers de conformité

---

### Étape 3 — Exporter les certificats et données (Gestionnaire)

Pour les besoins de conformité et d'archives RH :

1. Va dans **Admin → Employés → [Nom de l'employé]**
2. Clique sur **"Voir les certificats"**
3. Exporte tous les certificats valides au format PDF
4. Conserve ces fichiers dans le dossier RH de l'employé selon la politique de rétention de l'organisation
5. Note les certifications obtenues pour le dossier final

> **Conformité Loi 25 :** Les données de formation peuvent être conservées jusqu'à [durée définie par l'organisation] après le départ. Consulte ta politique interne.

---

### Étape 4 — Désactiver le compte (Admin)

**Cette étape est exécutée par l'administrateur système le dernier jour de travail :**

1. Connecte-toi à la plateforme en tant qu'admin
2. Va dans **Admin → Employés**
3. Cherche et clique sur le profil de l'employé
4. Clique sur **"Désactiver le compte"**
5. Confirme l'action dans la boîte de dialogue
6. Le compte est immédiatement désactivé :
   - L'employé ne peut plus se connecter
   - Sa session active est révoquée
   - Son MFA est désactivé
   - Ses données sont conservées (non supprimées)

**Vérification :** Tente une connexion avec l'email de l'employé pour confirmer que l'accès est bien refusé.

---

### Étape 5 — Réassigner les formations si nécessaire (Gestionnaire)

Si l'employé avait des responsabilités de formation (mentor, responsable de module) :

1. Va dans **Admin → Formations**
2. Identifie les formations où l'employé était impliqué
3. Réassigne les responsabilités à un autre gestionnaire ou employé
4. Mets à jour les dates limites si nécessaire pour les autres employés affectés

---

### Étape 6 — Documenter le départ (Gestionnaire)

Pour les besoins d'audit et de conformité :

1. Crée une note dans le dossier RH de l'employé contenant :
   - Date officielle de fin d'emploi
   - Liste des formations complétées avec dates de certification
   - Liste des formations incomplètes au moment du départ
   - Confirmation de désactivation du compte (avec date et heure)
2. Archive cette documentation selon la politique de l'organisation

---

### Étape 7 — Révision 30 jours après le départ (Admin)

Un mois après le départ :

1. Vérifie que le compte est toujours désactivé dans la plateforme
2. Consulte les logs d'audit pour détecter toute tentative de connexion suspecte après le départ
3. Si la politique de l'organisation l'exige, procède à la suppression définitive des données personnelles
4. Documente la révision dans le dossier de l'employé

---

## Checklist rapide — Offboarding

- [ ] Admin système informé dans les 24 heures
- [ ] Formations en cours vérifiées et statuts documentés
- [ ] Certificats exportés et archivés dans le dossier RH
- [ ] Compte désactivé le dernier jour de travail (ou avant)
- [ ] Session active révoquée (vérifiée)
- [ ] Formations réassignées si nécessaire
- [ ] Documentation du départ complétée
- [ ] Révision à 30 jours planifiée au calendrier

---

## Points de contact

| Situation | Qui contacter |
|-----------|--------------|
| Désactivation du compte | Administrateur système |
| Questions sur la rétention des données | Responsable de la conformité / RH |
| Accès suspect après le départ | Administrateur système — immédiatement |

---

## Références

- [Permissions et rôles](../permissions.md)
- [Guide de sécurité — Conformité Loi 25](../securite.md)
- [Logs d'audit](../database.md)
- Politique de ressources humaines de l'organisation
- Politique de confidentialité et de rétention des données
