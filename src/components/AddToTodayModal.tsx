import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Search, Plus, Zap, ListChecks, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTasks, type Task } from '@/hooks/useTasks';
import { useTodayPlan, useTodayPlanItems, todayStr } from '@/hooks/useDailyPlan';
import { getCategoryColor } from '@/lib/constants';
import { findNextSlot, pacificIso } from '@/lib/planScheduling';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const CREATE_EVENT_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-create-event';

const QUADRANT_ORDER: Record<string, number> = {
  'Do Now': 0,
  'Schedule': 1,
  'Delegate': 2,
  'Delete': 3,
};

export function AddToTodayModal({ open, onOpenChange }: Props) {
  const [view, setView] = useState<'menu' | 'pick' | 'quick'>('menu');
  const [search, setSearch] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickMinutes, setQuickMinutes] = useState(30);
  const [busy, setBusy] = useState(false);

  const { data: plan } = useTodayPlan();
  const { data: planItems } = useTodayPlanItems();
  const { data: activeTasks } = useActiveTasks();
  const qc = useQueryClient();

  const reset = () => {
    setView('menu');
    setSearch('');
    setQuickTitle('');
    setQuickMinutes(30);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const sortedTasks = useMemo(() => {
    const list = (activeTasks ?? []).filter((t) => {
      if (!search.trim()) return true;
      return t.name.toLowerCase().includes(search.toLowerCase());
    });
    return list.sort((a, b) => {
      const qa = QUADRANT_ORDER[a.quadrant ?? 'Delete'] ?? 4;
      const qb = QUADRANT_ORDER[b.quadrant ?? 'Delete'] ?? 4;
      if (qa !== qb) return qa - qb;
      return (a.priority_order ?? 999) - (b.priority_order ?? 999);
    });
  }, [activeTasks, search]);

  const insertAndSync = async (params: {
    title: string;
    estMinutes: number;
    category: string;
    taskId: string | null;
    localOnly: boolean;
  }) => {
    if (!plan?.id) {
      toast.error("Today's plan isn't loaded yet.");
      return;
    }
    setBusy(true);
    try {
      const slot = findNextSlot(planItems ?? [], params.estMinutes);
      const maxSort = Math.max(0, ...(planItems ?? []).map((i) => i.sort_order ?? 0));

      const { data: inserted, error } = await supabase
        .from('plan_items')
        .insert({
          plan_id: plan.id,
          task_id: params.taskId,
          title: params.title,
          category: params.category,
          start_time: slot.start,
          end_time: slot.end,
          est_minutes: params.estMinutes,
          status: 'pending',
          is_calendar_event: false,
          sort_order: maxSort + 1,
          local_only: params.localOnly,
        })
        .select()
        .single();

      if (error || !inserted) throw error ?? new Error('Insert failed');

      // Refresh immediately so the new row shows up
      qc.invalidateQueries({ queryKey: ['daily-plan'] });

      // Fire-and-forget calendar event creation
      const dateStr = todayStr();
      fetch(CREATE_EVENT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          start: pacificIso(dateStr, slot.start),
          end: pacificIso(dateStr, slot.end),
          category: params.category,
          planItemId: inserted.id,
        }),
      })
        .then(() => qc.invalidateQueries({ queryKey: ['daily-plan'] }))
        .catch(() => {});

      toast.success(`Added: ${params.title}`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add task');
    } finally {
      setBusy(false);
    }
  };

  const handlePickTask = (t: Task) => {
    insertAndSync({
      title: t.name,
      estMinutes: t.est_minutes ?? 30,
      category: t.category ?? 'Personal',
      taskId: t.id,
      localOnly: false,
    });
  };

  const handleQuickAdd = () => {
    const title = quickTitle.trim();
    if (!title) return;
    insertAndSync({
      title,
      estMinutes: quickMinutes,
      category: 'Personal',
      taskId: null,
      localOnly: true,
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px] max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: '#F5F0E8' }}
      >
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button onClick={() => setView('menu')} className="p-1 -ml-1 text-muted-foreground" aria-label="Back">
                <ArrowLeft size={18} />
              </button>
            )}
            <SheetTitle className="text-[16px]">
              {view === 'menu' && 'Add to today'}
              {view === 'pick' && 'Pick a task to add'}
              {view === 'quick' && 'Quick add to today'}
            </SheetTitle>
          </div>
        </SheetHeader>

        {view === 'menu' && (
          <div className="space-y-2 mt-4 pb-6">
            <button
              onClick={() => setView('pick')}
              className="w-full flex items-center gap-3 p-4 rounded-[14px] bg-card text-left min-h-[64px]"
              style={{ border: '1px solid #E8D5B8' }}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFF8F0' }}
              >
                <ListChecks size={18} style={{ color: '#5C3D1E' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground">Pick from my tasks</p>
                <p className="text-[12px] text-muted-foreground">Add an existing task to today</p>
              </div>
            </button>

            <button
              onClick={() => setView('quick')}
              className="w-full flex items-center gap-3 p-4 rounded-[14px] bg-card text-left min-h-[64px]"
              style={{ border: '1px solid #E8D5B8' }}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFF8F0' }}
              >
                <Zap size={18} style={{ color: '#B8906C' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground">Quick add</p>
                <p className="text-[12px] text-muted-foreground">One-off thing for today</p>
              </div>
            </button>
          </div>
        )}

        {view === 'pick' && (
          <div className="mt-4 pb-6">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 rounded-xl bg-card"
                autoFocus
              />
            </div>
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
              {sortedTasks.length === 0 && (
                <p className="text-[13px] text-muted-foreground text-center py-6">No active tasks</p>
              )}
              {sortedTasks.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => handlePickTask(t)}
                  className="w-full flex items-center gap-3 p-3 rounded-[12px] bg-card text-left min-h-[56px] disabled:opacity-50"
                  style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(t.category) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.category ?? 'Personal'} · {t.est_minutes ?? 30}m
                    </p>
                  </div>
                  <Plus size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'quick' && (
          <div className="mt-4 pb-6 space-y-4">
            <Input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Task title"
              className="rounded-xl bg-card text-[15px] min-h-[44px]"
              autoFocus
            />
            <div>
              <p className="text-[12px] font-medium text-muted-foreground mb-2">Time estimate</p>
              <div className="flex gap-2">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => setQuickMinutes(m)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium border min-h-[44px]"
                    style={{
                      borderColor: quickMinutes === m ? '#B8906C' : 'hsl(var(--border))',
                      backgroundColor: quickMinutes === m ? '#B8906C' : 'transparent',
                      color: quickMinutes === m ? '#fff' : 'hsl(var(--foreground))',
                    }}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleQuickAdd}
              disabled={!quickTitle.trim() || busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-medium min-h-[48px] text-white disabled:opacity-50"
              style={{ backgroundColor: '#5C3D1E' }}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Add to today
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
