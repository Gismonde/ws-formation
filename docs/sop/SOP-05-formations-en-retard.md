# SOP-05 — Gestion des formations en retard

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Gestionnaires, Admins
**Responsable :** Gestionnaire de formation

---

## Objectif

Cette procédure guide le gestionnaire dans l'identification des employés en retard sur leurs formations, l'envoi de rappels, et l'escalade si nécessaire pour assurer la conformité.

---

## Déclencheur

Utilise cette procédure quand :
- La date limite d'une formation approche (moins de 7 jours) et des employés n'ont pas complété
- La date limite d'une formation est passée et des employés n'ont pas complété
- Un audit ou une inspection est prévu et les formations doivent être à jour
- Vérification mensuelle/trimestrielle de la conformité des formations

---

## Fréquence recommandée

| Vérification | Fréquence |
|-------------|-----------|
| Formations à moins de 7 jours de la date limite | Hebdomadaire |
| Formations en retard actives | Bi-hebdomadaire |
| Révision globale de conformité | Mensuelle |
| Avant un audit | Minimum 30 jours avant |

---

## Étapes

### Étape 1 — Générer le rapport de retard

1. Connecte-toi à la plateforme en tant que gestionnaire ou admin
2. Va dans **Admin → Rapports**
3. Sélectionne le type **"Formations en retard"**
4. Filtre par période si nécessaire (date limite dépassée)
5. Ajoute des filtres optionnels :
   - Par département
   - Par formation spécifique
6. Clique sur **"Générer le rapport"**
7. Le rapport affiche :
   - Nom de l'employé
   - Formation concernée
   - Date limite (dépassée de X jours)
   - Pourcentage de complétion actuel
   - Statut : "Non commencé" ou "En cours"

---

### Étape 2 — Trier et prioriser

Classe les employés en retard selon la priorité :

| Priorité | Critère | Action |
|----------|---------|--------|
| 🔴 Critique | Retard de plus de 14 jours OU formation réglementaire | Escalade immédiate au supérieur |
| 🟡 Haute | Retard de 1 à 14 jours | Rappel urgent + relance |
| 🟢 Préventive | À moins de 7 jours de la date limite | Rappel préventif |

---

### Étape 3 — Envoyer un rappel (priorité préventive ou haute)

**Pour les employés à moins de 7 jours ou en retard récent :**

1. Dans le rapport, clique sur le nom de l'employé
2. Note son adresse courriel
3. Envoie un courriel de rappel avec le modèle suivant :

---

**Modèle de courriel — Rappel de formation**

> **Objet :** Rappel — Formation à compléter : [Nom de la formation]
>
> Bonjour [Prénom],
>
> Je t'écris pour te rappeler que la formation **[Nom de la formation]** doit être complétée avant le **[Date limite]**.
>
> Tu as actuellement complété [X]% de cette formation. Il te reste [Y] leçon(s) à terminer.
>
> Pour accéder à ta formation : [lien vers la plateforme]
>
> Si tu rencontres un problème technique ou as des questions, n'hésite pas à me contacter.
>
> Merci,
> [Ton nom]

---

4. Note la date et l'heure du rappel envoyé pour le suivi

---

### Étape 4 — Escalade (priorité critique)

**Pour les employés en retard de plus de 14 jours ou sur des formations réglementaires :**

1. Contacte le supérieur direct de l'employé (si différent de toi)
2. Informe-le de la situation avec les détails :
   - Nom de l'employé
   - Formation concernée
   - Nombre de jours de retard
   - Pourcentage de complétion
3. Documentez ensemble un plan d'action :
   - Nouvelle date limite raisonnable
   - Raison du retard (si connue)
   - Conséquences si non complété (selon politique RH)
4. Mets à jour la date limite dans la plateforme si accordé :
   - Va dans la formation → Assigner → Modifier la date limite pour cet employé
5. Note l'escalade dans le dossier de suivi

---

### Étape 5 — Suivi post-rappel

Dans les 48-72 heures après le rappel :

1. Retourne dans **Admin → Rapports → Formations en retard**
2. Vérifie si l'employé a progressé ou complété la formation
3. Si la formation est complétée : aucune action requise
4. Si aucun progrès : répète l'escalade avec le supérieur
5. Documente toutes les tentatives de contact et les résultats

---

### Étape 6 — Clôture et documentation

Une fois toutes les formations complétées ou les cas d'exception documentés :

1. Génère un rapport final de conformité
2. Archive le rapport dans le dossier d'audit
3. Note les formations chroniquement problématiques pour les améliorer (contenu trop long, peu clair, etc.)

---

## Escalade — Arbre décisionnel

```
Formation en retard détectée
│
├── Retard < 7 jours
│     └── Envoyer rappel préventif (Étape 3)
│
├── Retard 1-14 jours
│     ├── Envoyer rappel urgent (Étape 3)
│     └── Suivi dans 48h
│           ├── Complété → Fermé ✅
│           └── Pas de progrès → Escalade (Étape 4)
│
└── Retard > 14 jours OU formation réglementaire
      └── Escalade immédiate (Étape 4)
            ├── Plan d'action établi → Suivi
            └── Refus ou non-réponse → RH / Direction
```

---

## Points de contact

| Situation | Qui contacter |
|-----------|--------------|
| Employé ne répond pas aux rappels | Supérieur direct de l'employé |
| Formation bloquée techniquement | Administrateur système |
| Conséquences disciplinaires requises | Ressources humaines / Direction |
| Audit imminent | Administrateur système + Direction |

---

## Références

- [SOP-04 — Créer et publier une formation](./SOP-04-creer-formation.md)
- [Rapports — API](../api.md)
- [Workflows — Formation et progression](../workflows.md)
