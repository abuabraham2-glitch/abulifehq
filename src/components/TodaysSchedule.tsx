import { useState, useMemo } from 'react';
import { Check, Calendar, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { usePlanItemsByDate, useUpdatePlanItem, todayStr, tomorrowStr, type PlanItem } from '@/hooks/useDailyPlan';
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks';
import { formatTime12h, getCategoryColor } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const SKIP_TITLE = (t: string) => {
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

function getNextMonday(weeksAhead: number = 1): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = d.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday + (weeksAhead - 1) * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface Props {
  viewTomorrow: boolean;
  onToggleTab: () => void;
}

export function TodaysSchedule({ viewTomorrow, onToggleTab }: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pushItem, setPushItem] = useState<PlanItem | null>(null);
  const [pickDateOpen, setPickDateOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);

  const nowTime = useMemo(() => {
    const pac = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const h = String(pac.getHours()).padStart(2, '0');
    const m = String(pac.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }, []);

  const sortedItems = useMemo(() => {
    return [...(planItems ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [planItems]);

  const activeItemId = useMemo(() => {
    if (viewTomorrow) return null;
    const pending = sortedItems.filter((i) => i.status !== 'completed' && i.status !== 'skipped');
    if (pending.length === 0) return null;
    const upcoming = pending.find((i) => i.start_time >= nowTime);
    return upcoming?.id ?? pending[0]?.id ?? null;
  }, [sortedItems, nowTime, viewTomorrow]);

  const activeItem = useMemo(() => sortedItems.find((i) => i.id === activeItemId) ?? null, [sortedItems, activeItemId]);
  const activeIsOverdue = useMemo(() => {
    if (!activeItem || viewTomorrow) return false;
    return activeItem.start_time < nowTime;
  }, [activeItem, nowTime, viewTomorrow]);

  const fireWebhook = (item: PlanItem) => {
    fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
    }).catch(() => {});
  };

  const openDoneDialog = (item: PlanItem) => {
    setActualMinutes(item.actual_minutes ?? item.est_minutes ?? 25);
    setDoneItem(item);
  };

  const handleSaveDone = async () => {
    if (!doneItem) return;
    await updatePlanItem.mutateAsync({
      id: doneItem.id,
      status: 'completed',
      actual_minutes: actualMinutes,
    });
    if (doneItem.task_id) {
      await completeTask.mutateAsync(doneItem.task_id);
    }
    fireWebhook(doneItem);
    setDoneItem(null);
  };

  // Push = skip to tomorrow (same as old skip)
  const handlePushTomorrow = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({
      id: item.id,
      status: 'skipped',
    });
    fireWebhook(item);
    setPushItem(null);
    setExpandedId(null);
  };

  // Push = defer to a date (next week, 2 weeks, or picked date)
  const handleDefer = async (item: PlanItem, deferDate: string) => {
    // Update task if task_id exists
    if (item.task_id) {
      await updateTask.mutateAsync({ id: item.task_id, status: 'active', deferred_until: deferDate });
    }
    // Delete the plan_item
    await supabase.from('plan_items').delete().eq('id', item.id);
    fireWebhook(item);
    queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
    setPushItem(null);
    setPickDateOpen(false);
    setExpandedId(null);
  };

  const handleActuallyDone = (item: PlanItem) => {
    updatePlanItem.mutateAsync({ id: item.id, status: 'pending' }).then(() => {
      openDoneDialog({ ...item, status: 'pending' });
    });
  };

  if (isLoading) return null;

  // Tomorrow with no plan
  if (viewTomorrow && !sortedItems.length) {
    return (
      <div>
        <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-muted-foreground">Tomorrow's plan hasn't been generated yet.</p>
          <p className="text-[13px] text-muted-foreground mt-1">It will arrive at 9pm tonight.</p>
        </div>
      </div>
    );
  }

  if (!sortedItems.length) return null;

  const quickMinutes = [15, 30, 45, 60, 90];

  return (
    <div>
      <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />

      {/* Focus Card — active item (today only) */}
      {!viewTomorrow && activeItem && (
        <div
          className="rounded-[14px] p-4 md:p-5 mb-4"
          style={{
            backgroundColor: 'hsl(var(--card))',
            border: '1.5px solid #E8A84C',
            borderLeftWidth: '4px',
            borderLeftColor: '#E8A84C',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-wider" style={{ color: '#E8A84C' }}>NOW</span>
              {activeIsOverdue && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground ml-1">
                  Overdue
                </span>
              )}
            </div>
            {activeItem.category && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${getCategoryColor(activeItem.category)}15`,
                  color: getCategoryColor(activeItem.category),
                }}
              >
                {activeItem.category}
              </span>
            )}
          </div>
          <h2 className="text-[16px] md:text-lg font-medium text-foreground mb-0.5 break-words">{activeItem.title}</h2>
          <p className="text-[13px] text-muted-foreground mb-4">
            {formatTime12h(activeItem.start_time)} — {formatTime12h(activeItem.end_time)}
            {!activeItem.is_calendar_event && ` · ${activeItem.est_minutes || 0}m`}
          </p>

          <div className="flex gap-2 w-full">
            <button
              onClick={() => setPushItem(activeItem)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            >
              Push
            </button>
            <button
              onClick={() => openDoneDialog(activeItem)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] text-white"
              style={{ backgroundColor: '#059669' }}
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}

      {/* Timeline — YOUR DAY */}
      <p className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground mb-3 mt-2">YOUR DAY</p>
      <div className="space-y-0">
        {sortedItems.map((item) => {
          const isActive = !viewTomorrow && item.id === activeItemId;
          const isCompleted = item.status === 'completed';
          const isSkipped = item.status === 'skipped';
          const isPending = !isCompleted && !isSkipped;
          const isCalendar = item.is_calendar_event;
          const isExpanded = expandedId === item.id;

          let borderColor = '#eee';
          if (isActive) borderColor = '#E8A84C';
          else if (isCompleted || isSkipped) borderColor = '#ddd';

          const canExpand = !viewTomorrow && !isActive && !isCalendar;

          // Tomorrow: read-only
          if (viewTomorrow) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 py-2 px-2 min-h-[40px]"
                style={{ borderLeft: `3px solid #eee` }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                <span className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px]">{formatTime12h(item.start_time)}</span>
                <span className="flex-1 text-[14px] text-foreground truncate">{item.title}</span>
                <span className="text-[12px] text-muted-foreground flex-shrink-0">
                  {isCalendar ? '' : `${item.est_minutes || 0}m`}
                </span>
              </div>
            );
          }

          return (
            <div key={item.id}>
              <div
                className={`flex items-center gap-2.5 py-2 px-2 min-h-[40px] ${canExpand ? 'cursor-pointer' : ''}`}
                style={{
                  borderLeft: `3px solid ${borderColor}`,
                  opacity: (isCompleted || isSkipped) ? 0.5 : 1,
                  ...(isCalendar ? { backgroundColor: '#EEF4FF', borderRadius: '8px', marginLeft: '-3px', paddingLeft: 'calc(0.5rem + 3px)', borderLeft: `3px solid #93C5FD` } : {}),
                }}
                onClick={() => {
                  if (canExpand) setExpandedId(isExpanded ? null : item.id);
                }}
              >
                {isCalendar ? (
                  <Calendar size={12} className="flex-shrink-0" style={{ color: '#3B82F6' }} />
                ) : isCompleted ? (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#059669' }} />
                ) : isSkipped ? (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#aaa' }} />
                ) : (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                )}

                <span className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px]" style={isCalendar ? { color: '#3B82F6' } : {}}>
                  {formatTime12h(item.start_time)}
                </span>

                <span
                  className={`flex-1 text-[14px] truncate ${isActive ? 'font-bold' : ''} ${isSkipped ? 'line-through' : ''}`}
                  style={{ color: isCalendar ? '#3B82F6' : 'hsl(var(--foreground))' }}
                >
                  {item.title}
                </span>

                {isCompleted && <Check size={13} style={{ color: '#059669' }} className="flex-shrink-0" />}

                {!isCalendar && (
                  <span className="text-[12px] text-muted-foreground flex-shrink-0">
                    {item.est_minutes || 0}m
                  </span>
                )}
              </div>

              {/* Expand panel */}
              {isExpanded && (
                <div
                  className="ml-3 mb-2 p-3 rounded-lg"
                  style={{ backgroundColor: '#FFF8F0', border: '1px solid #E8D5B8' }}
                >
                  <p className="text-[14px] font-medium text-foreground mb-0.5">{item.title}</p>
                  <p className="text-[12px] text-muted-foreground mb-2">
                    {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
                    {!isCalendar && ` · ${item.est_minutes || 0}m`}
                    {item.category && ` · ${item.category}`}
                  </p>
                  {isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPushItem(item)}
                        className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border min-h-[36px]"
                        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                      >
                        Push
                      </button>
                      <button
                        onClick={() => openDoneDialog(item)}
                        className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium text-white min-h-[36px]"
                        style={{ backgroundColor: '#059669' }}
                      >
                        ✓ Done
                      </button>
                    </div>
                  )}
                  {isSkipped && (
                    <button
                      onClick={() => handleActuallyDone(item)}
                      className="px-3 py-2 rounded-lg text-[13px] font-medium border min-h-[36px]"
                      style={{ borderColor: '#059669', color: '#059669' }}
                    >
                      Actually Done
                    </button>
                  )}
                  {isCompleted && (
                    <p className="text-[13px] font-medium" style={{ color: '#059669' }}>✓ Completed</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Done dialog */}
      <Dialog open={!!doneItem} onOpenChange={(o) => !o && setDoneItem(null)}>
        <DialogContent className="max-w-[340px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">How long did this actually take?</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-[13px] text-muted-foreground mb-3">{doneItem?.title}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {quickMinutes.map((m) => (
                <button
                  key={m}
                  onClick={() => setActualMinutes(m)}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium border min-h-[36px]"
                  style={{
                    borderColor: actualMinutes === m ? '#B8906C' : 'hsl(var(--border))',
                    backgroundColor: actualMinutes === m ? '#B8906C' : 'transparent',
                    color: actualMinutes === m ? '#fff' : 'hsl(var(--foreground))',
                  }}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(Number(e.target.value))}
                className="w-24 text-center"
              />
              <span className="text-[13px] text-muted-foreground">minutes</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveDone}
              disabled={updatePlanItem.isPending}
              className="w-full rounded-xl"
              style={{ backgroundColor: '#059669' }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push picker modal */}
      <Dialog open={!!pushItem} onOpenChange={(o) => { if (!o) { setPushItem(null); setPickDateOpen(false); } }}>
        <DialogContent className="max-w-[320px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Push this task</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground mb-1">{pushItem?.title}</p>

          {!pickDateOpen ? (
            <div className="space-y-2 pt-2">
              <button
                onClick={() => pushItem && handlePushTomorrow(pushItem)}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                Tomorrow
              </button>
              <button
                onClick={() => pushItem && handleDefer(pushItem, getNextMonday(1))}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                Next Week
              </button>
              <button
                onClick={() => pushItem && handleDefer(pushItem, getNextMonday(2))}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                2 Weeks
              </button>
              <button
                onClick={() => setPickDateOpen(true)}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left flex items-center gap-2"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                <CalendarDays size={16} className="text-muted-foreground" />
                Pick a Date
              </button>
              <button
                onClick={() => setPushItem(null)}
                className="w-full text-center text-[13px] text-muted-foreground pt-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <CalendarPicker
                mode="single"
                selected={pickedDate}
                onSelect={(d) => {
                  setPickedDate(d);
                  if (d && pushItem) {
                    handleDefer(pushItem, formatDateStr(d));
                  }
                }}
                disabled={(date) => date < new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
              <button
                onClick={() => setPickDateOpen(false)}
                className="w-full text-center text-[13px] text-muted-foreground pt-2"
              >
                Back
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TogglePills({ viewTomorrow, onToggle }: { viewTomorrow: boolean; onToggle: () => void }) {
  return (
    <div className="mb-4">
      <div className="flex gap-1.5">
        <button
          onClick={viewTomorrow ? onToggle : undefined}
          className="text-[13px] font-semibold rounded-full px-4 py-1.5 transition-colors"
          style={{
            backgroundColor: !viewTomorrow ? '#B8906C' : '#E8DDD0',
            color: !viewTomorrow ? '#fff' : '#3D3225',
          }}
        >
          Today
        </button>
        <button
          onClick={!viewTomorrow ? onToggle : undefined}
          className="text-[13px] font-semibold rounded-full px-4 py-1.5 transition-colors"
          style={{
            backgroundColor: viewTomorrow ? '#B8906C' : '#E8DDD0',
            color: viewTomorrow ? '#fff' : '#3D3225',
          }}
        >
          Tomorrow
        </button>
      </div>
    </div>
  );
}
