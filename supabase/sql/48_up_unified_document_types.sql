-- ============================================================================
-- 48 UP. Référentiel unique de types de documents
-- ============================================================================
-- Objectif : app_type_items devient l'unique source de vérité pour les types
-- de documents. La table document_types disparaît comme référentiel concurrent.
--
-- Étapes :
--   1. Ajouter les colonnes category, description, is_active à app_type_items
--   2. Reporter la category de document_types sur app_type_items (jointure sur code)
--   3. Insérer dans app_type_items les codes de document_types absents
--   4. Créer les nouveaux codes orphelins (validés en B.0)
--   5. Créer la table doc_type_aliases et la remplir
--   6. Appliquer le remappage sur person_documents, accreditation_documents,
--      accreditation_requirements
--   7. Vérifier qu'il ne reste aucun orphelin
--   8. Créer la contrainte d'intégrité (table de projection par trigger)
--   9. Renommer document_types en document_types_deprecated
-- ============================================================================

-- ── 1. Ajouter les colonnes manquantes à app_type_items ─────────────────────
ALTER TABLE public.app_type_items
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ── 2. Reporter la category de document_types sur app_type_items ────────────
-- Jointure sur le code (groupe document_types uniquement)
UPDATE public.app_type_items ati
SET category = dt.category
FROM public.document_types dt
WHERE ati.group_key = 'document_types'
  AND ati.code = dt.code
  AND ati.category IS NULL;

-- ── 3. Insérer dans app_type_items les codes de document_types absents ──────
-- Ces codes existent dans document_types mais pas dans app_type_items(document_types)
-- On les insère avec is_system = false (ils ne sont pas du seed initial)
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system, category)
SELECT 'document_types', dt.code, dt.label, dt.sort_order, false, dt.category
FROM public.document_types dt
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_type_items ati
  WHERE ati.group_key = 'document_types' AND ati.code = dt.code
)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 4. Créer les nouveaux codes orphelins validés en B.0 ────────────────────
-- Codes qui n'existent ni dans document_types ni dans app_type_items(document_types)
-- mais qui sont référencés dans accreditation_requirements
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system, category) VALUES
  ('document_types', 'medical_license', 'Licence médicale',  20, false, 'medical'),
  ('document_types', 'press_card',      'Carte de presse',   21, false, 'admin')
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 5. Créer la table de remappage doc_type_aliases ─────────────────────────
CREATE TABLE IF NOT EXISTS public.doc_type_aliases (
  old_code text PRIMARY KEY,
  new_code text NOT NULL
);

-- Remplir avec les correspondances validées en B.0
INSERT INTO public.doc_type_aliases (old_code, new_code) VALUES
  ('admin_visa',            'visa'),
  ('photo',                 'photo_identite'),
  ('medical_certificate',   'medical_cert')
ON CONFLICT (old_code) DO NOTHING;

-- ── 6. Appliquer le remappage ──────────────────────────────────────────────

-- 6a. person_documents.doc_type
UPDATE public.person_documents
SET doc_type = da.new_code
FROM public.doc_type_aliases da
WHERE person_documents.doc_type = da.old_code;

-- 6b. accreditation_documents.doc_type
UPDATE public.accreditation_documents
SET doc_type = da.new_code
FROM public.doc_type_aliases da
WHERE accreditation_documents.doc_type = da.old_code;

-- 6c. accreditation_requirements.doc_type_code
UPDATE public.accreditation_requirements
SET doc_type_code = da.new_code
FROM public.doc_type_aliases da
WHERE accreditation_requirements.doc_type_code = da.old_code;

-- ── 7. Vérification : il ne doit rester aucun orphelin ──────────────────────
-- ── À exécuter par l'utilisateur AVANT de continuer ─────────────────────────
--
-- SELECT 'person_documents' AS source, pd.doc_type AS valeur
-- FROM person_documents pd
-- LEFT JOIN app_type_items ati ON ati.group_key='document_types' AND ati.code=pd.doc_type
-- WHERE ati.id IS NULL
-- UNION ALL
-- SELECT 'accreditation_documents', ad.doc_type
-- FROM accreditation_documents ad
-- LEFT JOIN app_type_items ati ON ati.group_key='document_types' AND ati.code=ad.doc_type
-- WHERE ati.id IS NULL
-- UNION ALL
-- SELECT 'accreditation_requirements', ar.doc_type_code
-- FROM accreditation_requirements ar
-- LEFT JOIN app_type_items ati ON ati.group_key='document_types' AND ati.code=ar.doc_type_code
-- WHERE ati.id IS NULL;
--
-- Résultat attendu : 0 ligne. Si des orphelins subsistent, NE PAS continuer.

-- ── 8. Contrainte d'intégrité vers app_type_items(group_key, code) ──────────
-- Postgres ne supporte pas les FK partielles (FOREIGN KEY ... WHERE group_key = 'document_types').
-- On crée une table de projection document_type_codes alimentée par trigger,
-- qui maintient un miroir des codes valides du groupe document_types.
-- Une FK classique pointe vers cette table.

CREATE TABLE IF NOT EXISTS public.document_type_codes (
  code text PRIMARY KEY
);

-- Alimenter initialement
INSERT INTO public.document_type_codes (code)
SELECT code FROM public.app_type_items WHERE group_key = 'document_types'
ON CONFLICT DO NOTHING;

-- Fonction trigger : synchroniser document_type_codes quand app_type_items change
CREATE OR REPLACE FUNCTION public.sync_document_type_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.group_key = 'document_types' THEN
    INSERT INTO public.document_type_codes (code) VALUES (NEW.code) ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.group_key = 'document_types' THEN
    INSERT INTO public.document_type_codes (code) VALUES (NEW.code) ON CONFLICT DO NOTHING;
    IF OLD.group_key = 'document_types' AND OLD.code <> NEW.code THEN
      -- L'ancien code n'est plus valide que s'il n'existe plus aucune ligne avec ce code
      DELETE FROM public.document_type_codes
      WHERE code = OLD.code
        AND NOT EXISTS (
          SELECT 1 FROM public.app_type_items
          WHERE group_key = 'document_types' AND code = OLD.code
        );
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.group_key = 'document_types' THEN
    DELETE FROM public.document_type_codes
    WHERE code = OLD.code
      AND NOT EXISTS (
        SELECT 1 FROM public.app_type_items
        WHERE group_key = 'document_types' AND code = OLD.code
      );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_document_type_codes ON public.app_type_items;
CREATE TRIGGER trg_sync_document_type_codes
  AFTER INSERT OR UPDATE OR DELETE ON public.app_type_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_document_type_codes();

-- FK vers la table de projection
ALTER TABLE public.person_documents
  ADD CONSTRAINT person_documents_doc_type_fkey
  FOREIGN KEY (doc_type) REFERENCES public.document_type_codes(code) ON DELETE RESTRICT;

ALTER TABLE public.accreditation_documents
  ADD CONSTRAINT accreditation_documents_doc_type_fkey
  FOREIGN KEY (doc_type) REFERENCES public.document_type_codes(code) ON DELETE RESTRICT;

ALTER TABLE public.accreditation_requirements
  ADD CONSTRAINT accreditation_requirements_doc_type_code_fkey
  FOREIGN KEY (doc_type_code) REFERENCES public.document_type_codes(code) ON DELETE RESTRICT;

-- ── 9. Renommer document_types en document_types_deprecated ────────────────
-- On ne supprime pas la table : elle sert de référence historique.
ALTER TABLE public.document_types RENAME TO document_types_deprecated;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0048', 'unified_document_types')
ON CONFLICT (version) DO NOTHING;