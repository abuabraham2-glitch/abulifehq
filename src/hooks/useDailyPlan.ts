import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayISO } from '@/lib/categories';
import type { Tables } from '@/integrations/supabase/types';

export type DailyPlan = Tables<'daily_plans'>;
export type PlanItem = Tables<'plan_items'>;

export function useTodayPlan() {
  return useQuery({
    queryKey: ['daily_plan', 'today'],
    queryFn: async () => {
      const today = todayISO();
      const { data, error } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('plan_date', today)
        .maybeSingle();
      if (error) throw error;
      return data as DailyPlan | null;
    },
  });
}

export function useTodayPlanItems() {
  const { data: plan } = useTodayPlan();

  return useQuery({
    queryKey: ['plan_items', plan?.id],
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
