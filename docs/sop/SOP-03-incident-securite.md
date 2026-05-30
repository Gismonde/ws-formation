# SOP-03 — Signalement d'un incident de sécurité

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Tous les employés
**Responsable :** L'employé qui détecte l'incident

---

## Objectif

Cette procédure explique quoi faire si tu remarques quelque chose d'anormal avec ton compte, tes accès, ou la plateforme WS Formation. Signaler rapidement un incident permet de limiter les dommages et de protéger les données de toute l'organisation.

---

## Déclencheur

Utilise cette procédure si tu observes l'une des situations suivantes :

- Tu reçois un courriel de connexion que tu n'as pas initié
- Tu n'arrives plus à te connecter à ton compte alors que tu n'as pas changé ton mot de passe
- Quelqu'un te demande ton mot de passe ou ton code MFA (par courriel, téléphone ou messagerie)
- Tu constates des données modifiées dans ton profil ou tes formations sans que tu l'aies fait
- Tu cliques accidentellement sur un lien suspect et tu es redirigé vers une page inconnue
- Tu vois une activité dans ton compte que tu ne reconnais pas

---

## Étapes

### Étape 1 — Ne pas paniquer, agir rapidement

Dès que tu remarques quelque chose d'anormal :

1. **Ne partage pas ton mot de passe ou ton code MFA** avec qui que ce soit — même si la personne prétend être un administrateur ou de l'équipe technique
2. **Ne clique pas sur d'autres liens** suspects
3. **Ne ferme pas les fenêtres ou courriels** suspectes — ils peuvent contenir des informations utiles pour l'enquête

---

### Étape 2 — Signaler immédiatement à ton gestionnaire

Contacte ton gestionnaire **dans les 30 minutes** suivant la découverte de l'incident :

**Informations à communiquer :**
- Ce que tu as observé (décris avec tes mots)
- À quelle heure tu l'as remarqué
- Si tu as cliqué sur quelque chose ou entré des informations quelque part
- L'appareil utilisé (ordinateur de bureau, portable, téléphone)

**Si ton gestionnaire n'est pas disponible**, contacte directement l'administrateur système.

---

### Étape 3 — Changer ton mot de passe immédiatement

Si tu as encore accès à ton compte :

1. Va sur **[ws-formation.vercel.app](https://ws-formation.vercel.app)**
2. Connecte-toi à ton compte
3. Clique sur ton nom → **"Mon profil"**
4. Clique sur **"Changer mon mot de passe"**
5. Entre un nouveau mot de passe fort :
   - Minimum 12 caractères
   - Mélange de lettres, chiffres et symboles
   - Différent de tes anciens mots de passe
6. Clique sur **"Enregistrer"**

Si tu n'as **plus accès** à ton compte, va directement à l'Étape 4.

---

### Étape 4 — Si tu ne peux plus te connecter

1. Va sur la page de connexion : **[ws-formation.vercel.app/login](https://ws-formation.vercel.app/login)**
2. Clique sur **"Mot de passe oublié"**
3. Entre ton adresse courriel professionnelle
4. Consulte ta boîte courriel — un lien de réinitialisation sera envoyé
5. Si tu ne reçois pas le courriel dans 5 minutes, contacte ton administrateur système directement

---

### Étape 5 — Ne pas utiliser ton compte jusqu'à confirmation

Après avoir signalé l'incident :

1. **Ne te reconnecte pas** à la plateforme jusqu'à ce que l'administrateur te donne le feu vert
2. **Informe ton gestionnaire** que tu attends la confirmation
3. L'administrateur vérifiera les logs d'activité et te contactera

---

### Étape 6 — Coopérer avec l'enquête

Si l'administrateur te contacte pour obtenir plus d'informations :

1. Réponds dans les meilleurs délais
2. Fournis tous les détails demandés (heure, appareil, actions effectuées)
3. Ne supprime pas les courriels ou messages suspects — ils peuvent être utilisés comme preuves
4. Si tu as pris une capture d'écran, partage-la avec l'administrateur

---

## Ce qu'il ne faut jamais faire

| A ne JAMAIS faire | Pourquoi |
|-------------------|---------|
| Partager son mot de passe | Personne de légitime ne te demandera jamais ton mot de passe |
| Partager son code MFA | Idem — ce code t'appartient uniquement |
| Ignorer l'incident | Un incident non signalé peut affecter toute l'organisation |
| Tenter de résoudre l'incident seul | Sans les bons outils, tu pourrais aggraver la situation |
| Parler de l'incident publiquement | Attendre la confirmation de l'administrateur avant de communiquer |

---

## Exemples d'incidents courants

### Tentative d'hameçonnage (phishing)
Tu reçois un courriel qui semble provenir de WS Formation te demandant de "confirmer tes informations" via un lien. **Ne clique pas.** Signale le courriel à ton gestionnaire et marque-le comme spam.

### Connexion non reconnue
Tu reçois une notification de connexion à ton compte que tu n'as pas faite. **Change immédiatement ton mot de passe** et suis les étapes ci-dessus.

### Mot de passe compromis
Un site que tu utilisais a subi une brèche et tu utilisais le même mot de passe que sur WS Formation. **Change ton mot de passe immédiatement** sur WS Formation et partout où tu utilises ce mot de passe.

---

## Contacts d'urgence

| Rôle | Action |
|------|--------|
| Ton gestionnaire | Premier contact — dans les 30 minutes |
| Administrateur système | Si gestionnaire indisponible ou si compte compromis |

---

## Références

- [Guide de sécurité](../securite.md)
- [SOP-01 — Onboarding employé](./SOP-01-onboarding-employe.md) (section MFA)
- Politique de confidentialité de l'organisation
