import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TriageItem {
  id: string;
  task_id: string | null;
  suggested_category: string | null;
  suggested_quadrant: string | null;
  suggested_est_minutes: number | null;
  ai_reasoning: string | null;
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
  task: {
    id: string;
    name: string;
    category: string | null;
    quadrant: string | null;
    est_minutes: number | null;
  } | null;
}

export function useTriageQueue() {
  return useQuery({
    queryKey: ['triage', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('triage_queue')
        .select('*, task:tasks(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TriageItem[];
    },
  });
}

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

export function useApproveTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: TriageItem) => {
      if (item.task_id) {
        await supabase.from('tasks').update({
          category: item.suggested_category,
          quadrant: item.suggested_quadrant,
          est_minutes: item.suggested_est_minutes,
          needs_triage: false,
          ai_categorized: true,
        }).eq('id', item.task_id);
      }
      await supabase.from('triage_queue').update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
      }).eq('id', item.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDismissTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: TriageItem) => {
      if (item.task_id) {
        await supabase.from('tasks').update({ status: 'archived' }).eq('id', item.task_id);
      }
      await supabase.from('triage_queue').update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
      }).eq('id', item.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useModifyTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ triageId }: { triageId: string }) => {
      await supabase.from('triage_queue').update({
        status: 'modified',
        resolved_at: new Date().toISOString(),
      }).eq('id', triageId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
