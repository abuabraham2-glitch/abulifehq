import { useState, useMemo, useRef } from "react";
import {
  Check,
  Clock,
  GripVertical,
  Lock,
  Pin,
  ChevronDown,
  ChevronUp,
  CornerRightUp,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePlanItemsByDate, useUpdatePlanItem, todayStr, tomorrowStr, type PlanItem } from "@/hooks/useDailyPlan";
import { useCompleteTask, useUpdateTask } from "@/hooks/useTasks";
import { formatTime12h } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getStaticLockedWindows } from "@/components/StartTimePicker";

const SKIP_EVENT_WEBHOOK = "https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event";

const C = {
  page: "#F5F0E8",
  focusBg: "#5C3D1E",
  focusName: "#F5F0E8",
  focusDur: "#EBC99C",
  focusDone: "#9A7B5C",
  focusGrip: "#8A6A4A",
  gold: "#B8906C",
  liveWallBg: "#185FA5",
  liveWallTitle: "#FFFFFF",
  liveWallSub: "#B5D4F4",
  upWallBg: "#E6F1FB",
  upWallBorder: "#378ADD",
  upWallTitle: "#0C447C",
  upWallTime: "#185FA5",
  fits: "#0F6E56",
  wontFit: "#854F0B",
  didntBg: "#FAEEDA",
  didntHead: "#854F0B",
  didntItem: "#633806",
  rowBg: "#FFFFFF",
  rowBorder: "#E4DACB",
  rowName: "#3A2E20",
  rowDur: "#9A6B3F",
  neutral: "#6B6256",
  rowGrip: "#C9B79F",
};

type Wall = { startMin: number; endMin: number; label: string };
type EngineTask = { id: string; name: string; durationMin: number; priority: number; pinnedStartMin?: number };
type Placed = { id: string; name: string; startMin: number; endMin: number; pinned: boolean };

function placeDay(opts: { nowMin: number; hardStopMin: number; walls: Wall[]; tasks: EngineTask[] }) {
  const { nowMin, hardStopMin, walls, tasks } = opts;
  const pinned = tasks.filter((t) => typeof t.pinnedStartMin === "number");
  const flexible = tasks.filter((t) => typeof t.pinnedStartMin !== "number");

  const pinnedPlaced: Placed[] = pinned.map((t) => ({
    id: t.id,
    name: t.name,
    startMin: t.pinnedStartMin as number,
    endMin: (t.pinnedStartMin as number) + t.durationMin,
    pinned: true,
  }));

  const blocked = [
    ...walls.map((w) => ({ startMin: w.startMin, endMin: w.endMin })),
    ...pinnedPlaced.map((p) => ({ startMin: p.startMin, endMin: p.endMin })),
  ].sort((a, b) => a.startMin - b.startMin);

  const freeWindows: { startMin: number; endMin: number }[] = [];
  let cursor = Math.max(nowMin, 0);
  for (const b of blocked) {
    if (b.endMin <= cursor) continue;
    if (b.startMin > cursor) {
      const winEnd = Math.min(b.startMin, hardStopMin);
      if (winEnd > cursor) freeWindows.push({ startMin: cursor, endMin: winEnd });
    }
    cursor = Math.max(cursor, b.endMin);
    if (cursor >= hardStopMin) break;
  }
  if (cursor < hardStopMin) freeWindows.push({ startMin: cursor, endMin: hardStopMin });

  const ordered = [...flexible].sort((a, b) => a.priority - b.priority);
  const placed: Placed[] = [];
  const didNotFit: EngineTask[] = [];
  const windows = freeWindows.map((w) => ({ startMin: w.startMin, endMin: w.endMin }));

  for (const task of ordered) {
    let slotted = false;
    for (const w of windows) {
      if (w.endMin - w.startMin >= task.durationMin) {
        placed.push({
          id: task.id,
          name: task.name,
          startMin: w.startMin,
          endMin: w.startMin + task.durationMin,
          pinned: false,
        });
        w.startMin += task.durationMin;
        slotted = true;
        break;
      }
    }
    if (!slotted) didNotFit.push(task);
  }

  const allPlaced = [...placed, ...pinnedPlaced].sort((a, b) => a.startMin - b.startMin);
  return { placed: allPlaced, didNotFit, freeWindows };
}

