import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type TriageItem = Tables<'triage_queue'>;

// Unified triage item that works for both sources
export type UnifiedTriageItem = {
  id: string;
  task_id: string;
  source: 'triage_queue' | 'orphan_task';
  suggested_category: string | null;
  suggested_quadrant: string | null;
  suggested_est_minutes: number | null;
  ai_reasoning: string | null;
  tasks: Tables<'tasks'> | null;
};

export function useTriageCount() {
  return useQuery({
    queryKey: ['triage', 'count'],
    queryFn: async () => {
      // Count from triage_queue
      const { count: queueCount, error: e1 } = await supabase
        .from('triage_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (e1) throw e1;

      // Count orphan tasks (needs_triage=true, active, no pending triage_queue row)
      const { data: orphans, error: e2 } = await supabase
        .from('tasks')
        .select('id')
        .eq('needs_triage', true)
        .eq('status', 'active');
      if (e2) throw e2;

      // Get task_ids already in pending triage_queue
      const { data: queued, error: e3 } = await supabase
        .from('triage_queue')
        .select('task_id')
        .eq('status', 'pending');
      if (e3) throw e3;

      const queuedIds = new Set(queued?.map((q) => q.task_id) ?? []);
      const orphanCount = orphans?.filter((t) => !queuedIds.has(t.id)).length ?? 0;

      return (queueCount ?? 0) + orphanCount;
    },
  });
}

export function usePendingTriage() {
  return useQuery({
    queryKey: ['triage', 'pending'],
    queryFn: async () => {
      // Source 1: triage_queue with status=pending
      const { data: queueItems, error: e1 } = await supabase
        .from('triage_queue')
        .select('*, tasks(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (e1) throw e1;

      const queuedTaskIds = new Set(
        (queueItems ?? []).map((q) => q.task_id).filter(Boolean)
      );

      // Source 2: orphan tasks needing triage without a triage_queue row
      const { data: orphanTasks, error: e2 } = await supabase
        .from('tasks')
        .select('*')
        .eq('needs_triage', true)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (e2) throw e2;

      const unified: UnifiedTriageItem[] = [];

      // Add triage_queue items
      for (const item of queueItems ?? []) {
        unified.push({
          id: item.id,
          task_id: item.task_id ?? '',
          source: 'triage_queue',
          suggested_category: item.suggested_category,
          suggested_quadrant: item.suggested_quadrant,
          suggested_est_minutes: item.suggested_est_minutes,
          ai_reasoning: item.ai_reasoning,
          tasks: item.tasks as any,
        });
      }

      // Add orphan tasks not already in triage_queue
      for (const task of orphanTasks ?? []) {
        if (!queuedTaskIds.has(task.id)) {
          unified.push({
            id: `orphan-${task.id}`,
            task_id: task.id,
            source: 'orphan_task',
            suggested_category: task.category,
            suggested_quadrant: task.quadrant,
            suggested_est_minutes: task.est_minutes,
            ai_reasoning: null,
            tasks: task,
          });
        }
      }

      return unified;
    },
  });
}

export function useResolveTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Orphan tasks don't have a triage_queue row to update
      if (id.startsWith('orphan-')) return;
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
