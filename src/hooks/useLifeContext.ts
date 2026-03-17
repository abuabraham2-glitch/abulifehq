import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLatestLifeContext() {
  return useQuery({
    queryKey: ['life-context', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('life_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLifeContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contextText: string) => {
      const { data, error } = await supabase
        .from('life_context')
        .insert({ context_text: contextText })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['life-context'] }),
  });
}
