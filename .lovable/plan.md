## Résumé

Corriger `PersonCreateDialog.tsx` pour que la création d'une personne avec les rôles **Membre de fédération** et **Membre de club** écrive aussi dans les tables legacy (`federation_members` / `club_members`), puis mette à jour le profil avec le `legacy_id` correspondant. Ces personnes apparaîtront alors dans les pages fédération et club.

## Fichier modifié

`src/components/persons/PersonCreateDialog.tsx`

## Modifications

### Section `federation_member` (ligne ~319)

Actuellement, seul un `INSERT` dans `federation_member_profiles` est fait. Il faut ajouter **immédiatement après** :

1. `INSERT` dans `federation_members` (legacy) avec `federation_id`, `first_name`, `last_name`, `email`, `phone`, `role`, `start_date`, `is_active: true`, `person_id`.
2. `UPDATE` de `federation_member_profiles` pour positionner `legacy_federation_member_id` avec l'`id` retourné par l'insertion legacy.

### Section `club_member` (ligne ~333)

Idem : après le `INSERT` dans `club_member_profiles`, ajouter :

1. `INSERT` dans `club_members` (legacy) avec `club_id`, `first_name`, `last_name`, `email`, `phone`, `role`, `start_date`, `is_active: true`, `person_id`.
2. `UPDATE` de `club_member_profiles` pour positionner `legacy_club_member_id` avec l'`id` retourné.

## Hors scope

- Les sections `athlete` et `coach` du même fichier (déjà correctes).
- Tous les autres fichiers du projet.