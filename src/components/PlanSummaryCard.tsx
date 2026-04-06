import { useTodayPlanItems } from '@/hooks/useDailyPlan';
import { formatTime12h } from '@/lib/constants';

interface PlanSummaryCardProps {
  onDismiss: () => void;
}

export function PlanSummaryCard({ onDismiss }: PlanSummaryCardProps) {
  const { data: items } = useTodayPlanItems();

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
      <p className="text-[13px] font-medium mb-3" style={{ color: '#B8906C' }}>📋 Today's plan</p>

      <div className="space-y-0">
        {items.map((item, i) => (
          <div key={item.id}>
            {i > 0 && (
              <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }} />
            )}
            <div className="flex items-baseline gap-3 py-2 min-h-[36px]">
              <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap w-[80px] flex-shrink-0 tabular-nums">
                {formatTime12h(item.start_time)}
              </span>
              <span className="text-[13px] text-foreground flex-1 min-w-0">{item.title}</span>
              {item.est_minutes != null && (
                <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0 whitespace-nowrap">
                  {item.est_minutes}m
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-right mt-2">
        <button onClick={onDismiss} className="text-[13px] font-medium min-h-[44px] md:min-h-0" style={{ color: '#B8906C' }}>
          Got it, dismiss
        </button>
      </div>
    </div>
  );
}
