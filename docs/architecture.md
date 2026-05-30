# Architecture — WS Formation

> Stack technique, structure du code et flux de données.
>
> **Mise à jour :** 2026-05-29
>
> ---
>
> ## Stack technique
>
> | Couche | Technologie | Rôle |
> |--------|-------------|------|
> | **Frontend** | Next.js 14 App Router | Framework React SSR |
> | **Langage** | TypeScript 5 | Typage statique |
> | **Style** | Tailwind CSS 3 | Utilitaires CSS |
> | **Base de données** | PostgreSQL 15 via Supabase | Données relationnelles |
> | **Auth** | Supabase Auth | JWT + MFA TOTP |
> | **Déploiement** | Vercel | CI/CD depuis GitHub |
>
> ---
>
> ## Structure du projet
>
> ```
> ws-formation/
> ├── docs/                    # Documentation
> ├── src/
> │   ├── app/
> │   │   ├── admin/           # Interface administrateur
> │   │   │   ├── formations/  # CRUD formations
> │   │   │   ├── employes/    # Gestion employés
> │   │   │   └── rapports/    # Rapports exports
> │   │   ├── api/
> │   │   │   └── auth/login/  # POST login avec MFA
> │   │   ├── dashboard/       # Espace employé
> │   │   │   ├── certificats/ # Mes certificats
> │   │   │   ├── historique/  # Progression
> │   │   │   ├── profil/      # Profil
> │   │   │   ├── preuves/     # Dépôt preuves
> │   │   │   ├── securite/    # Gestion 2FA
> │   │   │   └── sop/         # Procédures
> │   │   ├── login/           # Connexion
> │   │   └── mfa-verify/      # Vérification TOTP
> │   ├── components/          # UI réutilisables
> │   └── lib/
> │       ├── supabase/        # Clients server + client
> │       ├── types/           # Interfaces TypeScript
> │       └── audit.ts         # logAudit()
> └── middleware.ts             # Protection des routes
> ```
>
> ---
>
> ## Variables d'environnement
>
> | Variable | Description | Obligatoire |
> |----------|-------------|-------------|
> | `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase | Oui |
> | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique | Oui |
> | `SUPABASE_SERVICE_ROLE_KEY` | Clé admin secret | Oui |
>
> ---
>
> ## Clients Supabase
>
> - **Server** (`src/lib/supabase/server.ts`) : Server Components et API routes, gère les cookies SSR
> - - **Client** (`src/lib/supabase/client.ts`) : Client Components `use client`, singleton browser
>  
>   - ---
>
> ## Flux de données
>
> ### Login avec MFA
> ```
> POST /api/auth/login
>   signInWithPassword()
>   Vérifie archivage employé
>   listFactors() → MFA vérifié ?
>     OUI → /mfa-verify
>     NON → /dashboard
> ```
>
> ### Protection des routes
> ```
> Requête → middleware.ts
>   Vérifie session cookie
>   Valide → page
>   Invalide → /login
> ```
>
> ---
>
> ## Décisions d'architecture
>
> | Décision | Raison |
> |----------|--------|
> | App Router Next.js 14 | Server Components pour données sensibles |
> | Supabase Auth | Intégration native PostgreSQL + MFA inclus |
> | RLS PostgreSQL | Sécurité niveau base de données |
> | Audit log en DB | Traçabilité juridique Loi 25 |
> | MFA TOTP Supabase | Standard RFC 6238, compatible toutes apps |
