## Résumé

Migrer les 3 dialogs de création de la page club (`clubs/$id.tsx`) — **Adhérent**, **Encadrant**, **Membre du bureau** — pour qu'ils s'appuient sur le référentiel `persons` plutôt que sur les tables legacy seules. Pour chaque dialog : sélection d'une personne existante via `PersonCombobox`, préremplissage du formulaire, dual-write `*_profiles` + table legacy + `person_roles`, ou ouverture de `PersonCreateDialog` pour créer une nouvelle personne avec le bon `initialRoles`.

## Fichier modifié

`src/routes/_authenticated/clubs/$id.tsx`

## Changement 1 — Dialog « Ajouter un adhérent »

État/données :
- Remplacer `athletePool` par `personsPool: { id, first_name, last_name, email, photo_url }[]`.
- Dans `openAddAthlete`, charger `SELECT id, first_name, last_name, email, photo_url FROM persons WHERE is_active = true ORDER BY last_name`.
- Garder `selectedAthleteId` (renommé conceptuellement en `selectedPersonId`) + l'option `"__new__"`.
- Ajouter un state `personCreateOpen` + `personInitialRoles`.

Options du `PersonCombobox` :
```
[
  { id: "__new__", label: "+ Créer une nouvelle personne" },
  ...persons.map(p => ({ id: p.id, label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}` }))
]
```

Comportement au submit (`submitAddAthlete`) :
- Si `selectedPersonId === "__new__"` → fermer ce dialog, ouvrir `<PersonCreateDialog open initialRoles={["athlete"]} onCreated={() => load()} />`. Supprimer tout le sous-formulaire « nouveau athlète » embarqué dans ce dialog (devenu inutile).
- Sinon, vérifier si la personne a déjà un athlete_profile :
  - `SELECT legacy_athlete_id FROM athlete_profiles WHERE person_id = selectedPersonId`
  - Si trouvé : `UPDATE athletes SET current_club_id = id WHERE id = legacy_athlete_id` → toast « Athlète rattaché à ce club » → `load()`.
  - Si non trouvé : fermer ce dialog, ouvrir `<PersonCreateDialog open initialRoles={["athlete"]} />` (création complète du profil athlète). Note : `PersonCreateDialog` actuel ne sait pas pré-attacher une personne existante ; on laisse donc l'utilisateur compléter sur `/persons/$id`. Pour cette branche on affichera plutôt un toast d'info + redirection vers `/persons/$selectedPersonId` (« Ajoute le rôle Athlète depuis sa fiche »).

## Changement 2 — Dialog « Ajouter un encadrant »

- Ajouter en haut du dialog (au-dessus du select `freeCoaches` existant) un `PersonCombobox` « Sélectionner une personne existante (optionnel) » alimenté par le même `personsPool` chargé dans `load()` (ou un nouveau state partagé `persons`).
- Nouveau state `selectedCoachPersonId`.
- Quand une personne est sélectionnée : préremplir `coachForm.first_name/last_name/email/phone` ; réinitialiser `pickedCoachId`.
- Au submit (`submitCoach`), si `selectedCoachPersonId` :
  1. INSERT `coaches` (legacy) avec `club_id`, `federation_id`, champs du form, `person_id`.
  2. INSERT `coach_profiles` avec `person_id`, `legacy_coach_id`, `role`, `federation_id`, `club_id`, `is_active`.
  3. INSERT `person_roles` `{ person_id, role_type: 'coach' }` ON CONFLICT DO NOTHING (via `upsert` avec `onConflict: 'person_id,role_type', ignoreDuplicates: true`).
  4. Toast + close + reset `selectedCoachPersonId` + `load()`.
- Si pas de `selectedCoachPersonId` : conserver exactement le comportement actuel (insert/update `coaches`).

## Changement 3 — Dialog « Ajouter un membre » (bureau)

- Ajouter en haut du dialog un `PersonCombobox` (uniquement quand `!editingMember`).
- Nouveau state `selectedMemberPersonId`.
- Quand une personne est sélectionnée : préremplir `memberForm.first_name/last_name/email/phone`.
- Au submit (`submitMember`), si `!editingMember && selectedMemberPersonId` :
  1. INSERT `club_members` (legacy) — payload actuel + `person_id`.
  2. INSERT `club_member_profiles` `{ person_id, club_id, role, start_date, is_active, legacy_club_member_id }`.
  3. INSERT `person_roles` `{ person_id, role_type: 'club_member' }` (upsert ignoreDuplicates).
- Sinon (edit ou pas de personne sélectionnée) : conserver le comportement actuel.

## Détails techniques

- Chargement `personsPool` : déplacer dans `load()` pour qu'il soit dispo pour les 3 dialogs (et rechargé après création).
- Imports à ajouter : `PersonCreateDialog` depuis `@/components/persons/PersonCreateDialog`.
- Reset des nouveaux states sur `onOpenChange(false)` de chaque dialog.
- Le sous-formulaire « nouveau athlète » embarqué (`newAthlete`, fields `naf/nal/nabd/nag/nan/nas/nae/nap`) est supprimé : il est remplacé par `PersonCreateDialog`.

## Hors scope

- Le flow `editingMember` (modification d'un membre existant).
- Les tabs Athletes/Members/Coaches en lecture.
- `PersonCreateDialog.tsx`.
- Toute autre page.