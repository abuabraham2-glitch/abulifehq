import { useState, useCallback } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTodayPlanItems, type PlanItem } from '@/hooks/useDailyPlan';

export function ReprioritizeSection() {
  const { data: items } = useTodayPlanItems();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Filter to pending real tasks (exclude AI filler blocks)
  const skipTitle = (t: string) => {
    const l = t.toLowerCase();
    return l.startsWith('buffer') || l === 'lunch break' || l.includes('victory hour') || l.startsWith('school pickup') || l.includes('wind down') || l.includes('morning routine');
  };
  const pendingTasks = (items ?? [])
    .filter((i) => !i.is_calendar_event && !skipTitle(i.title) && i.status !== 'completed' && i.status !== 'skipped')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [order, setOrder] = useState<string[] | null>(null);

  // Sync order when opening
  const toggle = () => {
    if (!open) {
      setOrder(pendingTasks.map((t) => t.id));
    }
    setOpen((v) => !v);
  };

  const orderedTasks = order
    ? order.map((id) => pendingTasks.find((t) => t.id === id)).filter(Boolean) as PlanItem[]
    : pendingTasks;

  const move = (idx: number, dir: -1 | 1) => {
    if (!order) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    const next = [...order];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setOrder(next);
  };

  const handleReschedule = async () => {
    const names = orderedTasks.map((t) => t.title);
    setSending(true);
    try {
      await fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '8311812333',
          message: `Re-prioritize my tasks for today in this order: [${names.join(', ')}]`,
        }),
      });
      toast('Rescheduling your day...');
      setOpen(false);
    } catch {
      toast.error('Failed to send — try again');
    } finally {
      setSending(false);
    }
  };

  if (pendingTasks.length === 0) return null;

  return (
    <div className="rounded-[14px] bg-card" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 p-4 min-h-[48px]"
      >
        <ArrowUpDown size={16} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left text-[14px] font-medium text-foreground">Re-prioritize today</span>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {orderedTasks.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg p-2.5 min-h-[44px]"
              style={{ backgroundColor: 'hsl(var(--secondary))' }}
            >
              <span className="text-[13px] font-semibold text-muted-foreground w-5 text-center flex-shrink-0">
                {idx + 1}
              </span>
              <span className="flex-1 text-[14px] text-foreground truncate">{item.title}</span>
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-accent disabled:opacity-30"
                >
                  <ChevronUp size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === orderedTasks.length - 1}
                  className="p-1 rounded hover:bg-accent disabled:opacity-30"
                >
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleReschedule}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
            style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
          >
            {sending && <Loader2 size={16} className="animate-spin" />}
            Reschedule based on this order
          </button>
        </div>
      )}
    </div>
  );
}
