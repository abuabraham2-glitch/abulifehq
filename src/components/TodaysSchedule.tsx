import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, Calendar, CalendarDays, GripVertical, Trash2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlanItemsByDate, useUpdatePlanItem, useUpdatePlanItemDuration, todayStr, tomorrowStr, type PlanItem } from '@/hooks/useDailyPlan';
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks';
import { formatTime12h, getCategoryColor } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { timeToMin, minToTime, pacificIso } from '@/lib/planScheduling';
import { DurationPicker } from '@/components/DurationPicker';

const SKIP_EVENT_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event';
const UPDATE_EVENT_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-update-event';

function getNextMonday(weeksAhead: number = 1): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = d.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday + (weeksAhead - 1) * 7);
  return formatDateStr(d);
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
  addButton?: React.ReactNode;
}

export function TodaysSchedule({ viewTomorrow, onToggleTab, addButton }: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const updateDuration = useUpdatePlanItemDuration();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  // Pending completions awaiting 5s undo window. Maps planItemId -> { timeoutId, duration }
  const pendingCompletions = useRef<Map<string, { timeoutId: ReturnType<typeof setTimeout>; duration: number }>>(new Map());
  const [pendingCompleteIds, setPendingCompleteIds] = useState<Set<string>>(new Set());

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pushItem, setPushItem] = useState<PlanItem | null>(null);
  const [pickDateOpen, setPickDateOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<PlanItem | null>(null);

  // Out-of-sync rows after drag-reorder (calendar events whose times moved but Cal API not yet synced)
  const [outOfSyncIds, setOutOfSyncIds] = useState<Set<string>>(new Set());

  const nowTime = useMemo(() => {
    const pac = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return `${String(pac.getHours()).padStart(2, '0')}:${String(pac.getMinutes()).padStart(2, '0')}:00`;
  }, []);

  const sortedItems = useMemo(() => {
    return [...(planItems ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [planItems]);

  // Timeline render excludes pushed rows (skipped → Tomorrow, deferred → future date).
  // Pushed rows still exist in DB and surface in the "Pushed today" section.
  const visibleItems = useMemo(
    () => sortedItems.filter((i) => i.status !== 'skipped' && i.status !== 'deferred'),
    [sortedItems],
  );

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

  // Overlap detection: a row overlaps if its start_time < previous row's end_time (sorted-timeline only)
  const overlapIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 1; i < sortedItems.length; i++) {
      const prev = sortedItems[i - 1];
      const cur = sortedItems[i];
      if (cur.start_time < prev.end_time) set.add(cur.id);
    }
    return set;
  }, [sortedItems]);

  const fireSkipWebhook = (item: PlanItem) => {
    fetch(SKIP_EVENT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
    }).catch(() => {});
  };

  const openDoneDialog = (item: PlanItem) => {
    setActualMinutes(item.actual_minutes ?? item.est_minutes ?? 25);
    setDoneItem(item);
  };

  const handleSaveDone = () => {
    if (!doneItem) return;
    const item = doneItem;
    const duration = actualMinutes;
    setDoneItem(null);

    // Visually mark complete immediately
    setPendingCompleteIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    const timeoutId = setTimeout(async () => {
      pendingCompletions.current.delete(item.id);
      setPendingCompleteIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await updatePlanItem.mutateAsync({ id: item.id, status: 'completed', actual_minutes: duration });
      if (item.task_id) await completeTask.mutateAsync(item.task_id);
      fireSkipWebhook(item);
    }, 5000);

    pendingCompletions.current.set(item.id, { timeoutId, duration });

    toast(`Marked done · ${duration}m`, {
      duration: 5000,
      style: { background: '#5C3D1E', color: '#fff', border: 'none' },
      action: {
        label: 'Undo',
        onClick: () => {
          const entry = pendingCompletions.current.get(item.id);
          if (entry) {
            clearTimeout(entry.timeoutId);
            pendingCompletions.current.delete(item.id);
          }
          setPendingCompleteIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        },
      },
    });
  };

  const handlePushTomorrow = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: 'skipped' });
    fireSkipWebhook(item);
    setPushItem(null);
    setExpandedId(null);
  };

  const handleDefer = async (item: PlanItem, deferDate: string) => {
    // UPDATE plan_items.status to 'deferred' (do NOT delete — row still shows in "Pushed today")
    await updatePlanItem.mutateAsync({ id: item.id, status: 'deferred' });
    // PATCH tasks: status='deferred' AND deferred_until in a single update
    if (item.task_id) await updateTask.mutateAsync({ id: item.task_id, status: 'deferred', deferred_until: deferDate });
    fireSkipWebhook(item);
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

  const handleDurationChange = async (item: PlanItem, newMinutes: number) => {
    const newEndMin = timeToMin(item.start_time) + newMinutes;
    const newEndTime = minToTime(newEndMin);
    await updateDuration.mutateAsync({ id: item.id, est_minutes: newMinutes, end_time: newEndTime });
    if (item.calendar_event_id) {
      fetch(UPDATE_EVENT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: item.calendar_event_id,
          start: pacificIso(dateString, item.start_time),
          end: pacificIso(dateString, newEndTime),
          title: item.title,
          category: item.category,
          planItemId: item.id,
        }),
      }).catch(() => {});
    }
    toast(`Duration updated · ${newMinutes}m`, { duration: 3000 });
  };

  // ===== Swipe-to-delete with undo =====
  const requestDelete = (item: PlanItem) => {
    if (item.calendar_event_id) {
      setConfirmDeleteItem(item);
    } else {
      performDelete(item);
    }
  };

  const performDelete = async (item: PlanItem) => {
    // Snapshot for undo
    const snapshot = { ...item };
    await supabase.from('plan_items').delete().eq('id', item.id);
    if (item.calendar_event_id) fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ['daily-plan'] });

    const hadCalendar = !!item.calendar_event_id;
    toast(`Deleted: ${item.title}`, {
      description: hadCalendar ? 'Calendar event deleted' : undefined,
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          // Re-insert (without calendar_event_id since that event is gone)
          const { id, created_at, calendar_event_id, ...rest } = snapshot as any;
          await supabase.from('plan_items').insert({ ...rest, id });
          queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
        },
      },
    });
  };

  // ===== Drag-to-reorder (only on Today, only pending non-calendar non-active items can move) =====
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || viewTomorrow) return;

    const activeIdx = sortedItems.findIndex((i) => i.id === active.id);
    const overIdx = sortedItems.findIndex((i) => i.id === over.id);
    if (activeIdx < 0 || overIdx < 0) return;

    const draggedItem = sortedItems[activeIdx];
    const overItem = sortedItems[overIdx];
    // Anchors cannot move and cannot be displaced past
    if (draggedItem.is_external || draggedItem.id === activeItemId) return;
    if (overItem.is_external) {
      toast('Calendar events are anchors — drop somewhere else');
      return;
    }
    // Cannot drop before now
    if (overItem.start_time < nowTime && overIdx < activeIdx) {
      toast("Can't move past tasks earlier than now");
      return;
    }

    const reordered = arrayMove(sortedItems, activeIdx, overIdx);

    // Recalculate sequential start/end times preserving each item's duration.
    // Walk through `reordered`. External calendar events stay anchored to their original times.
    // For non-external items, slot them into gaps between anchors starting at max(prev_end, now).
    const anchors = sortedItems.filter((i) => i.is_external)
      .map((a) => ({ id: a.id, start: timeToMin(a.start_time), end: timeToMin(a.end_time) }))
      .sort((a, b) => a.start - b.start);

    const updates: { id: string; start_time: string; end_time: string; sort_order: number }[] = [];
    let cursor = Math.max(timeToMin(nowTime), 6 * 60);
    let anchorIdx = 0;

    for (let i = 0; i < reordered.length; i++) {
      const item = reordered[i];
      const dur = (item.est_minutes ?? Math.max(15, timeToMin(item.end_time) - timeToMin(item.start_time))) || 30;

      if (item.is_external) {
        // Keep its original times, advance cursor past it
        cursor = Math.max(cursor, timeToMin(item.end_time));
        anchorIdx++;
        // sort_order still updated to reflect placement
        updates.push({
          id: item.id,
          start_time: item.start_time,
          end_time: item.end_time,
          sort_order: i,
        });
        continue;
      }

      // Skip past any anchors that end before our cursor
      // Also: if the next anchor starts before cursor+dur, jump cursor to anchor.end
      while (anchorIdx < anchors.length && anchors[anchorIdx].end <= cursor) anchorIdx++;
      if (anchorIdx < anchors.length && anchors[anchorIdx].start < cursor + dur) {
        cursor = anchors[anchorIdx].end;
        anchorIdx++;
      }
      const start = cursor;
      const end = start + dur;
      updates.push({
        id: item.id,
        start_time: minToTime(start),
        end_time: minToTime(end),
        sort_order: i,
      });
      cursor = end;
    }

    // Optimistically update cache to feel instant
    queryClient.setQueryData(['daily-plan', 'items-by-date', dateString], () => {
      return updates.map((u) => {
        const orig = sortedItems.find((s) => s.id === u.id)!;
        return { ...orig, ...u };
      });
    });

    // Track which items had a calendar_event_id and changed time → out of sync
    const newOutOfSync = new Set(outOfSyncIds);
    for (const u of updates) {
      const orig = sortedItems.find((s) => s.id === u.id)!;
      if (orig.calendar_event_id && (orig.start_time !== u.start_time || orig.end_time !== u.end_time)) {
        newOutOfSync.add(u.id);
      }
    }
    setOutOfSyncIds(newOutOfSync);

    // Persist
    await Promise.all(
      updates.map((u) =>
        supabase
          .from('plan_items')
          .update({ start_time: u.start_time, end_time: u.end_time, sort_order: u.sort_order })
          .eq('id', u.id),
      ),
    );
    queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
  };

  if (isLoading) return null;

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

  // Tomorrow read-only (unchanged)
  if (viewTomorrow) {
    return (
      <div>
        <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        <p className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground mb-3 mt-2">YOUR DAY</p>
        <div className="space-y-0">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 py-2 px-2 min-h-[40px]"
              style={{ borderLeft: `3px solid #eee` }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
              <span className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px]">{formatTime12h(item.start_time)}</span>
              <span className="flex-1 text-[14px] text-foreground truncate">{item.title}</span>
              <span className="text-[12px] text-muted-foreground flex-shrink-0">
                {item.is_calendar_event ? '' : `${item.est_minutes || 0}m`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Today: focus card + draggable/swipeable timeline
  return (
    <div>
      <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />

      {activeItem && (
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

      {addButton}

      <p className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground mb-3 mt-2">YOUR DAY</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0">
            {visibleItems.map((item) => {
              const pendingComplete = pendingCompleteIds.has(item.id);
              const displayItem = pendingComplete ? { ...item, status: 'completed' } : item;
              return (
                <ScheduleRow
                  key={item.id}
                  item={displayItem as PlanItem}
                  isActive={item.id === activeItemId && !pendingComplete}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => {
                    if (item.is_external || item.id === activeItemId) return;
                    setExpandedId((cur) => (cur === item.id ? null : item.id));
                  }}
                  onDelete={() => requestDelete(item)}
                  onPush={() => setPushItem(item)}
                  onDone={() => openDoneDialog(item)}
                  onActuallyDone={() => handleActuallyDone(item)}
                  outOfSync={outOfSyncIds.has(item.id)}
                  overlaps={overlapIds.has(item.id)}
                  onChangeDuration={(m) => handleDurationChange(item, m)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

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
              <Input type="number" min={0} value={actualMinutes} onChange={(e) => setActualMinutes(Number(e.target.value))} className="w-24 text-center" />
              <span className="text-[13px] text-muted-foreground">minutes</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDone} disabled={updatePlanItem.isPending} className="w-full rounded-xl" style={{ backgroundColor: '#059669' }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push picker */}
      <Dialog open={!!pushItem} onOpenChange={(o) => { if (!o) { setPushItem(null); setPickDateOpen(false); } }}>
        <DialogContent className="max-w-[320px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Push this task</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground mb-1">{pushItem?.title}</p>
          {!pickDateOpen ? (
            <div className="space-y-2 pt-2">
              <button onClick={() => pushItem && handlePushTomorrow(pushItem)} className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left" style={{ borderColor: 'hsl(var(--border))' }}>
                Tomorrow
              </button>
              <button onClick={() => pushItem && handleDefer(pushItem, getNextMonday(1))} className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left" style={{ borderColor: 'hsl(var(--border))' }}>
                Next Week
              </button>
              <button onClick={() => pushItem && handleDefer(pushItem, getNextMonday(2))} className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left" style={{ borderColor: 'hsl(var(--border))' }}>
                2 Weeks
              </button>
              <button onClick={() => setPickDateOpen(true)} className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left flex items-center gap-2" style={{ borderColor: 'hsl(var(--border))' }}>
                <CalendarDays size={16} className="text-muted-foreground" />
                Pick a Date
              </button>
              <button onClick={() => setPushItem(null)} className="w-full text-center text-[13px] text-muted-foreground pt-1">
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
                  if (d && pushItem) handleDefer(pushItem, formatDateStr(d));
                }}
                disabled={(date) => date < new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
              <button onClick={() => setPickDateOpen(false)} className="w-full text-center text-[13px] text-muted-foreground pt-2">
                Back
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete (calendar-synced rows) */}
      <AlertDialog open={!!confirmDeleteItem} onOpenChange={(o) => !o && setConfirmDeleteItem(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[18px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete from calendar too?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove the event from your Google Calendar. You can't undo the calendar deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              style={{ borderColor: '#B8906C', color: '#5C3D1E' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-white hover:opacity-90"
              style={{ backgroundColor: '#C44' }}
              onClick={() => {
                const it = confirmDeleteItem;
                setConfirmDeleteItem(null);
                if (it) performDelete(it);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= ScheduleRow with swipe-to-delete and drag handle =============

interface RowProps {
  item: PlanItem;
  isActive: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onPush: () => void;
  onDone: () => void;
  onActuallyDone: () => void;
  outOfSync: boolean;
  overlaps: boolean;
  onChangeDuration: (m: number) => void;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

function ScheduleRow({ item, isActive, expanded, onToggleExpand, onDelete, onPush, onDone, onActuallyDone, outOfSync, overlaps, onChangeDuration }: RowProps) {
  const isCompleted = item.status === 'completed';
  const isSkipped = item.status === 'skipped';
  const isPending = !isCompleted && !isSkipped;
  const isExternal = item.is_external === true;

  const canSwipe = !isExternal && !isActive;
  const canDrag = !isExternal && !isActive && isPending;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canDrag,
  });

  // Swipe state
  const [translateX, setTranslateX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiping = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canSwipe) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!canSwipe || startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!swiping.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        swiping.current = true;
      } else if (Math.abs(dy) > 10) {
        return;
      } else {
        return;
      }
    }
    const base = revealed ? -SWIPE_REVEAL : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -SWIPE_REVEAL * 1.5) next = -SWIPE_REVEAL * 1.5;
    setTranslateX(next);
  };
  const onTouchEnd = () => {
    if (!canSwipe) return;
    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-SWIPE_REVEAL);
      setRevealed(true);
    } else {
      setTranslateX(0);
      setRevealed(false);
    }
    startX.current = null;
    startY.current = null;
    swiping.current = false;
  };

  const handleRowClick = () => {
    if (revealed) {
      setTranslateX(0);
      setRevealed(false);
      return;
    }
    onToggleExpand();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  // Reset swipe when dragging starts
  useEffect(() => {
    if (isDragging && revealed) {
      setTranslateX(0);
      setRevealed(false);
    }
  }, [isDragging, revealed]);

  let borderColor = '#eee';
  if (isActive) borderColor = '#E8A84C';
  else if (isCompleted || isSkipped) borderColor = '#ddd';

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto' as any,
    boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.12)' : undefined,
    backgroundColor: isDragging ? '#FFF8F0' : undefined,
  };

  return (
    <div ref={setNodeRef} style={dragStyle} className="relative overflow-hidden rounded-md">
      {/* Red delete pad — under the row */}
      {canSwipe && (
        <button
          onClick={handleDeleteClick}
          className="absolute top-0 right-0 bottom-0 flex items-center justify-center text-white"
          style={{ width: SWIPE_REVEAL, backgroundColor: '#C44' }}
          aria-label="Delete task"
          tabIndex={revealed ? 0 : -1}
        >
          <Trash2 size={16} />
        </button>
      )}

      <div
        className={`flex items-center gap-1 py-2 px-2 min-h-[40px] bg-card relative`}
        style={{
          borderLeft: `3px solid ${borderColor}`,
          opacity: (isCompleted || isSkipped) ? 0.5 : 1,
          transform: `translateX(${translateX}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.18s ease-out',
          ...(isExternal ? { backgroundColor: '#EEF4FF', borderRadius: '8px', borderLeft: `3px solid #93C5FD` } : {}),
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleRowClick}
      >
        {/* Drag handle */}
        {canDrag ? (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="touch-none -ml-1 p-1 rounded flex-shrink-0 cursor-grab active:cursor-grabbing"
            style={{ color: 'rgba(139, 115, 85, 0.6)' }}
            aria-label="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
        ) : (
          <div className="w-[22px] flex-shrink-0" />
        )}

        {isExternal ? (
          <Calendar size={12} className="flex-shrink-0" style={{ color: '#3B82F6' }} />
        ) : isCompleted ? (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#059669' }} />
        ) : isSkipped ? (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#aaa' }} />
        ) : (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
        )}

        <span className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px] ml-1" style={isExternal ? { color: '#3B82F6' } : {}}>
          {formatTime12h(item.start_time)}
        </span>

        <span
          className={`flex-1 text-[14px] truncate ${isActive ? 'font-bold' : ''} ${isSkipped ? 'line-through' : ''}`}
          style={{ color: isExternal ? '#3B82F6' : 'hsl(var(--foreground))' }}
        >
          {item.title}
        </span>

        {outOfSync && (
          <span title="Calendar event out of sync — will re-sync at next 9pm planner run">
            <AlertCircle size={13} className="flex-shrink-0" style={{ color: '#E8A84C' }} />
          </span>
        )}

        {overlaps && (
          <span title="Overlaps with the task above">
            <AlertCircle size={13} className="flex-shrink-0" style={{ color: '#C44' }} />
          </span>
        )}

        {isCompleted && <Check size={13} style={{ color: '#059669' }} className="flex-shrink-0" />}

        {!isExternal && (
          <DurationPicker
            value={item.est_minutes || 0}
            disabled={isExternal || isCompleted || isSkipped || item.status === 'deferred'}
            onChange={onChangeDuration}
          />
        )}
      </div>

      {expanded && (
        <div className="ml-3 mb-2 p-3 rounded-lg" style={{ backgroundColor: '#FFF8F0', border: '1px solid #E8D5B8' }}>
          <p className="text-[14px] font-medium text-foreground mb-0.5">{item.title}</p>
          <p className="text-[12px] text-muted-foreground mb-2">
            {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
            {!isExternal && ` · ${item.est_minutes || 0}m`}
            {item.category && ` · ${item.category}`}
          </p>
          {isPending && (
            <div className="flex gap-2">
              <button onClick={onPush} className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border min-h-[36px]" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                Push
              </button>
              <button onClick={onDone} className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium text-white min-h-[36px]" style={{ backgroundColor: '#059669' }}>
                ✓ Done
              </button>
            </div>
          )}
          {isSkipped && (
            <button onClick={onActuallyDone} className="px-3 py-2 rounded-lg text-[13px] font-medium border min-h-[36px]" style={{ borderColor: '#059669', color: '#059669' }}>
              Actually Done
            </button>
          )}
          {isCompleted && <p className="text-[13px] font-medium" style={{ color: '#059669' }}>✓ Completed</p>}
        </div>
      )}
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
