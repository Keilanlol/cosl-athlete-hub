-- ============================================================================
-- 65 UP. Liaison automatique des documents d'accréditation (Option C)
-- ============================================================================
-- 1. Colonne unlinked_at sur accreditation_documents (mémorise le déliage)
-- 2. Index sur accreditation_documents(accreditation_id, person_document_id)
-- 3. Fonction auto_link_person_docs() + trigger AFTER INSERT/UPDATE sur person_documents
-- 4. RPC link_available_docs(p_accreditation_id) pour le bouton explicite
-- 5. Mise à jour de v_accreditation_completeness pour exclure unlinked_at
-- ============================================================================
-- RÈGLES :
--   - Le trigger ne se déclenche QUE pour NEW.status = 'valid' (condition 3).
--     Un document 'pending' ne crée pas de liaison (la vue exige les deux
--     statuts à 'valid', une liaison pending donnerait une fausse impression).
--   - Le trigger crée TOUJOURS accreditation_documents.status = 'pending'.
--     La validation reste humaine (correction A). La vue v_accreditation_completeness
--     exige ad.status = 'valid' AND pd.status = 'valid'.
--   - Le trigger n'écrase jamais un document déjà lié et non délié
--     (unlinked_at IS NULL). Il signale la présence d'un document plus récent
--     via une notification.
--   - Le trigger respecte unlinked_at : si l'utilisateur a délié un document,
--     le trigger ne le relie pas au prochain déclenchement (condition 4).
--
-- RÉCURSION (condition 4) :
--   Ce trigger écrit dans accreditation_documents. Aucun trigger n'existe
--   sur accreditation_documents aujourd'hui (vérifié dans toutes les
--   migrations 00 à 64). Aucun trigger sur accreditations ou persons n'écrit
--   dans person_documents. La récursion est donc impossible.
--   ⚠️ CONTRAINTE : toute future migration ajoutant un trigger sur
--   accreditation_documents qui écrirait dans person_documents créerait une
--   boucle infinie. Ne pas le faire.
--
-- VOLUME (condition 2) :
--   La base contient ~10 000 personnes. Le trigger travaille par personne
--   (WHERE person_id = NEW.person_id), pas sur la table entière. Chaque
--   insertion déclenche au plus k requêtes indexées, où k = nombre
--   d'accréditations de la personne (généralement 1-5, max ~20 pour une
--   personne très active sur de nombreux Games). Le coût reste O(k) par
--   insertion, indépendant de la taille de la table.
-- ============================================================================

BEGIN;

-- ── Snapshot avant modification ─────────────────────────────────────────────
DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_accreditation_documents;
CREATE TABLE migration_backups.migration_65_snapshot_accreditation_documents AS
  SELECT * FROM public.accreditation_documents;

-- ── 1. Colonne unlinked_at ──────────────────────────────────────────────────
ALTER TABLE public.accreditation_documents
  ADD COLUMN IF NOT EXISTS unlinked_at timestamptz;

-- ── 2. Index sur accreditation_documents(accreditation_id, person_document_id) ──
-- Évite le scan O(n) lors de la vérification d'existence d'une liaison.
CREATE INDEX IF NOT EXISTS idx_accred_docs_accred_person_doc
  ON public.accreditation_documents (accreditation_id, person_document_id)
  WHERE person_document_id IS NOT NULL;

-- ── 3. Fonction auto_link_person_docs() ─────────────────────────────────────
-- Appelée par le trigger AFTER INSERT/UPDATE sur person_documents.
-- Pour chaque accréditation de la personne, cherche les requirements
-- correspondant au doc_type du document inséré/mis à jour.
-- Si aucun accreditation_documents n'existe (ou seulement des déliés),
-- crée une liaison en status = 'pending'.
-- Si une liaison valide existe déjà (unlinked_at IS NULL), ne l'écrase pas
-- mais signale le document plus récent via une notification.

