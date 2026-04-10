import { useMemo } from 'react';
import { Calendar, X, RotateCcw, Pencil } from 'lucide-react';
import type { PlanItem } from '@/hooks/useDailyPlan';
import { formatTime12h, getCategoryColor } from '@/lib/constants';

interface Props {
  items: PlanItem[];
  activeItemId: string | null;
  nowTime: string;
  isTomorrow: boolean;
  onRemove: (item: PlanItem) => void;
  onDone: (item: PlanItem) => void;
  onSkip: (item: PlanItem) => void;
  onUndo: (item: PlanItem) => void;
}

export function Timeline({ items, activeItemId, nowTime, isTomorrow, onRemove, onDone, onSkip, onUndo }: Props) {
  // Filter out the active item — it's shown in the Focus Card
  const timelineItems = useMemo(
    () => items.filter((i) => i.id !== activeItemId),
    [items, activeItemId],
  );

  if (timelineItems.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.1em] mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
        YOUR DAY
      </p>
      <div className="relative pl-5">
        {/* Vertical timeline line */}
        <div
          className="absolute left-[7px] top-0 bottom-0 w-[2px]"
          style={{ backgroundColor: 'hsl(var(--border))' }}
        />

        <div className="space-y-1">
          {timelineItems.map((item) => {
            const isCompleted = item.status === 'completed';
            const isSkipped = item.status === 'skipped';
            const isPast = !isTomorrow && (isCompleted || isSkipped || item.end_time < nowTime);
            const isFuture = !isTomorrow && !isPast && item.start_time > nowTime;

            const opacity = isTomorrow ? 1 : isPast ? 0.4 : isFuture ? 0.7 : 1;

            // Calendar event
            if (item.is_calendar_event) {
              return (
                <div key={item.id} className="relative flex items-center gap-3 rounded-lg p-3 min-h-[44px]" style={{ opacity, backgroundColor: 'hsl(var(--calendar-bg))' }}>
                  {/* Dot on timeline */}
                  <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-[8px] h-[8px] rounded-full" style={{ backgroundColor: 'hsl(var(--calendar-text))' }} />
                  <Calendar size={14} style={{ color: 'hsl(var(--calendar-text))' }} />
                  <span className="text-[12px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {formatTime12h(item.start_time)}
                  </span>
                  <span className="text-[13px] flex-1 truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {item.title}
                  </span>
                </div>
              );
            }

            const dotColor = (isCompleted || isSkipped)
              ? 'hsl(var(--border))'
              : getCategoryColor(item.category);

            return (
              <div
                key={item.id}
                className="relative flex items-center gap-3 rounded-lg p-3 min-h-[44px]"
                style={{ opacity }}
              >
                {/* Dot on timeline */}
                <div
                  className="absolute -left-5 top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: dotColor,
                  }}
                />

                <span className="text-[12px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {formatTime12h(item.start_time)}
                </span>

                <span
                  className={`text-[13px] flex-1 truncate ${(isCompleted || isSkipped) ? 'line-through' : ''}`}
                  style={{ color: 'hsl(var(--foreground))' }}
                >
                  {item.title}
                </span>

                <span className="text-[11px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {item.est_minutes || 0}m
                </span>

                {/* Action buttons — only on Today */}
                {!isTomorrow && (
                  <div className="flex gap-1 flex-shrink-0">
                    {isCompleted && (
                      <button
                        onClick={() => onDone(item)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1"
                        style={{ color: 'hsl(var(--muted-foreground))' }}
                      >
                        <Pencil size={10} /> Edit
                      </button>
                    )}
                    {isSkipped && (
                      <button
                        onClick={() => onUndo(item)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1"
                        style={{ color: 'hsl(var(--muted-foreground))' }}
                      >
                        <RotateCcw size={10} /> Undo
                      </button>
                    )}
                    {!isCompleted && !isSkipped && (
                      <button
                        onClick={() => onRemove(item)}
                        className="p-1 rounded-full hover:bg-secondary transition-colors"
                        aria-label="Remove item"
                      >
                        <X size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
