import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type DailyPlan = Tables<'daily_plans'>;
export type PlanItem = Tables<'plan_items'>;

function todayStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useTodayPlan() {
  return useQuery({
    queryKey: ['daily-plan', 'today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('plan_date', todayStr())
        .maybeSingle();
      if (error) throw error;
      return data as DailyPlan | null;
    },
  });
}

export function useTodayPlanItems() {
  const { data: plan } = useTodayPlan();
  return useQuery({
    queryKey: ['daily-plan', 'items', plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_items')
        .select('*')
        .eq('plan_id', plan!.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PlanItem[];
    },
  });
}

export function useUpdatePlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, actual_minutes }: { id: string; status: string; actual_minutes?: number }) => {
      const update: Record<string, unknown> = { status };
      if (actual_minutes !== undefined) update.actual_minutes = actual_minutes;
      const { error } = await supabase.from('plan_items').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
    },
  });
}
