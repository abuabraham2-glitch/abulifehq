import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTodayPlanItems } from '@/hooks/useDailyPlan';

function todayPacific() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DayStripCard() {
  const today = todayPacific();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('daystrip_dismissed_date') === today;
  });

  const { data: items } = useTodayPlanItems();

  const taskItems = useMemo(
    () => items?.filter((i) => !i.is_calendar_event && i.task_id != null) ?? [],
    [items],
  );

  const taskCount = taskItems.length;
  const totalMin = useMemo(
    () => taskItems.reduce((s, i) => s + (i.est_minutes || 0), 0),
    [taskItems],
  );
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const timeLabel = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;

  if (dismissed || !items) return null;

  const handleDismiss = () => {
    localStorage.setItem('daystrip_dismissed_date', today);
    setDismissed(true);
  };

  return (
    <div
      className="relative rounded-[14px] bg-card p-4 flex items-center"
      style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
    >
      <div className="flex flex-1 items-center">
        {/* Left stat */}
        <div className="flex-1 text-center">
          <p className="text-[20px] font-semibold text-foreground">{taskCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Tasks today</p>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-border" />

        {/* Right stat */}
        <div className="flex-1 text-center">
          <p className="text-[20px] font-semibold text-foreground">{timeLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Work planned</p>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 p-1 rounded-full text-muted-foreground hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}