function timeToMin(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function pacificNowMin(): number {
  const pac = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pac.getHours() * 60 + pac.getMinutes();
}
function minTo12h(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtDur(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}m` : `${h}h`;
  }
  return `${m}m`;
}
function hardStopMin(): number {
  const pac = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = pac.getDay();
  if (day === 6) return 16 * 60;
  return 18 * 60;
}
function stripTitleSuffix(title: string): string {
  if (!title) return "";
  let t = title;
  t = t.replace(/\s+[—–-]\s+[^—–-]+$/, "");
  t = t.replace(/\s*\([^)]*\)\s*$/, "");
  return t.trim();
}
function getNextMonday(weeksAhead: number = 1): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = d.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday + (weeksAhead - 1) * 7);
  return formatDateStr(d);
}
function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface Props {
  viewTomorrow: boolean;
  onToggleTab: () => void;
  addButton?: React.ReactNode;
  planId?: string | null;
  pausedToday?: { start_date: string; end_date: string } | null;
}

export function TodaysSchedule({ viewTomorrow, onToggleTab, addButton, pausedToday = null }: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const pendingCompletions = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingCompleteIds, setPendingCompleteIds] = useState<Set<string>>(new Set());

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [pushItem, setPushItem] = useState<PlanItem | null>(null);
  const [pickDateOpen, setPickDateOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<PlanItem | null>(null);
  const [doneStripOpen, setDoneStripOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const nowMin = useMemo(() => pacificNowMin(), []);

  const allRows = useMemo(() => [...(planItems ?? [])], [planItems]);

  const wallRows = useMemo(
    () => allRows.filter((r) => r.is_calendar_event === true || r.is_external === true),
    [allRows],
  );

  const activeTaskRows = useMemo(() => {
    const tasks = allRows.filter(
      (r) =>
        !(r.is_calendar_event === true || r.is_external === true) &&
        r.status !== "completed" &&
        r.status !== "skipped" &&
        r.status !== "deferred",
    );
    if (!localOrder) return tasks;
    const orderMap = new Map(localOrder.map((id, idx) => [id, idx]));
    return [...tasks].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return ai - bi;
    });
  }, [allRows, localOrder]);

  const completedRows = useMemo(
    () => allRows.filter((r) => !(r.is_calendar_event === true || r.is_external === true) && r.status === "completed"),
    [allRows],
  );

  const engineWalls = useMemo<Wall[]>(() => {
    const fromCal: Wall[] = wallRows.map((w) => ({
      startMin: timeToMin(w.start_time),
      endMin: timeToMin(w.end_time),
      label: w.title,
    }));
    const fromRules: Wall[] = getStaticLockedWindows().map((w: any) => ({
      startMin: w.startMin,
      endMin: w.endMin,
      label: "Reserved",
    }));
    return [...fromCal, ...fromRules].filter((w) => w.endMin > nowMin).sort((a, b) => a.startMin - b.startMin);
  }, [wallRows, nowMin]);

  const engineTasks = useMemo<EngineTask[]>(() => {
    return activeTaskRows.map((r, idx) => ({
      id: r.id,
      name: r.title,
      durationMin: r.est_minutes || 0,
      priority: idx + 1,
      pinnedStartMin: r.pinned_time ? timeToMin(r.pinned_time) : undefined,
    }));
  }, [activeTaskRows]);

  const result = useMemo(
    () => placeDay({ nowMin, hardStopMin: hardStopMin(), walls: engineWalls, tasks: engineTasks }),
    [nowMin, engineWalls, engineTasks],
  );

  const rowById = useMemo(() => {
    const m = new Map<string, PlanItem>();
    for (const r of activeTaskRows) m.set(r.id, r);
    return m;
  }, [activeTaskRows]);

  const placedTasks = useMemo(
    () =>
      result.placed
        .map((p) => ({ placed: p, row: rowById.get(p.id) }))
        .filter((x): x is { placed: Placed; row: PlanItem } => !!x.row),
    [result, rowById],
  );
  const didNotFitTasks = useMemo(
    () => result.didNotFit.map((t) => rowById.get(t.id)).filter((r): r is PlanItem => !!r),
    [result, rowById],
  );

  const liveWall = useMemo(() => {
    return wallRows.find((w) => {
      const s = timeToMin(w.start_time);
      const e = timeToMin(w.end_time);
      return nowMin >= s && nowMin < e;
    });
  }, [wallRows, nowMin]);

  const upcomingWalls = useMemo(() => {
    return wallRows
      .filter((w) => timeToMin(w.start_time) > nowMin)
      .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
      .map((w) => {
        const wallStart = timeToMin(w.start_time);
        const needed = placedTasks
          .filter((pt) => pt.placed.endMin <= wallStart)
          .reduce((s, pt) => s + (pt.placed.endMin - pt.placed.startMin), 0);
        const runway = wallStart - nowMin;
        return { row: w, wallStart, wallEnd: timeToMin(w.end_time), needed, runway, fits: runway >= needed };
      });
  }, [wallRows, nowMin, placedTasks]);

  const focusTask = useMemo(() => {
    if (liveWall) return null;
    return placedTasks.length ? placedTasks[0].row : null;
  }, [liveWall, placedTasks]);

  const streamTasks = useMemo(() => {
    const arr = placedTasks.map((p) => p.row);
    if (focusTask) return arr.filter((r) => r.id !== focusTask.id);
    return arr;
  }, [placedTasks, focusTask]);

  const fireSkipWebhook = (item: PlanItem) => {
    fetch(SKIP_EVENT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    setPendingCompleteIds((prev) => new Set(prev).add(item.id));

    const timeoutId = setTimeout(async () => {
      pendingCompletions.current.delete(item.id);
      setPendingCompleteIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await updatePlanItem.mutateAsync({ id: item.id, status: "completed", actual_minutes: duration });
      if (item.task_id) {
        await completeTask.mutateAsync(item.task_id);
      } else {
        const titleKey = stripTitleSuffix(item.title);
        const { data: matches } = await supabase.from("tasks").select("id,name").ilike("name", titleKey);
        if (matches && matches.length > 0) {
          await supabase
            .from("tasks")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .in(
              "id",
              matches.map((m: any) => m.id),
            );
        }
      }
      fireSkipWebhook(item);
    }, 5000);

    pendingCompletions.current.set(item.id, timeoutId);

    toast(`Marked done · ${duration}m`, {
      duration: 5000,
      style: { background: C.focusBg, color: "#fff", border: "none" },
      action: {
        label: "Undo",
        onClick: () => {
          const t = pendingCompletions.current.get(item.id);
          if (t) {
            clearTimeout(t);
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

  const handleUndoCompleted = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: "pending" });
    if (item.task_id) {
      await supabase
        .from("tasks")
        .update({ status: "active", completed_at: null } as any)
        .eq("id", item.task_id);
    }
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
  };

  const handlePushTomorrow = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: "skipped" });
    if (item.task_id) {
      await updateTask.mutateAsync({ id: item.task_id, status: "deferred", deferred_until: tomorrowStr() });
    }
    fireSkipWebhook(item);
    setPushItem(null);
  };

  const handleDefer = async (item: PlanItem, deferDate: string) => {
    const planItemPatch = supabase
      .from("plan_items")
      .update({ status: "skipped" } as any)
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) console.warn("[push] plan_items skipped patch failed", error);
      });
    const tasksPatch = item.task_id
      ? updateTask.mutateAsync({ id: item.task_id, status: "deferred", deferred_until: deferDate })
      : Promise.resolve();
    await Promise.all([planItemPatch, tasksPatch]);
    fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    setPushItem(null);
    setPickDateOpen(false);
  };

  const requestDelete = (item: PlanItem) => {
    if (item.calendar_event_id) setConfirmDeleteItem(item);
    else performDelete(item);
  };

  const performDelete = async (item: PlanItem) => {
    await supabase.from("plan_items").update({ status: "skipped" }).eq("id", item.id);
    let archivedTaskIds: string[] = [];
    if (item.task_id) {
      await supabase.from("tasks").update({ status: "archived" }).eq("id", item.task_id);
      archivedTaskIds = [item.task_id];
    } else {
      const titleKey = stripTitleSuffix(item.title);
      const { data: matches } = await supabase.from("tasks").select("id").ilike("name", titleKey);
      if (matches && matches.length > 0) {
        archivedTaskIds = matches.map((m: any) => m.id);
        await supabase.from("tasks").update({ status: "archived" }).in("id", archivedTaskIds);
      }
    }
    if (item.calendar_event_id) fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });

    toast(`Deleted: ${item.title}`, {
      description: item.calendar_event_id ? "Calendar event deleted" : undefined,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => {
          await supabase.from("plan_items").update({ status: "pending" }).eq("id", item.id);
          if (archivedTaskIds.length > 0) {
            await supabase.from("tasks").update({ status: "active" }).in("id", archivedTaskIds);
          }
          queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
      },
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, idx) =>
      supabase
        .from("plan_items")
        .update({ sort_order: idx + 1 } as any)
        .eq("id", id),
    );
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.warn("[drag] sort_order write failed", firstError);
      toast.error("Couldn't save the new order.");
      queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    setLocalOrder(null);
  };

  const draggableIds = useMemo(() => {
    const ids: string[] = [];
    if (focusTask) ids.push(focusTask.id);
    for (const r of streamTasks) ids.push(r.id);
    for (const r of didNotFitTasks) ids.push(r.id);
    return ids;
  }, [focusTask, streamTasks, didNotFitTasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || viewTomorrow) return;
    const activeIdx = draggableIds.findIndex((id) => id === active.id);
    const overIdx = draggableIds.findIndex((id) => id === over.id);
    if (activeIdx < 0 || overIdx < 0) return;
    const reordered = arrayMove(draggableIds, activeIdx, overIdx);
    setLocalOrder(reordered);
    void persistOrder(reordered);
  };

  if (isLoading) return null;

  if (!viewTomorrow && pausedToday) {
    const isSingleDay = pausedToday.start_date === pausedToday.end_date;
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    return (
      <div>
        <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        <div
          style={{
            background: C.rowBg,
            border: `1.5px solid ${C.gold}`,
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 500, color: C.focusBg }}>
            {isSingleDay ? "Paused" : `Paused ${fmt(pausedToday.start_date)} to ${fmt(pausedToday.end_date)}`}
          </p>
        </div>
        {addButton}
      </div>
    );
  }

  if (viewTomorrow) {
    // Tomorrow = calm preview. Walls (calendar events) render as blue blocks with
    // their real clock times; tasks render as no-clock NEXT/THEN rows. Both are
    // interleaved in clock order. No focus card and no runway verdicts — those are
    // "right now" concepts and tomorrow has no "now" yet.
    const tomorrowTaskRows = allRows.filter(
      (r) => !(r.is_calendar_event || r.is_external) && r.status !== "completed" && r.status !== "skipped",
    );
    const tomorrowWallRows = allRows.filter((r) => r.is_calendar_event || r.is_external);

    type TomNode =
      | { kind: "task"; row: PlanItem; startMin: number }
      | { kind: "wall"; row: PlanItem; startMin: number };
    const tomNodes: TomNode[] = [];
    tomorrowTaskRows.forEach((row) => tomNodes.push({ kind: "task", row, startMin: timeToMin(row.start_time) }));
    tomorrowWallRows.forEach((row) => tomNodes.push({ kind: "wall", row, startMin: timeToMin(row.start_time) }));
    tomNodes.sort((a, b) => a.startMin - b.startMin);

    let taskSeq = 0;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        {!allRows.length ? (
          <div
            style={{
              background: C.rowBg,
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 14,
              padding: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 14, color: C.neutral }}>Tomorrow's plan hasn't been generated yet.</p>
            <p style={{ fontSize: 13, color: C.neutral, marginTop: 4 }}>It will arrive at 9pm tonight.</p>
          </div>
        ) : (
          <>
            <p
              style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.gold, margin: "8px 0 10px 2px" }}
            >
              YOUR DAY
            </p>
            {tomNodes.map((node) => {
              if (node.kind === "wall") {
                const w = node.row;
                return (
                  <div
                    key={w.id}
                    style={{
                      background: C.upWallBg,
                      borderRadius: "0 8px 8px 0",
                      borderLeft: `3px solid ${C.upWallBorder}`,
                      padding: "12px 14px",
                      margin: "10px 0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 15,
                          fontWeight: 500,
                          color: C.upWallTitle,
                        }}
                      >
                        <Lock size={13} /> {w.title}
                      </span>
                      <span style={{ fontSize: 13, color: C.upWallTime }}>
                        {formatTime12h(w.start_time)}–{formatTime12h(w.end_time)}
                      </span>
                    </div>
                  </div>
                );
              }
              const item = node.row;
              const label = taskSeq === 0 ? "NEXT" : "THEN";
              taskSeq += 1;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: C.rowBg,
                    border: `0.5px solid ${C.rowBorder}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    margin: "6px 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: C.gold,
                      minWidth: 38,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, color: C.rowName }}>{item.title}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.rowDur }}>
                    {fmtDur(item.est_minutes || 0)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  if (!allRows.length) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        <div
          style={{
            background: C.rowBg,
            border: `0.5px solid ${C.rowBorder}`,
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: C.neutral }}>No tasks scheduled for today.</p>
        </div>
        {addButton}
      </div>
    );
  }

  const quickMinutes = [15, 30, 45, 60, 90];

  type StreamNode =
    | { kind: "task"; row: PlanItem; order: number; startMin: number }
    | { kind: "wall"; wall: (typeof upcomingWalls)[number]; startMin: number };

  const streamNodes: StreamNode[] = [];
  streamTasks.forEach((row, idx) => {
    const placed = placedTasks.find((p) => p.row.id === row.id);
    streamNodes.push({ kind: "task", row, order: idx, startMin: placed ? placed.placed.startMin : 9999 });
  });
  upcomingWalls.forEach((w) => streamNodes.push({ kind: "wall", wall: w, startMin: w.wallStart }));
  streamNodes.sort((a, b) => a.startMin - b.startMin);

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <TogglePills viewTomorrow={viewTomorrow} onToggle={onToggleTab} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={draggableIds} strategy={verticalListSortingStrategy}>
          {liveWall ? (
            <div style={{ background: C.liveWallBg, borderRadius: 20, padding: "30px 28px", marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  color: C.liveWallSub,
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                <Lock size={13} /> Happening now
              </div>
              <div style={{ fontSize: 32, fontWeight: 500, color: C.liveWallTitle, marginBottom: 18, lineHeight: 1.2 }}>
                {liveWall.title}
              </div>
              <div style={{ fontSize: 15, color: C.liveWallSub }}>until {formatTime12h(liveWall.end_time)}</div>
            </div>
          ) : focusTask ? (
            <FocusTaskCard
              item={focusTask}
              onDone={() => openDoneDialog(focusTask)}
              onPush={() => setPushItem(focusTask)}
            />
          ) : null}

          {addButton}

          <p
            style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.gold, margin: "14px 0 10px 2px" }}
          >
            YOUR DAY
          </p>

          {streamNodes.map((node) => {
            if (node.kind === "wall") {
              const w = node.wall;
              return (
                <div
                  key={`wall-${w.row.id}`}
                  style={{
                    background: C.upWallBg,
                    borderRadius: "0 8px 8px 0",
                    borderLeft: `3px solid ${C.upWallBorder}`,
                    padding: "12px 14px",
                    margin: "10px 0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 15,
                        fontWeight: 500,
                        color: C.upWallTitle,
                      }}
                    >
                      <Lock size={13} /> {w.row.title}
                    </span>
                    <span style={{ fontSize: 13, color: C.upWallTime }}>
                      {minTo12h(w.wallStart)}–{minTo12h(w.wallEnd)}
                    </span>
                  </div>
                  <RunwayLine needed={w.needed} runway={w.runway} fits={w.fits} />
                </div>
              );
            }
            const row = node.row;
            const isFirst = node.order === 0;
            return (
              <TaskRow
                key={row.id}
                item={row}
                label={isFirst ? "NEXT" : "THEN"}
                onDone={() => openDoneDialog(row)}
                onPush={() => setPushItem(row)}
                onDelete={() => requestDelete(row)}
              />
            );
          })}

          {streamNodes.length === 0 && (
            <p style={{ fontSize: 13, color: C.neutral, padding: "8px 2px" }}>Nothing else queued.</p>
          )}

          {didNotFitTasks.length > 0 && (
            <div style={{ background: C.didntBg, borderRadius: 12, padding: "12px 14px", marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: C.didntHead,
                  marginBottom: 8,
                }}
              >
                <CornerRightUp size={15} /> Didn't fit today — rolls to tomorrow
              </div>
              {didNotFitTasks.map((row) => (
                <DidntFitRow
                  key={row.id}
                  item={row}
                  onDone={() => openDoneDialog(row)}
                  onPush={() => setPushItem(row)}
                  onDelete={() => requestDelete(row)}
                />
              ))}
              <div style={{ fontSize: 12, color: C.didntHead, marginTop: 8 }}>
                Nothing is lost. These come back in tomorrow's pool.
              </div>
            </div>
          )}
        </SortableContext>
      </DndContext>

      {completedRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setDoneStripOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: C.neutral,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> {completedRows.length} done earlier
            </span>
            {doneStripOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {doneStripOpen && (
            <div style={{ marginTop: 8 }}>
              {completedRows.map((row) => (
                <div
                  key={row.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px" }}
                >
                  <span style={{ fontSize: 13, color: C.neutral, textDecoration: "line-through" }}>{row.title}</span>
                  <button
                    onClick={() => handleUndoCompleted(row)}
                    style={{
                      fontSize: 13,
                      color: C.neutral,
                      background: "transparent",
                      border: `0.5px solid ${C.rowBorder}`,
                      borderRadius: 6,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    borderColor: actualMinutes === m ? C.gold : "hsl(var(--border))",
                    backgroundColor: actualMinutes === m ? C.gold : "transparent",
                    color: actualMinutes === m ? "#fff" : "hsl(var(--foreground))",
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
              style={{ backgroundColor: C.focusBg }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pushItem}
        onOpenChange={(o) => {
          if (!o) {
            setPushItem(null);
            setPickDateOpen(false);
          }
        }}
      >
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
                style={{ borderColor: "hsl(var(--border))" }}
              >
                Tomorrow
              </button>
              <button
                onClick={() => pushItem && handleDefer(pushItem, getNextMonday(1))}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                Next Week
              </button>
              <button
                onClick={() => pushItem && handleDefer(pushItem, getNextMonday(2))}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                2 Weeks
              </button>
              <button
                onClick={() => setPickDateOpen(true)}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] border text-left"
                style={{ borderColor: "hsl(var(--border))" }}
              >
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
                  if (d && pushItem) handleDefer(pushItem, formatDateStr(d));
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

      <AlertDialog open={!!confirmDeleteItem} onOpenChange={(o) => !o && setConfirmDeleteItem(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[18px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete from calendar too?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove the event from your Google Calendar. You can't undo the calendar deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" style={{ borderColor: C.gold, color: C.focusBg }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-white hover:opacity-90"
              style={{ backgroundColor: "#C44" }}
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

function FocusTaskCard({ item, onDone, onPush }: { item: PlanItem; onDone: () => void; onPush: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : ("auto" as any),
    boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.18)" : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: C.focusBg, borderRadius: 20, padding: "30px 28px", marginBottom: 16 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reprioritize"
          className="touch-none cursor-grab active:cursor-grabbing"
          style={{ background: "transparent", border: "none", color: C.focusGrip, marginTop: 4, flexShrink: 0 }}
        >
          <GripVertical size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 33,
              fontWeight: 500,
              lineHeight: 1.25,
              color: C.focusName,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>{item.title}</span>
            {item.pinned_time && <Pin size={22} style={{ color: C.gold, flexShrink: 0 }} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 16,
                fontWeight: 500,
                color: C.focusDur,
              }}
            >
              <Clock size={17} /> {fmtDur(item.est_minutes || 0)}
            </span>
            <button
              onClick={onDone}
              style={{ background: "transparent", border: "none", fontSize: 14, color: C.focusDone, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  item,
  label,
  onDone,
  onPush,
  onDelete,
}: {
  item: PlanItem;
  label: string;
  onDone: () => void;
  onPush: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [open, setOpen] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : ("auto" as any),
    boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.12)" : undefined,
    background: isDragging ? "#FFF8F0" : C.rowBg,
  };
  return (
    <div ref={setNodeRef} style={{ ...style }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: `0.5px solid ${C.rowBorder}`,
          borderRadius: 8,
          padding: "10px 14px",
          margin: "6px 0",
        }}
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reprioritize"
          className="touch-none cursor-grab active:cursor-grabbing"
          style={{ background: "transparent", border: "none", color: C.rowGrip, flexShrink: 0 }}
        >
          <GripVertical size={16} />
        </button>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: C.gold,
            minWidth: 38,
          }}
        >
          {label}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1,
            textAlign: "left",
            background: "transparent",
            border: "none",
            fontSize: 15,
            color: C.rowName,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{item.title}</span>
          {item.pinned_time && <Pin size={13} style={{ color: C.gold, flexShrink: 0 }} />}
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.rowDur }}>{fmtDur(item.est_minutes || 0)}</span>
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, margin: "0 0 8px 38px", flexWrap: "wrap" }}>
          <button
            onClick={onDone}
            style={{
              fontSize: 13,
              color: C.fits,
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            <Check size={13} style={{ verticalAlign: -2 }} /> Done
          </button>
          <button
            onClick={onPush}
            style={{
              fontSize: 13,
              color: C.neutral,
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            Push
          </button>
          <button
            onClick={onDelete}
            style={{
              fontSize: 13,
              color: "#C44",
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            <Trash2 size={13} style={{ verticalAlign: -2 }} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DidntFitRow({
  item,
  onDone,
  onPush,
  onDelete,
}: {
  item: PlanItem;
  onDone: () => void;
  onPush: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [open, setOpen] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : ("auto" as any) };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag back into the day"
          className="touch-none cursor-grab active:cursor-grabbing"
          style={{ background: "transparent", border: "none", color: C.didntHead, flexShrink: 0 }}
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1,
            textAlign: "left",
            background: "transparent",
            border: "none",
            fontSize: 14,
            color: C.didntItem,
            cursor: "pointer",
          }}
        >
          {item.title}
        </button>
        <span style={{ fontSize: 14, color: C.didntItem }}>{fmtDur(item.est_minutes || 0)}</span>
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, margin: "0 0 6px 24px", flexWrap: "wrap" }}>
          <button
            onClick={onDone}
            style={{
              fontSize: 13,
              color: C.fits,
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
          <button
            onClick={onPush}
            style={{
              fontSize: 13,
              color: C.neutral,
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            Push out
          </button>
          <button
            onClick={onDelete}
            style={{
              fontSize: 13,
              color: "#C44",
              background: "transparent",
              border: `0.5px solid ${C.rowBorder}`,
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function RunwayLine({ needed, runway, fits }: { needed: number; runway: number; fits: boolean }) {
  if (needed === 0) {
    return <div style={{ fontSize: 12, marginTop: 4, color: C.upWallTime }}>nothing scheduled before this</div>;
  }
  if (fits) {
    return (
      <div style={{ fontSize: 12, marginTop: 4, color: C.fits, display: "flex", alignItems: "center", gap: 5 }}>
        <Check size={13} /> all fit · {fmtDur(runway - needed)} to spare
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12, marginTop: 4, color: C.wontFit, display: "flex", alignItems: "center", gap: 5 }}>
      <AlertTriangle size={13} /> won't fit — push something ({fmtDur(needed - runway)} over)
    </div>
  );
}

function TogglePills({ viewTomorrow, onToggle }: { viewTomorrow: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginBottom: 16, display: "flex", gap: 6 }}>
      <button
        onClick={viewTomorrow ? onToggle : undefined}
        style={{
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 999,
          padding: "6px 16px",
          border: "none",
          cursor: "pointer",
          background: !viewTomorrow ? C.gold : "#E8DDD0",
          color: !viewTomorrow ? "#fff" : "#3D3225",
        }}
      >
        Today
      </button>
      <button
        onClick={!viewTomorrow ? onToggle : undefined}
        style={{
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 999,
          padding: "6px 16px",
          border: "none",
          cursor: "pointer",
          background: viewTomorrow ? C.gold : "#E8DDD0",
          color: viewTomorrow ? "#fff" : "#3D3225",
        }}
      >
        Tomorrow
      </button>
    </div>
  );
}
