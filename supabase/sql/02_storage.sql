-- Storage bucket pour les documents d'accréditation
-- À appliquer après 01_init.sql sur l'instance self-hosted Supabase.

INSERT INTO storage.buckets (id, name, public)
VALUES ('accreditation-docs', 'accreditation-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "accred_docs_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'accreditation-docs');
