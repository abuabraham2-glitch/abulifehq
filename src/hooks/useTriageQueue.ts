import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type TriageItem = Tables<'triage_queue'>;

export function useTriageCount() {
  return useQuery({
    queryKey: ['triage', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('triage_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function usePendingTriage() {
  return useQuery({
    queryKey: ['triage', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('triage_queue')
        .select('*, tasks(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useResolveTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('triage_queue')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
