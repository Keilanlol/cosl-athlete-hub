# Harmonisation des formulaires — Persons, Coaches, Members, Organizations

> **Date** : 2025-01-24
> **Auteur** : Dyad

## Résumé

Refactor majeur des formulaires de création/édition pour résoudre les incohérences identifiées lors de l'audit : double canal de création d'encadrants, rôles coach tronqués, duplication du dual-write, absence de React Hook Form + Zod, labels non traduits, styles de dialogs non harmonisés. Centralisation de la logique dans des composants et utilitaires réutilisables.

## Fichiers touchés

| Fichier | Type de changement | Description |
|---------|-------------------|-------------|
| `src/lib/form-schemas.ts` | Ajout | Schémas Zod partagés : `personBaseSchema`, `memberSchema`, `clubSchema`, `federationSchema`, `addressSchema` |
| `src/lib/dual-write.ts` | Ajout | Logique dual-write centralisée : `createPerson`, `createAthleteFromPerson`, `createCoachFromPerson`, `createFederationMemberFromPerson`, `createClubMemberFromPerson` |
| `src/lib/role-utils.ts` | Ajout | Utilitaires `assignPersonRole`, `upsertPersonRole`, `revokePersonRole` |
| `src/components/forms/FormFieldLayout.tsx` | Ajout | Layout standardisé pour champs de formulaire (label + `*` + erreur) |
| `src/components/forms/AddressFields.tsx` | Ajout | Champs adresse réutilisables avec `AddressSearch` intégré (RHF Controller) |
| `src/components/forms/PersonBaseFields.tsx` | Ajout | Champs base personne (prénom, nom, naissance, genre, email, téléphone, nationalité, adresse) |
| `src/components/forms/AthleteRoleFields.tsx` | Ajout | Champs profil athlète avec labels FR et `EditableSelect` pour niveaux |
| `src/components/forms/CoachRoleFields.tsx` | Ajout | Champs profil encadrant avec `COACH_ROLES` unifié de `lib/types.ts` |
| `src/components/forms/MemberRoleFields.tsx` | Ajout | Champs fonction + dates de mandat pour membres fédération/club |
| `src/components/forms/DialogFooterButtons.tsx` | Ajout | Boutons Annuler/Enregistrer standardisés avec charte COSL |
| `src/components/forms/MemberFormDialog.tsx` | Ajout | Dialog complet création/édition membre avec RHF + Zod + PersonCombobox |
| `src/components/forms/OrganizationFormDialog.tsx` | Ajout | Dialog complet création/édition fédération/club avec RHF + Zod |
| `src/components/persons/PersonCreateDialog.tsx` | Modification | Migration RHF + Zod, rôles coach unifiés, labels FR, dual-write centralisé |
| `src/components/persons/AddRoleDialog.tsx` | Modification | Migration RHF + Zod, réutilisation des mêmes composants que PersonCreateDialog |
| `src/routes/_authenticated/coaches/index.tsx` | Modification | Suppression du dialog legacy, utilisation exclusive du flow AddPersonButton |
| `src/routes/_authenticated/clubs/index.tsx` | Modification | Migration vers `OrganizationFormDialog` avec RHF + Zod |
| `src/components/AddressSearch.tsx` | Modification | Ajout prop `disabled` pour cohérence |

## Logique et fonctionnement

### Architecture en couches

1. **`form-schemas.ts`** — Définit les schémas Zod pour chaque type d'entité. Tous les formulaires importent et réutilisent ces schémas, garantissant une validation cohérente.

2. **`dual-write.ts`** — Centralise toute la logique d'insertion dual-write (table `persons` + table legacy + `person_roles` + `athlete_profiles`/`coach_profiles`/etc.). Avant, cette logique était dupliquée entre `PersonCreateDialog` et `AddRoleDialog`.

