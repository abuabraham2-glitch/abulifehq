import { useMemo } from 'react';
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
      style={{ backgroundColor: '#EEF4FF', border: '0.5px solid #C5D8F5' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
        <p className="text-[12px] font-medium tracking-wide" style={{ color: '#3B82F6' }}>
          On your calendar today
        </p>
      </div>
      <div className="space-y-2">
        {calEvents.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 min-h-[32px]">
            <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: '#3B82F6' }}>
              {formatTime12h(ev.start_time)}
            </span>
            <span className="text-[13px] text-foreground truncate flex-1">{ev.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
