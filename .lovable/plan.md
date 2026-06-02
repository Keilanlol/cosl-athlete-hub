# Plan — Photos club_members + seed des images entités

## 1. Migration SQL — `supabase/sql/22_club_members_photo.sql`

Ajouter les colonnes photo sur `club_members` (mêmes noms que `federation_members`) :

```sql
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

NOTIFY pgrst, 'reload schema';
```

## 2. Types — `src/lib/types.ts`

Étendre `ClubMember` avec `photo_url?: string | null` et `photo_storage_path?: string | null`.

## 3. UI — `src/routes/_authenticated/clubs/$id.tsx`

- Sélectionner les nouvelles colonnes dans les requêtes `club_members`.
- Onglet Membres : remplacer l'avatar « initiales » par `<EntityImageUpload shape="circle" size="sm" entityType="club_member" />` en lecture (ou simple `<img>` si pas d'édition inline) — calqué sur l'onglet Membres de la fiche fédération.
- Dialog d'édition d'un membre : ajouter `<EntityImageUpload shape="circle" size="lg" entityType="club_member" label="Photo" />` (visible uniquement quand `editingMember.id` existe), avec `onUploaded`/`onDeleted` qui font le `update` sur `club_members`.

## 4. Composant `EntityImageUpload`

Ajouter `club_member` à l'union `entityType` et au mapping de chemin de stockage : `club-members/{id}/photo/photo.{ext}`.

## 5. Seed des images — `supabase/sql/23_seed_entity_images.sql`

Remplir `logo_url` / `photo_url` pour les lignes existantes qui n'en ont pas, via des URLs publiques déterministes (pas de fichiers réels dans le bucket, donc `*_storage_path` reste `NULL` — l'upload via UI le remplira plus tard) :

- **federations.logo_url** : `https://api.dicebear.com/9.x/initials/svg?seed={short_name}&backgroundType=gradientLinear&radius=20`
- **clubs.logo_url** : même générateur, seed = `acronym` ou `name`
- **federation_members.photo_url** : `https://api.dicebear.com/9.x/avataaars/svg?seed={id}`
- **coaches.photo_url** : `https://api.dicebear.com/9.x/avataaars/svg?seed={id}`
- **club_members.photo_url** : idem

Toutes les requêtes utilisent `UPDATE ... WHERE photo_url IS NULL` (idempotent, ne casse pas les vraies images uploadées). Pas de `INSERT` de lignes — on enrichit seulement les données existantes.

## Fichiers

- Créés : `supabase/sql/22_club_members_photo.sql`, `supabase/sql/23_seed_entity_images.sql`
- Modifiés : `src/lib/types.ts`, `src/components/EntityImageUpload.tsx`, `src/routes/_authenticated/clubs/$id.tsx`

## Hors scope

`AthletePhotoUpload`, auth, autres routes (logistique/games/accréditations), aucune modification des photos déjà uploadées par l'utilisateur.
