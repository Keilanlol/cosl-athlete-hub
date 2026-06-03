# Refonte de la gestion des rôles d'une personne

## Objectif
Sur la fiche personne (`/persons/$personId`), transformer le dialog "Gérer les rôles" (actuellement de simples checkboxes sur `person_roles`) en un vrai workflow dual-write : ajouter un rôle ouvre un formulaire spécifique qui crée le profil + l'entrée legacy ; supprimer un rôle demande confirmation et nettoie profile + legacy + `person_roles`.

## Fichiers

| Fichier | Action |
|---|---|
| `src/components/persons/AddRoleDialog.tsx` | **Créer** |
| `src/routes/_authenticated/persons/$personId.tsx` | **Modifier** (dialog rôles + remplace `toggleRole`) |

Pas de changement à `PersonCreateDialog.tsx`, ni aux pages de liste, ni à la BDD.

## 1. `AddRoleDialog.tsx` (nouveau)

Props : `{ open, onOpenChange, personId, person: { first_name, last_name, birth_date, gender, nationality, email, phone }, role: PersonRoleType, onAdded: () => void }`.

- Titre : `Ajouter le rôle « {ROLE_LABELS[role]} » — {first_name} {last_name}`
- Au montage (quand `open`), charge `sports`, `federations`, `clubs`, et `athlete_levels_ref` depuis Supabase.
- Affiche les champs conditionnels selon `role` (mêmes intitulés que `PersonCreateDialog`) :
  - **athlete** : sport principal, fédération, club (filtré par fédération), statut (`active|injured|suspended|retired|ambassador`), niveau (depuis `athlete_levels_ref`), n° licence, n° passeport, expiry passeport. **Garde-fou** : si `person.birth_date` ou `person.gender` manquent, bloquer avec message "Renseigner d'abord la date de naissance et le genre" (NOT NULL côté `athletes`).
  - **coach** : fonction (`coach|medical|chief_of_mission|press|manager|official`), fédération (opt), club (opt, filtré).
  - **federation_member** : fédération *, rôle *, start_date (opt).
  - **club_member** : club *, rôle *, start_date (opt).
  - **official / volunteer / staff** : aucun champ ; juste un message "Aucune information supplémentaire requise".

### Dual-write au submit (transaction logique, try/catch + `friendlyError`)

- **athlete** : `nextCoslId()` (dupliquer la fonction depuis `PersonCreateDialog`) → INSERT `athletes` (avec `person_id`, `is_active=true`) → récupérer `legacy_athlete_id` → INSERT `athlete_profiles` → INSERT `athlete_kyc` (`global_status='red'`, best-effort) → INSERT `person_roles`.
- **coach** : INSERT `coaches` → `legacy_coach_id` → INSERT `coach_profiles` → INSERT `person_roles`.
- **federation_member** : INSERT `federation_members` → `legacy_federation_member_id` → INSERT `federation_member_profiles` → INSERT `person_roles`.
- **club_member** : INSERT `club_members` → `legacy_club_member_id` → INSERT `club_member_profiles` → INSERT `person_roles`.
- **official / volunteer / staff** : INSERT `person_roles` seul.

Sur succès → `toast.success("Rôle ajouté")` → `onAdded()` → `onOpenChange(false)`.

## 2. `$personId.tsx` (modifier)

### Supprimer
- La fonction `toggleRole` actuelle (lignes ~175-198).

### Ajouter
- État : `const [addRoleTarget, setAddRoleTarget] = useState<PersonRoleType | null>(null)`.
- `addRole(r)` : ferme le dialog "Gérer les rôles" (`setRolesOpen(false)`) et `setAddRoleTarget(r)`.
- `removeRole(r)` :
  1. `confirmAction({ destructive: true, title: 'Supprimer le rôle « ' + ROLE_LABELS[r] + ' » ?', description: 'Les données de profil liées seront supprimées définitivement.', confirmLabel: 'Supprimer' })`.
  2. Selon `r` :
     - **athlete** : lire `athlete_profiles.legacy_athlete_id` → `UPDATE athletes SET is_active=false WHERE id=…` (soft-delete pour préserver sélections/documents/KYC) → `DELETE athlete_profiles` → `DELETE person_roles`.
     - **coach** : `legacy_coach_id` → `DELETE coaches` → `DELETE coach_profiles` (tous pour ce `person_id`) → `DELETE person_roles`.
     - **federation_member** : `legacy_federation_member_id` → `DELETE federation_members` → `DELETE federation_member_profiles` → `DELETE person_roles`.
     - **club_member** : `legacy_club_member_id` → `DELETE club_members` → `DELETE club_member_profiles` → `DELETE person_roles`.
     - **official / volunteer / staff** : `DELETE person_roles` seul.
  3. `toast.success("Rôle supprimé")` → `load()`.

### Dialog "Gérer les rôles" — nouvelle UI
Remplace les checkboxes par une liste de `PERSON_ROLE_TYPES` :
- Rôle **assigné** → ligne avec `<PersonRoleBadge role={r} />` + libellé + bouton rouge `✕` (icône `X`) à droite → `removeRole(r)`.
- Rôle **non assigné** → ligne grisée avec libellé + bouton `+` (icône `Plus`) à droite → `addRole(r)`.

### Monter `AddRoleDialog`
En bas du JSX :
```
{addRoleTarget && bundle && (
  <AddRoleDialog
    open={!!addRoleTarget}
    onOpenChange={(o) => !o && setAddRoleTarget(null)}
    personId={personId}
    person={bundle.person}
    role={addRoleTarget}
    onAdded={() => { setAddRoleTarget(null); load(); }}
  />
)}
```

## Hors scope
- `PersonCreateDialog.tsx` (création initiale OK).
- Pages de listes (athletes, coaches, federations, clubs, members).
- Migration BDD, refonte de `confirmAction` ou `EntityImageUpload`.
- Composants Documents / KYC / Palmarès de la fiche athlète.
