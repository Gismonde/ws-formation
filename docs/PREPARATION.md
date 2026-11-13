# Version de préparation

- La branche `preparation` reçoit les nouveautés avant leur lancement. Vercel la publie à une adresse de prévisualisation ; le portail officiel (educplateform.wssurgical.com) suit `main`.
- Les deux versions partagent la même base Supabase : une action faite dans la préparation est réelle (courriels, assignations).
- Lancement : fusion de `preparation` dans `main` à l'heure annoncée aux employés.
- Corrections urgentes : directement dans `main`, puis `main` est refusionnée dans `preparation`.
- Les migrations SQL restent compatibles avec la version en ligne (ajouts seulement).
