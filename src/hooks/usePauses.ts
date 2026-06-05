import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayStr } from './useDailyPlan';

export interface PauseRow {
  id: string;
  start_date: string;
  end_date: string;
}

export function usePauses() {
  return useQuery({
    queryKey: ['pauses', 'active'],
    queryFn: async () => {
      const today = todayStr();
      const { data, error } = await supabase
        .from('pauses')
        .select('id, start_date, end_date')
        .gte('end_date', today)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PauseRow[];
    },
  });
}

export function useTodayPause() {
  const { data: rows = [], ...rest } = usePauses();
  const today = todayStr();
  const todayPause = rows.find((r) => r.start_date <= today && r.end_date >= today) ?? null;
  return { todayPause, ...rest };
}

export function useInvalidatePauses() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['pauses'] });
}