CREATE OR REPLACE FUNCTION public.auto_link_person_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accred RECORD;
  v_existing RECORD;
  v_req RECORD;
  v_best_doc_id uuid;
BEGIN
  -- Ne se déclenche que pour les documents valides (condition 3)
  IF NEW.status <> 'valid' THEN
    RETURN NEW;
  END IF;

  -- Parcourir les accréditations de cette personne
  FOR v_accred IN
    SELECT a.id, a.game_id, a.role_code
    FROM public.accreditations a
    WHERE a.person_id = NEW.person_id
  LOOP
    -- Vérifier si ce doc_type est requis pour cette accréditation
    -- (requirements avec ce doc_type, pour ce game et ce rôle)
    SELECT ar.doc_type_code INTO v_req
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = v_accred.game_id
      AND ar.role_code = v_accred.role_code
      AND ar.required = true
      AND ar.doc_type_code = NEW.doc_type
    LIMIT 1;

    IF v_req IS NULL THEN
      -- Ce doc_type n'est pas requis pour cette accréditation, passer
      CONTINUE;
    END IF;

    -- Vérifier s'il existe déjà une liaison non déliée pour ce doc_type
    -- sur cette accréditation (via le person_document lié)
    SELECT ad.id, ad.person_document_id, ad.status, pd.created_at AS doc_created_at
    INTO v_existing
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = v_accred.id
      AND pd.doc_type = NEW.doc_type
      AND ad.unlinked_at IS NULL
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Une liaison existe déjà et n'est pas déliée.
      -- Ne pas écraser (condition : non-écrasement).
      -- Si le nouveau document est plus récent, signaler via notification.
      IF NEW.created_at > v_existing.doc_created_at AND v_existing.person_document_id <> NEW.id THEN
        INSERT INTO public.notifications (
          notification_type, message,
          related_game_id, related_person_id, related_doc_type, is_read
        )
        VALUES (
          'document_action_required',
          'Document plus récent disponible pour le type ' || NEW.doc_type || ' — à examiner depuis l''onglet Accréditations',
          v_accred.game_id, NEW.person_id, NEW.doc_type, false
        );
      END IF;
      CONTINUE;
    END IF;

    -- Vérifier s'il existe une liaison déliée (unlinked_at IS NOT NULL)
    -- pour ce doc_type sur cette accréditation. Si oui, ne pas relier
    -- (condition 4 : l'intention de déliage est persistante).
    PERFORM 1
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = v_accred.id
      AND pd.doc_type = NEW.doc_type
      AND ad.unlinked_at IS NOT NULL
    LIMIT 1;

    IF FOUND THEN
      -- L'utilisateur a délié ce type de document, respecter son choix
      CONTINUE;
    END IF;

    -- Aucune liaison existante (ni active ni déliée) : créer la liaison
    -- Toujours en status = 'pending' (correction A : la validation est humaine)
    INSERT INTO public.accreditation_documents (
      accreditation_id, person_document_id, status, uploaded_at
    )
    VALUES (v_accred.id, NEW.id, 'pending', now());
  END LOOP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_link_person_docs() TO authenticated;

-- Trigger AFTER INSERT : nouveau document valide
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_insert ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_insert
  AFTER INSERT ON public.person_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_person_docs();

-- Trigger AFTER UPDATE : passage à 'valid'
-- Se déclenche quand status passe de non-valid à valid
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_update ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_update
  AFTER UPDATE ON public.person_documents
  FOR EACH ROW
  WHEN (NEW.status = 'valid' AND (OLD.status IS DISTINCT FROM NEW.status))
  EXECUTE FUNCTION public.auto_link_person_docs();

-- ── 4. RPC link_available_docs(p_accreditation_id) ──────────────────────────
-- Bouton explicite dans le drawer : force la liaison des documents disponibles
-- pour une accréditation. Respecte unlinked_at (ne relie pas les types déliés).
-- Crée les liaisons en status = 'pending'.

CREATE OR REPLACE FUNCTION public.link_available_docs(p_accreditation_id uuid)
RETURNS TABLE(doc_type_code text, linked boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accred RECORD;
  v_req RECORD;
  v_best_doc RECORD;
  v_existing RECORD;
BEGIN
  SELECT a.id, a.game_id, a.person_id, a.role_code
  INTO v_accred
  FROM public.accreditations a
  WHERE a.id = p_accreditation_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, false, 'Accréditation introuvable'::text;
    RETURN;
  END IF;

  -- Récupérer tous les doc_types requis pour cette accréditation
  FOR v_req IN
    SELECT DISTINCT ar.doc_type_code
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = v_accred.game_id
      AND ar.role_code = v_accred.role_code
      AND ar.required = true
  LOOP
    -- Vérifier s'il existe déjà une liaison non déliée
    SELECT ad.id INTO v_existing
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = p_accreditation_id
      AND pd.doc_type = v_req.doc_type_code
      AND ad.unlinked_at IS NULL
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT v_req.doc_type_code, false, 'Déjà lié'::text;
      CONTINUE;
    END IF;

    -- Vérifier s'il existe une liaison déliée (respecter l'intention)
    PERFORM 1
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = p_accreditation_id
      AND pd.doc_type = v_req.doc_type_code
      AND ad.unlinked_at IS NOT NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT v_req.doc_type_code, false, 'Délié par l''utilisateur'::text;
      CONTINUE;
    END IF;

    -- Trouver le meilleur document valide de ce type (plus récent par issued_date puis created_at)
    SELECT pd.id, pd.status INTO v_best_doc
    FROM public.person_documents pd
    WHERE pd.person_id = v_accred.person_id
      AND pd.doc_type = v_req.doc_type_code
      AND pd.status = 'valid'
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF v_best_doc IS NULL THEN
      RETURN QUERY SELECT v_req.doc_type_code, false, 'Aucun document valide disponible'::text;
    ELSE
      INSERT INTO public.accreditation_documents (
        accreditation_id, person_document_id, status, uploaded_at
      )
      VALUES (p_accreditation_id, v_best_doc.id, 'pending', now());
      RETURN QUERY SELECT v_req.doc_type_code, true, 'Liaison créée (pending)'::text;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_available_docs(uuid) TO authenticated;

-- ── 5. Mise à jour de v_accreditation_completeness ──────────────────────────
-- Exclure les lignes déliées (unlinked_at IS NOT NULL) du compteur provided.
-- La vue actuelle (migration 61) ne filtre pas sur unlinked_at car la colonne
-- n'existait pas. On recrée la vue avec le filtre supplémentaire.
-- Note : la définition de la vue (union des stages) est conservée intacte.

DROP VIEW IF EXISTS public.v_accreditation_completeness;
CREATE VIEW public.v_accreditation_completeness
WITH (security_invoker = true) AS
SELECT
  a.id AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  (
    SELECT count(DISTINCT ar.doc_type_code)
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = a.game_id
      AND ar.role_code = a.role_code
      AND ar.required = true
      AND (
        ar.selection_stage IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.selections s
          WHERE s.game_id = a.game_id
            AND s.person_id = a.person_id
            AND s.status::text = ar.selection_stage
            AND s.status IN ('pre_selected', 'selected', 'reserve')
        )
      )
  ) AS required_count,
  (
    SELECT count(DISTINCT ad.person_document_id)
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = a.id
      AND ad.status = 'valid'
      AND ad.unlinked_at IS NULL
      AND pd.status = 'valid'
      AND (pd.expiry_date IS NULL OR pd.expiry_date >= COALESCE(
        (SELECT g.competition_start FROM public.games g WHERE g.id = a.game_id),
        CURRENT_DATE
      ))
  ) AS provided_count
FROM public.accreditations a;

GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0065', 'auto_link_person_docs_trigger')
ON CONFLICT (version) DO NOTHING;

COMMIT;