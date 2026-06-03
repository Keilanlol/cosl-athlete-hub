# Liaison "personne existante" sur les dialogs Fédération & Membres

## Objectif

Sur les trois dialogs ci-dessous, ajouter en tête un `PersonCombobox` qui :
- préremplit le formulaire existant (nom, prénom, email, téléphone) à la sélection ;
- au submit, déclenche un dual-write : profil correspondant + `person_roles`
  (les deux en `ON CONFLICT DO NOTHING`).
Si aucune personne n'est sélectionnée, le comportement actuel est conservé à l'identique.

## Fichiers

| Fichier | Action |
|---|---|
| `src/routes/_authenticated/federations/$id.tsx` | Modifier (2 dialogs) |
| `src/routes/_authenticated/members/index.tsx` | Modifier (1 dialog) |

Aucun autre fichier touché. `PersonCombobox.tsx`, `PersonCreateDialog.tsx`,
`federations/index.tsx`, `FedMemberDetailPage`, `ClubMemberDetailPage` :
inchangés.

## 1. `federations/$id.tsx` — Dialog "Ajouter un membre"

- Nouveau state local : `selectedMemberPersonId: string | null`.
- En tête du `DialogContent` (juste sous `DialogHeader`), insérer :
  ```tsx
  <div className="space-y-1.5">
    <Label>Personne existante (optionnel)</Label>
    <PersonCombobox
      value={selectedMemberPersonId}
      onChange={(personId, person) => {
        setSelectedMemberPersonId(personId);
        if (person) setMemberForm(f => ({
          ...f,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email ?? "",
          phone: person.phone ?? "",
        }));
      }}
    />
  </div>
  ```
- Reset de `selectedMemberPersonId` à `null` quand le dialog se ferme ou
  passe en mode édition (`editingMember` non nul) — la liaison ne s'applique
  qu'en création.
- Au submit (création uniquement, pas d'édition), juste après le `INSERT
  federation_members` réussi : récupérer l'`id` créé via `.select("id").single()`
  puis :
  ```ts
  if (!editingMember && selectedMemberPersonId) {
    await supabase.from("federation_member_profiles")
      .upsert({
        person_id: selectedMemberPersonId,
        legacy_federation_member_id: newId,
        federation_id, role: memberForm.role,
        start_date: memberForm.start_date || null,
        is_active: memberForm.is_active,
      }, { onConflict: "person_id,federation_id,role", ignoreDuplicates: true });
    await supabase.from("person_roles")
      .upsert({ person_id: selectedMemberPersonId, role_type: "federation_member" },
        { onConflict: "person_id,role_type", ignoreDuplicates: true });
  }
  ```
  Note : la stratégie `upsert + ignoreDuplicates` est l'équivalent supabase de
  `ON CONFLICT DO NOTHING`. Les colonnes `onConflict` sont les contraintes UNIQUE
  existantes (à vérifier au moment du code ; à défaut, fallback : SELECT + INSERT
  conditionnel).

## 2. `federations/$id.tsx` — Dialog "Ajouter un encadrant"

Même schéma :
- State `selectedCoachPersonId`.
- `PersonCombobox` en tête, préremplit `coachForm.first_name/last_name/email/phone`.
- Au submit création (pas d'édition), après `INSERT coaches` (modifié pour
  `.select("id").single()`) :
  ```ts
  if (!pickedCoachId && selectedCoachPersonId) {
    await supabase.from("coaches").update({ person_id: selectedCoachPersonId })
      .eq("id", newCoachId);
    await supabase.from("coach_profiles").upsert({
      person_id: selectedCoachPersonId,
      legacy_coach_id: newCoachId,
      role: coachForm.role,
      federation_id, club_id: coachForm.club_id || null,
      is_active: coachForm.is_active,
    }, { onConflict: "person_id,legacy_coach_id", ignoreDuplicates: true });
    await supabase.from("person_roles").upsert(
      { person_id: selectedCoachPersonId, role_type: "coach" },
      { onConflict: "person_id,role_type", ignoreDuplicates: true });
  }
  ```

## 3. `members/index.tsx` — Dialog global "Ajouter un membre"

- State `selectedPersonId`.
- `PersonCombobox` en tête, préremplit `createForm.first_name/last_name/email/phone`.
- Au submit, après le `INSERT` (la table dépend de `orgType` :
  `federation_members` ou `club_members`) qu'on modifie pour renvoyer `.select("id").single()` :
  ```ts
  if (selectedPersonId) {
    if (orgType === "fed") {
      await supabase.from("federation_member_profiles").upsert({
        person_id: selectedPersonId,
        legacy_federation_member_id: newId,
        federation_id: createForm.federation_id,
        role: createForm.role,
        start_date: createForm.start_date || null,
        is_active: true,
      }, { onConflict: "person_id,federation_id,role", ignoreDuplicates: true });
      await supabase.from("person_roles").upsert(
        { person_id: selectedPersonId, role_type: "federation_member" },
        { onConflict: "person_id,role_type", ignoreDuplicates: true });
    } else {
      await supabase.from("club_member_profiles").upsert({
        person_id: selectedPersonId,
        legacy_club_member_id: newId,
        club_id: createForm.club_id,
        role: createForm.role,
        start_date: createForm.start_date || null,
        is_active: true,
      }, { onConflict: "person_id,club_id,role", ignoreDuplicates: true });
      await supabase.from("person_roles").upsert(
        { person_id: selectedPersonId, role_type: "club_member" },
        { onConflict: "person_id,role_type", ignoreDuplicates: true });
    }
  }
  ```
- Reset de `selectedPersonId` à la fermeture du dialog.

## Détails d'implémentation

- `PersonCombobox` existe déjà (`src/components/PersonCombobox.tsx`, 88 lignes) ;
  je vérifie sa signature exacte avant le câblage et adapte le contrat
  `onChange(personId, person?)` si nécessaire (fallback : fetch `persons` par id
  juste après sélection pour récupérer email/phone).
- Modifier les `INSERT` existants pour récupérer l'`id` (`.select("id").single()`)
  est requis pour pouvoir écrire `legacy_*_id` dans le profil.
- Si la contrainte UNIQUE utilisée pour `onConflict` n'existe pas en BDD,
  fallback : `SELECT … WHERE …` puis `INSERT` conditionnel — pas de migration.
- Aucun champ ajouté au form ; aucune restructuration ; aucun changement de
  layout en dehors d'un bloc unique inséré en tête.

## Hors scope

- `federations/index.tsx` (logique `pendingPresident`).
- `FedMemberDetailPage`, `ClubMemberDetailPage`.
- `PersonCreateDialog.tsx`.
- Structure des formulaires existants.
- Toute migration BDD.
