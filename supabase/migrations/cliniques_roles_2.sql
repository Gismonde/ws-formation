-- Migration (2/2) : nommer l'administrateur global
-- À exécuter dans une requête SÉPARÉE, après cliniques_roles.sql
-- (si role est un enum, la nouvelle valeur super_admin n'est utilisable qu'après la première requête)

UPDATE employes SET role = 'super_admin'
WHERE email = 'gnanhoue.gismonde@wssurgical.com';

SELECT id, prenom, nom, email, role, clinique FROM employes WHERE role = 'super_admin';
