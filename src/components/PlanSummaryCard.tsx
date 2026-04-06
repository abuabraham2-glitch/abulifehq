import { useTodayPlan } from '@/hooks/useDailyPlan';

interface PlanSummaryCardProps {
  onDismiss: () => void;
}

export function PlanSummaryCard({ onDismiss }: PlanSummaryCardProps) {
  const { data: plan } = useTodayPlan();

  const notes = plan?.ai_notes?.trim();
  if (!notes) return null;

  return (
    <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
      <p className="text-[13px] font-medium mb-2" style={{ color: '#B8906C' }}>📋 Today's plan notes</p>
      <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{notes}</p>
      <div className="text-right mt-2">
        <button onClick={onDismiss} className="text-[13px] font-medium min-h-[44px] md:min-h-0" style={{ color: '#B8906C' }}>
          Got it, dismiss
        </button>
      </div>
    </div>
  );
}