3. **`role-utils.ts`** — Fonctions simples pour gérer `person_roles` : `assignPersonRole` (insert), `upsertPersonRole` (upsert avec `ignoreDuplicates`), `revokePersonRole` (delete).

4. **Composants `forms/`** — Composants de champs réutilisables fonctionnant avec React Hook Form via `<FormProvider>` + `<Controller>`. Chaque composant gère son propre rendu et ses propres labels.

### Flux de création de personne

```
AddPersonButton (bouton)
  → picker PersonCombobox (personne existante ?)
    → si existante : AddRoleDialog (ajoute un rôle à la personne)
    → si nouvelle : PersonCreateDialog (wizard 3 étapes)
        Étape 1 : PersonBaseFields (infos générales)
        Étape 2 : sélection des rôles (checkboxes)
        Étape 3 : AthleteRoleFields / CoachRoleFields / MemberRoleFields (selon rôles)
        Submit → createPerson() + createXxxFromPerson() pour chaque rôle
```

### Flux de création membre (fédération/club)

```
MemberFormDialog
  → PersonCombobox optionnel (lier à personne existante)
  → champs prénom/nom/email/téléphone
  → MemberRoleFields (fonction + dates mandat)
  → AddressFields (adresse)
  → Submit → insert dans federation_members/club_members + dual-write si personId
```

## Dépendances

- **Tables BDD** : `persons`, `person_roles`, `athletes`, `athlete_profiles`, `athlete_kyc`, `coaches`, `coach_profiles`, `federation_members`, `federation_member_profiles`, `club_members`, `club_member_profiles`
- **Composants** : `AddressSearch` (étendu avec prop `disabled`), `PersonCombobox`, `EditableSelect`, `AthletePhotoUpload`
- **Hooks** : `useSports`, `useAthleteLevels` (de `useReferenceData`)
- **Types** : `COACH_ROLES`, `ATHLETE_STATUSES`, `FEDERATION_MEMBER_ROLES`, `CLUB_MEMBER_ROLES` (de `src/lib/types.ts`)
- **Librairies** : `react-hook-form`, `@hookform/resolvers/zod`, `zod`

## Points d'attention

- **Routes non migrées** : `/federations/index.tsx`, `/federations/$id.tsx`, `/clubs/$id.tsx`, `/members/index.tsx`, `/persons/$personId.tsx` utilisent encore l'ancien pattern `useState`. Elles fonctionnent mais ne profitent pas encore de RHF + Zod. Migration future recommandée.
- **`OrganizationFormDialog`** utilise un cast `as never` sur le resolver Zod car le schéma est dynamique (fédération vs club). C'est un compromis acceptable.
- **`PersonCreateDialog`** utilise `zodResolver(schema) as never` à cause de l'inférence de types entre `personBaseSchema.merge(detailsSchema)` et les `defaultValues`. Fonctionnel mais à nettoyer si Zod évolue.
- **Suppression du dialog legacy coach** : la page `/coaches` n'a plus de dialog d'édition inline. L'édition passe par `/coaches/$id` (qui existe déjà avec son propre dialog).
- **Dual-write** : `createFederationMemberFromPerson` et `createClubMemberFromPerson` utilisent `base.first_name`/`base.last_name` (de la personne) plutôt que les champs du membre, pour garantir la cohérence.

## Écran(s) / UI

- **Wizard PersonCreateDialog** : 3 étapes avec indicateur de progression, dialog `max-h-[90vh] overflow-y-auto sm:max-w-2xl`.
- **Profils spécifiques** : sections avec bordure `rounded-md border border-border p-3`, titres avec emoji (🏃 🎯 🏛️ 🏟️).
- **Boutons submit** : tous utilisent `bg-primary hover:bg-[var(--cosl-red-dark)]`.
- **Labels obligatoires** : astérisque `*` en `text-primary`.
- **Dialogs standardisés** : tous ont `max-h-[90vh] overflow-y-auto` pour gérer le scroll.