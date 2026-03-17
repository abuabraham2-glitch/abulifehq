
CREATE TABLE public.life_context (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.life_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on life_context"
ON public.life_context
FOR ALL
USING (true)
WITH CHECK (true);
