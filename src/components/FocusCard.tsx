import type { PlanItem } from '@/hooks/useDailyPlan';
import { FocusTimer } from '@/components/FocusTimer';
import { formatTime12h, getCategoryColor } from '@/lib/constants';

interface Props {
  item: PlanItem;
  isOverdue: boolean;
  isTomorrow: boolean;
  onSkip: (item: PlanItem) => void;
  onDone: (item: PlanItem) => void;
}

export function FocusCard({ item, isOverdue, isTomorrow, onSkip, onDone }: Props) {
  const label = isTomorrow ? 'FIRST UP' : 'NOW';
  const labelColor = isTomorrow ? 'hsl(var(--muted-foreground))' : 'hsl(var(--sage-amber))';

  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        backgroundColor: 'hsl(var(--card))',
        borderLeft: '4px solid hsl(var(--sage-amber))',
        border: '1px solid hsl(var(--border))',
        borderLeftWidth: '4px',
        borderLeftColor: 'hsl(var(--sage-amber))',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-bold tracking-[0.1em]"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        {isOverdue && !isTomorrow && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground">
            Overdue
          </span>
        )}
      </div>

      <h2 className="text-[20px] font-medium mb-1 break-words" style={{ color: 'hsl(var(--foreground))' }}>
        {item.title}
      </h2>

      <p className="text-[13px] mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
        {!item.is_calendar_event && ` · ${item.est_minutes || 0} min`}
        {item.category && ` · ${item.category}`}
      </p>

      {!isTomorrow && (
        <>
          <FocusTimer />
          <div className="flex gap-2 w-full">
            <button
              onClick={() => onSkip(item)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
              style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            >
              Skip
            </button>
            <button
              onClick={() => onDone(item)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
              style={{ backgroundColor: 'hsl(var(--sage-amber))', color: '#fff' }}
            >
              ▶ Start
            </button>
            <button
              onClick={() => onDone(item)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
              style={{ backgroundColor: 'hsl(var(--sage-success))', color: '#fff' }}
            >
              ✓ Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
