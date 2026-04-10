import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useTodayPlanItems } from '@/hooks/useDailyPlan';
import { formatTime12h } from '@/lib/constants';

export function CalendarBanner() {
  const { data: items } = useTodayPlanItems();

  const calEvents = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.is_calendar_event)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [items],
  );

  if (calEvents.length === 0) return null;

  return (
    <div
      className="rounded-[14px] p-4"
      style={{ backgroundColor: 'hsl(var(--calendar-bg))', border: '1px solid hsl(var(--border))' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} style={{ color: 'hsl(var(--calendar-text))' }} />
        <p className="text-[12px] font-medium tracking-wide" style={{ color: 'hsl(var(--calendar-text))' }}>
          On your calendar today
        </p>
      </div>
      <div className="space-y-2">
        {calEvents.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 min-h-[32px]">
            <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: 'hsl(var(--calendar-text))' }}>
              {formatTime12h(ev.start_time)}
            </span>
            <span className="text-[13px] text-foreground truncate flex-1">{ev.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
