-- Bucket privé `documents` pour BF-ATH-040..046, BF-ACC-021, BF-LOG-060.
-- À appliquer sur l'instance self-hosted Supabase.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','application/pdf','image/webp']
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_upload') THEN
    CREATE POLICY "documents_authenticated_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_read') THEN
    CREATE POLICY "documents_authenticated_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_update') THEN
    CREATE POLICY "documents_authenticated_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_delete') THEN
    CREATE POLICY "documents_authenticated_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'documents');
  END IF;
END $$;
