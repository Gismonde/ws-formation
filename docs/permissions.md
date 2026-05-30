# Permissions et Roles — WS Formation

Mise a jour : 2026-05-30

---

## 1. Roles utilisateurs

WS Formation definit trois niveaux de roles :

| Role | Description | Cible |
|------|-------------|-------|
| `employe` | Utilisateur standard | Tous les employes |
| `admin` | Gestionnaire de formation | RH, managers |
| `super_admin` | Acces complet | Administrateur systeme |

Le role est stocke dans la colonne `role` de la table `employes`.

---

## 2. Matrice des permissions

### 2.1 Fonctionnalites generales

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Se connecter | ✅ | ✅ | ✅ |
| Activer le MFA | ✅ | ✅ | ✅ |
| Voir son profil | ✅ | ✅ | ✅ |
| Modifier son profil | ✅ (limité) | ✅ | ✅ |
| Voir le dashboard employé | ✅ | ✅ | ✅ |
| Acceder au panel admin | ❌ | ✅ | ✅ |

### 2.2 Gestion des employes

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Voir la liste des employes | ❌ | ✅ | ✅ |
| Voir les details d'un employe | ❌ | ✅ | ✅ |
| Créer un employe | ❌ | ✅ | ✅ |
| Modifier un employe | ❌ | ✅ | ✅ |
| Désactiver un employe | ❌ | ✅ | ✅ |
| Supprimer un employe | ❌ | ❌ | ✅ |
| Changer le role d'un employe | ❌ | ❌ | ✅ |

### 2.3 Gestion des formations

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Voir ses formations assignees | ✅ | ✅ | ✅ |
| Voir toutes les formations | ❌ | ✅ | ✅ |
| Creer une formation | ❌ | ✅ | ✅ |
| Modifier une formation | ❌ | ✅ | ✅ |
| Supprimer une formation | ❌ | ❌ | ✅ |
| Assigner une formation | ❌ | ✅ | ✅ |
| Voir la progression d'un employe | ❌ | ✅ | ✅ |
| Voir sa propre progression | ✅ | ✅ | ✅ |

### 2.4 Certificats

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Voir ses certificats | ✅ | ✅ | ✅ |
| Voir tous les certificats | ❌ | ✅ | ✅ |
| Revoquer un certificat | ❌ | ✅ | ✅ |
| Exporter les certificats | ❌ | ✅ | ✅ |

### 2.5 Preuves externes

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Soumettre une preuve | ✅ | ✅ | ✅ |
| Voir ses propres preuves | ✅ | ✅ | ✅ |
| Voir toutes les preuves | ❌ | ✅ | ✅ |
| Approuver / refuser une preuve | ❌ | ✅ | ✅ |

### 2.6 Rapports et audit

| Action | employe | admin | super_admin |
|--------|---------|-------|-------------|
| Voir les rapports | ❌ | ✅ | ✅ |
| Exporter les rapports | ❌ | ✅ | ✅ |
| Voir les logs d'audit | ❌ | ✅ | ✅ |
| Exporter les logs d'audit | ❌ | ❌ | ✅ |

---

## 3. Routes et protection

### 3.1 Routes publiques (non authentifié)

| Route | Description |
|-------|-------------|
| /login | Page de connexion |
| /register | Page d'inscription (si activé) |

### 3.2 Routes employees (session active)

| Route | Description |
|-------|-------------|
| /dashboard | Tableau de bord principal |
| /dashboard/formations | Mes formations |
| /dashboard/formations/[id] | Detail d'une formation |
| /dashboard/certificats | Mes certificats |
| /dashboard/preuves | Mes preuves soumises |
| /dashboard/securite | Gestion du MFA |
| /dashboard/profil | Mon profil |
| /mfa-verify | Verification TOTP (post-login) |

### 3.3 Routes admin (role admin ou super_admin)

| Route | Description |
|-------|-------------|
| /admin | Panel admin — accueil |
| /admin/employes | Gestion des employes |
| /admin/employes/[id] | Detail/modification d'un employe |
| /admin/formations | Gestion des formations |
| /admin/formations/[id] | Detail/modification d'une formation |
| /admin/certificats | Tous les certificats |
| /admin/preuves | Validation des preuves |
| /admin/rapports | Rapports de formation |

### 3.4 Routes super_admin uniquement

| Route | Description |
|-------|-------------|
| /admin/audit | Logs d'audit complets |
| /admin/employes/[id]/role | Modification du role |
| /admin/settings | Parametres systeme |

---

## 4. Implementation RLS ↔ Roles

### 4.1 Correspondance role ↔ politique RLS

```sql
-- Fonction utilitaire : obtenir le role de l'utilisateur connecte
CREATE OR REPLACE FUNCTION get_role_utilisateur()
RETURNS text AS $$
  SELECT role FROM employes
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Verifier si l'utilisateur est admin ou super_admin
CREATE OR REPLACE FUNCTION est_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM employes
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 4.2 Politique par role — employes

```sql
-- Employe : voir uniquement son propre profil
CREATE POLICY "employe_select_son_profil"
ON employes FOR SELECT
USING (
  auth_user_id = auth.uid()
  OR est_admin()
);

-- Employe : modifier uniquement son propre profil (champs limités)
CREATE POLICY "employe_update_son_profil"
ON employes FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (
  -- L'employe ne peut PAS changer son propre role
  role = (SELECT role FROM employes WHERE auth_user_id = auth.uid())
);

-- Admin : creer de nouveaux employes
CREATE POLICY "admin_insert_employe"
ON employes FOR INSERT
WITH CHECK (est_admin());

-- Super admin : tout modifier
CREATE POLICY "super_admin_tout"
ON employes FOR ALL
USING (
  (SELECT role FROM employes WHERE auth_user_id = auth.uid()) = 'super_admin'
);
```

### 4.3 Politique par role — progressions

```sql
-- Employe : voir ses propres progressions
CREATE POLICY "employe_select_progressions"
ON progressions FOR SELECT
USING (
  employe_id = (SELECT id FROM employes WHERE auth_user_id = auth.uid())
  OR est_admin()
);

-- Employe : mettre a jour ses propres progressions
CREATE POLICY "employe_update_progressions"
ON progressions FOR UPDATE
USING (
  employe_id = (SELECT id FROM employes WHERE auth_user_id = auth.uid())
);
```

---

## 5. Verification cote serveur (API Routes)

Meme avec le RLS active, les API routes Next.js verifient le role :

```typescript
// src/app/api/admin/employes/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // 1. Verifier la session
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Non authentifie' }, { status: 401 });
  
  // 2. Verifier le role
  const { data: employe } = await supabase
    .from('employes')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();
  
  if (!employe || employe.role === 'employe') {
    return Response.json({ error: 'Acces refuse' }, { status: 403 });
  }
  
  // 3. Continuer avec la logique admin...
}
```

---

## 6. Changelog des permissions

| Version | Date | Modification |
|---------|------|-------------|
| 1.0 | 2026-05-29 | Creation initiale — 3 roles |
| 1.1 | 2026-05-30 | Ajout MFA optionnel pour tous les roles |
