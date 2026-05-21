ALTER TABLE public.athlete_kyc
  ADD COLUMN IF NOT EXISTS passport_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS ci_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS sport_nationality TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_federation TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligibility_verified_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS min_age_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS max_age_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS adams_number TEXT,
  ADD COLUMN IF NOT EXISTS antidoping_last_check DATE,
  ADD COLUMN IF NOT EXISTS antidoping_whereabouts_ok BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elearning_antidoping_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elearning_completed_at DATE,
  ADD COLUMN IF NOT EXISTS elearning_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS ethics_charter_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ethics_charter_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ethics_charter_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS rule40_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule40_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rule40_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_comment TEXT;

CREATE TABLE IF NOT EXISTS public.kyc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.user_profiles(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  axis TEXT,
  comment TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.kyc_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.kyc_history;
CREATE POLICY "auth_all" ON public.kyc_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.kyc_history TO authenticated, anon, service_role;
