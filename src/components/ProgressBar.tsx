import { useMemo } from 'react';
import type { PlanItem } from '@/hooks/useDailyPlan';

interface Props {
  planItems: PlanItem[];
  activeItemId: string | null;
}

const skipTitle = (t: string) => {
  const l = t.toLowerCase();
  return (
    l.startsWith('buffer') ||
    l === 'lunch break' ||
    l.includes('victory hour') ||
    l.startsWith('school pickup') ||
    l.includes('wind down') ||
    l.includes('morning routine')
  );
};

export function ProgressBar({ planItems, activeItemId }: Props) {
  const realTasks = useMemo(
    () => planItems.filter((i) => !i.is_calendar_event && !skipTitle(i.title)),
    [planItems],
  );

  const completedCount = useMemo(
    () => realTasks.filter((i) => i.status === 'completed').length,
    [realTasks],
  );

  if (realTasks.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1 flex-1">
        {realTasks.map((item) => {
          const isCompleted = item.status === 'completed';
          const isActive = item.id === activeItemId;
          return (
            <div
              key={item.id}
              className="flex-1 rounded-full transition-all"
              style={{
                height: isActive ? '8px' : '6px',
                backgroundColor: isCompleted
                  ? 'hsl(var(--sage-success))'
                  : isActive
                  ? 'hsl(var(--sage-amber))'
                  : 'hsl(var(--sage-progress-remaining))',
              }}
            />
          );
        })}
      </div>
      <span className="text-[12px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {completedCount} of {realTasks.length} done
      </span>
    </div>
  );
}
