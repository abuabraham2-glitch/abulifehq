import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayStr } from '@/hooks/useDailyPlan';
import { addDays, format, parse } from 'date-fns';

interface PatternMatch {
  taskId: string;
  taskName: string;
  consecutiveDays: number;
}

export function PatternInsightCard() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [deferMode, setDeferMode] = useState<string | null>(null);
  const [deferText, setDeferText] = useState('2 weeks');

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['pattern-insights'],
    queryFn: async () => {
      const today = todayStr();
      const sevenAgo = (() => {
        const d = new Date(today + 'T00:00:00');
        d.setDate(d.getDate() - 7);
        return format(d, 'yyyy-MM-dd');
      })();

      // Get plans from last 7 days
      const { data: plans, error: pe } = await supabase
        .from('daily_plans')
        .select('id, plan_date')
        .gte('plan_date', sevenAgo)
        .lte('plan_date', today)
        .order('plan_date', { ascending: true });
      if (pe || !plans?.length) return [];

      const planIds = plans.map((p) => p.id);

      // Get relevant plan items
      const { data: items, error: ie } = await supabase
        .from('plan_items')
        .select('task_id, title, status, plan_id')
        .in('plan_id', planIds)
        .eq('is_calendar_event', false)
        .not('task_id', 'is', null)
        .in('status', ['skipped', 'carried_over']);
      if (ie || !items?.length) return [];

      // Map plan_id -> plan_date
      const planDateMap = new Map(plans.map((p) => [p.id, p.plan_date]));

      // Group by task_id -> set of dates
      const taskDates = new Map<string, { name: string; dates: Set<string> }>();
      for (const item of items) {
        if (!item.task_id) continue;
        const date = planDateMap.get(item.plan_id!);
        if (!date) continue;
        if (!taskDates.has(item.task_id)) {
          taskDates.set(item.task_id, { name: item.title, dates: new Set() });
        }
        taskDates.get(item.task_id)!.dates.add(date);
      }

      // Find consecutive days >= 2
      const results: PatternMatch[] = [];
      for (const [taskId, { name, dates }] of taskDates) {
        const sorted = Array.from(dates).sort();
        let maxConsec = 1;
        let curConsec = 1;
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1] + 'T00:00:00');
          const curr = new Date(sorted[i] + 'T00:00:00');
          const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays === 1) {
            curConsec++;
            maxConsec = Math.max(maxConsec, curConsec);
          } else {
            curConsec = 1;
          }
        }
        if (maxConsec >= 2) {
          results.push({ taskId, taskName: name, consecutiveDays: maxConsec });
        }
      }

      return results.sort((a, b) => b.consecutiveDays - a.consecutiveDays);
    },
    staleTime: 5 * 60 * 1000,
  });

  const visible = useMemo(
    () => patterns.filter((p) => !dismissed.includes(p.taskId)),
    [patterns, dismissed],
  );

  const current = visible[0] ?? null;

  const dismiss = (taskId: string) => {
    setDismissed((prev) => [...prev, taskId]);
    setDeferMode(null);
  };

  const parseDuration = (text: string): number => {
    const t = text.trim().toLowerCase();
    const match = t.match(/^(\d+)\s*(day|week|month)s?$/);
    if (!match) return 14; // default 2 weeks
    const num = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'day') return num;
    if (unit === 'week') return num * 7;
    if (unit === 'month') return num * 30;
    return 14;
  };

  const handleDefer = async (pattern: PatternMatch) => {
    const days = parseDuration(deferText);
    const deferDate = new Date();
    deferDate.setDate(deferDate.getDate() + days);
    const dateStr = format(deferDate, 'yyyy-MM-dd');

    await supabase
      .from('tasks')
      .update({ status: 'deferred', deferred_until: dateStr } as any)
      .eq('id', pattern.taskId);

    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
    dismiss(pattern.taskId);
  };

  if (isLoading || !current) return null;

  return (
    <div
      className="rounded-[14px] p-4"
      style={{ backgroundColor: '#FFF8F0', border: '0.5px solid #E8D5B8' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B8906C' }} />
        <p className="text-[12px] font-medium tracking-wide" style={{ color: '#B8906C' }}>
          Pattern noticed
        </p>
      </div>

      <p className="text-[14px] font-medium text-foreground mb-1">{current.taskName}</p>
      <p className="text-[13px] text-muted-foreground mb-3">
        Skipped or not completed {current.consecutiveDays} days in a row
      </p>

      {deferMode === current.taskId ? (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground flex-shrink-0">How far?</span>
          <input
            type="text"
            value={deferText}
            onChange={(e) => setDeferText(e.target.value)}
            className="flex-1 h-9 rounded-lg border px-3 text-[13px] bg-background border-input"
          />
          <button
            onClick={() => handleDefer(current)}
            className="px-4 h-9 rounded-lg text-[13px] font-medium"
            style={{ backgroundColor: '#B8906C', color: '#fff' }}
          >
            Confirm
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">Push it back?</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDeferText('2 weeks');
                setDeferMode(current.taskId);
              }}
              className="px-4 h-9 rounded-lg text-[13px] font-medium"
              style={{ backgroundColor: '#B8906C', color: '#fff' }}
            >
              Defer it
            </button>
            <button
              onClick={() => dismiss(current.taskId)}
              className="px-4 h-9 rounded-lg text-[13px] font-medium"
              style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}
            >
              Keep scheduling
            </button>
          </div>
          <button
            onClick={() => dismiss(current.taskId)}
            className="text-[12px] text-muted-foreground hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
