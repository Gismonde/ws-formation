# Documentation WS Formation

> Plateforme de gestion des formations en ligne.

**Version :** 1.0  
**Date :** 2026-05-29  
**Auteur :** Gismonde  
**Environnement :** Production — Vercel + Supabase  

---

## Fichiers de documentation

| Fichier | Contenu |
|---------|---------|
| [architecture.md](./architecture.md) | Stack technique, structure du code, flux de données |
| [database.md](./database.md) | Schéma complet des tables, colonnes, relations, triggers, vues |
| [securite.md](./securite.md) | Authentification, MFA, RLS, audit logs, conformité Loi 25 |
| [workflows.md](./workflows.md) | Flux métier : login, formations, certifications, expirations |
| [permissions.md](./permissions.md) | Matrice des rôles et permissions par page et action |
| [api.md](./api.md) | Routes API, endpoints, paramètres, réponses |

---

## Vue d'ensemble

WS Formation permet à une organisation de :

- **Gérer les formations** : créer, publier, organiser par niveaux et départements
- **Suivre la progression** : leçons, quiz, completion des employés
- **Délivrer des certificats** : avec durée de validité et notifications d'expiration
- **Contrôler les accès** : rôles admin, super_admin, employé
- **Auditer les actions** : logs de connexion, modifications, exports
- **Sécuriser les comptes** : authentification 2FA TOTP optionnelle

---

## Contexte légal

- **Loi 25 (Québec)** — Protection des renseignements personnels dans le secteur privé
- **RGPD** — Règlement général sur la protection des données
- **Audit interne** — Traçabilité complète des actions sensibles

---

## Liens

- **Application :** https://ws-formation.vercel.app
- **Code source :** https://github.com/Gismonde/ws-formation
