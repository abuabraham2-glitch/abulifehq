import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type DailyPlan = Tables<'daily_plans'>;
export type PlanItem = Tables<'plan_items'>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
