import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Task = Tables<'tasks'> & { priority_order?: number | null };

export function useTasks(filters?: {
  category?: string;
  quadrant?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (filters?.category && filters.category !== 'All') {
        query = query.eq('category', filters.category);
      }
      if (filters?.quadrant && filters.quadrant !== 'All') {
        query = query.eq('quadrant', filters.quadrant);
      }
      if (filters?.status === 'Active') {
        query = query.eq('status', 'active');
      } else if (filters?.status === 'Completed') {
        query = query.eq('status', 'completed');
      } else if (filters?.status === 'Archived') {
        query = query.eq('status', 'archived');
      } else if (!filters?.status || filters.status === 'All') {
        query = query.in('status', ['active', 'completed', 'archived']);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Sort by priority_order if available, then created_at
      const tasks = data as Task[];
      if (filters?.quadrant && filters.quadrant !== 'All') {
        tasks.sort((a, b) => {
          const aPri = a.priority_order ?? 999999;
          const bPri = b.priority_order ?? 999999;
          if (aPri !== bPri) return aPri - bPri;
          return 0; // keep DB order
        });
      }
      return tasks;
    },
  });
}

export function useActiveTasks() {
  return useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: TablesInsert<'tasks'>) => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'tasks'> & { id: string }) => {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
    },
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
    },
  });
}

export function usePurgeArchivedTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('status', 'archived');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['triage'] });
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
    },
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('tasks').update({ priority_order: index } as any).eq('id', id)
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
