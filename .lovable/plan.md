
# Photos & Logos — Fédérations, Clubs, Membres, Encadrants

Étendre le système de photo athlète existant à 4 nouvelles entités, en gardant exactement le même UX (drag & drop, overlay Camera au survol, bouton Trash2 rouge, confirmation, URL signée 1 an dans le bucket `documents`).

## 1. Migration SQL

Nouveau fichier `supabase/sql/21_entity_images.sql` :

- `federations` : `logo_url TEXT`, `logo_storage_path TEXT`
- `clubs` : `logo_url TEXT`, `logo_storage_path TEXT`
- `federation_members` : `photo_url TEXT`, `photo_storage_path TEXT`
- `coaches` : `photo_url TEXT`, `photo_storage_path TEXT`

Tous en `ADD COLUMN IF NOT EXISTS` + `NOTIFY pgrst, 'reload schema'`.

## 2. Nouveau composant `src/components/EntityImageUpload.tsx`

Calqué sur `AthletePhotoUpload.tsx`, simplifié (pas de `athlete_documents`, pas de `pendingPreviewOnly`).

Props :
```ts
{
  entityId: string;
  entityType: 'federation' | 'club' | 'federation_member' | 'coach';
  currentImageUrl?: string | null;
  currentStoragePath?: string | null;
  onUploaded: (url: string, storagePath: string) => void;
  onDeleted?: () => void;
  shape?: 'circle' | 'square';   // défaut: circle
  size?: 'sm' | 'lg';            // défaut: lg
  label?: string;
  placeholder?: string;
  className?: string;
}
```

Comportement :
- Bucket `documents`, chemins :
  - `federations/{id}/logo/logo.{ext}`
  - `clubs/{id}/logo/logo.{ext}`
  - `federation-members/{id}/photo/photo.{ext}`
  - `coaches/{id}/photo/photo.{ext}`
- Avant upload : si `currentStoragePath` fourni et différent → `storage.remove([currentStoragePath])`.
- Upload `{ upsert: true, contentType }`, puis `createSignedUrl(path, 60*60*24*365)`.
- Callback `onUploaded(signedUrl, path)`.
- Suppression : `confirmAction` ("Supprimer cette image ?") → `storage.remove([currentStoragePath])` → `onDeleted()`.
- Validation : JPG/PNG/WebP, max 5 MB, toasts d'erreur.
- Rendu :
  - `shape="circle"` → `rounded-full` + `object-cover`, fallback `UserCircle`
  - `shape="square"` → `rounded-lg` + `object-contain p-1`, fallback `Building2`
  - Placeholder texte (initiales/acronyme) en `font-semibold text-slate-500` si fourni
  - Overlay hover `bg-black/40` + Camera + "Modifier"/"Ajouter"
  - Bouton Trash2 `-top-1 -right-1` rouge, bordure blanche
- Label optionnel sous la zone (`text-xs text-slate-500`).

Important : aucune écriture en DB depuis le composant — les parents gèrent l'update Supabase dans leurs `onUploaded` / `onDeleted` (ce qui permet de réutiliser le même composant pour 4 tables sans branchement interne).

## 3. Types — `src/lib/types.ts`

Ajouter aux interfaces existantes :
- `Federation` : `logo_url`, `logo_storage_path` (string | null)
- `Club` : `logo_url`, `logo_storage_path`
- `FederationMember` : `photo_url`, `photo_storage_path`
- `Coach` : `photo_url`, `photo_storage_path`

## 4. Intégration UI (8 fichiers de routes)

Pattern identique partout : `select("*")` ramène déjà les nouvelles colonnes ; ajouter explicitement les colonnes dans les `select(...)` ciblés s'ils ne sont pas en `*`. Dans chaque Dialog d'édition, le bloc `EntityImageUpload` n'est rendu QUE si on édite une entité existante (id connu) — pas en création initiale, pour éviter d'uploader avant d'avoir un id.

### `federations/index.tsx`
- Cellule logo (square, sm) en 1ère colonne du tableau, fallback acronyme.
- Dans Dialog édition (si `editing`) : `EntityImageUpload` (square, lg, label "Logo de la fédération") → update DB + setEditing + reload.

### `federations/$id.tsx`
- Header : remplacer/compléter l'icône Building2 par `EntityImageUpload` (square, lg).
- Onglet "members" : avatar circle sm dans chaque ligne (photo ou initiales).
- Dialog `memberOpen` (si `editingMember`) : `EntityImageUpload` (circle, lg, `entityType="federation_member"`).

### `clubs/index.tsx`
- Cellule logo (square, sm) en 1ère colonne, fallback 2 premières lettres.
- Dialog édition : `EntityImageUpload` (square, lg, label "Logo du club").

### `clubs/$id.tsx`
- Header : `EntityImageUpload` (square, lg) à côté du nom (remplace l'icône Shield).
- Onglet "members" : avatar circle sm dans le tableau + Dialog (`entityType="federation_member"`).
- Onglet "coaches" : avatar circle sm dans le tableau (lecture seule ici, édition via /coaches).

### `coaches/index.tsx`
- Cellule photo circle sm en 1ère colonne.
- Dialog édition : `EntityImageUpload` (circle, lg, label "Photo").

### `coaches/$id.tsx`
- Header : `EntityImageUpload` (circle, lg) en remplacement de l'avatar initiales.

## 5. Ne pas toucher

`AthletePhotoUpload.tsx`, `AuthContext.tsx`, `supabase.ts`, `kyc-utils.ts`, `server/node-server.mjs`, `vite.config.prod.ts`, routes logistique/games/accreditations.

## Points d'attention

- Réutilisation du bucket existant `documents` (déjà configuré dans `10_documents_bucket.sql`, MIME types JPG/PNG/WebP/PDF autorisés, RLS authenticated OK).
- URLs signées 1 an : à régénérer si nécessaire au prochain édit (le `currentStoragePath` permet de re-signer côté composant lors d'un remplacement).
- Pour l'onglet coaches d'un club : on n'autorise pas l'édition de photo depuis la fiche club (juste affichage), l'édition se fait sur `/coaches/$id` — c'est cohérent avec les autres infos coach.
- Aucun changement de logique métier ni de filtres : seul le presentationnel + 2 colonnes par table.
