import { useState, useMemo, useRef, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  usePlanItemsByDate,
  useUpdatePlanItem,
  useUpdatePlanItemDuration,
  todayStr,
  tomorrowStr,
  type PlanItem,
} from "@/hooks/useDailyPlan";
import { useCompleteTask, useUpdateTask } from "@/hooks/useTasks";
import { formatTime12h } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getStaticLockedWindows } from "@/components/StartTimePicker";

const SKIP_EVENT_WEBHOOK = "https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event";

const C = {
  page: "#171717",
  focusBg: "#5C3D1E",
  focusName: "#F5F0E8",
  focusDur: "#EBC99C",
  focusDone: "#9A7B5C",
  focusGrip: "#A98A6A",
  gold: "#C89B6E",
  liveWallBg: "#1F4E82",
  liveWallTitle: "#FFFFFF",
  liveWallSub: "#B5D4F4",
  upWallBg: "#E6F1FB",
  upWallBorder: "#378ADD",
  upWallTitle: "#0C447C",
  upWallTime: "#185FA5",
  fits: "#34A98A",
  wontFit: "#D89A4E",
  didntBg: "#E9DDC6",
  didntHead: "#7A5A2E",
  didntItem: "#6B4D2A",
  rowBg: "#2A2A2A",
  rowBorder: "#3A3A3A",
  rowName: "#ECE6DC",
  rowDur: "#B89A78",
  neutral: "#8A857B",
  rowGrip: "#6A6258",
};

const DURATION_PRESETS = [15, 30, 45, 60, 90];

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
function minToTimeStr(min: number): string {
  const clamped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
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

function pacificDateStr(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return formatDateStr(d);
}

// Press-and-hold (~500ms) that works for touch and mouse. Used to remove a wall
// from today's schedule. Cancels if the finger/pointer moves or lifts early.
function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  };
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

interface Props {
  viewTomorrow: boolean;
  onToggleTab: () => void;
  addButton?: React.ReactNode;
  planId?: string | null;
  pausedToday?: { start_date: string; end_date: string } | null;
  onFreeMinutesChange?: (mins: number | null) => void;
}

export function TodaysSchedule({
  viewTomorrow,
  onToggleTab,
  addButton,
  pausedToday = null,
  onFreeMinutesChange,
}: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const updatePlanItemDuration = useUpdatePlanItemDuration();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [pushItem, setPushItem] = useState<PlanItem | null>(null);
  const [pickDateOpen, setPickDateOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<PlanItem | null>(null);
  const [dismissWallItem, setDismissWallItem] = useState<PlanItem | null>(null);
  const [doneStripOpen, setDoneStripOpen] = useState(false);
  const [didntFitOpen, setDidntFitOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const nowMin = useMemo(() => pacificNowMin(), []);

  const allRows = useMemo(() => [...(planItems ?? [])], [planItems]);

  const wallRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (r.is_calendar_event === true || r.is_external === true) &&
          r.status !== "carried_over" &&
          r.status !== "skipped",
      ),
    [allRows],
  );

  const activeTaskRows = useMemo(() => {
    const tasks = allRows.filter(
      (r) =>
        !(r.is_calendar_event === true || r.is_external === true) &&
        r.status !== "completed" &&
        r.status !== "skipped" &&
        r.status !== "deferred" &&
        r.status !== "carried_over",
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

  // FREE TIME LEFT (Request 2): live minutes from "now" to the hard stop that are
  // neither a wall (calendar event / rule block) nor an active placed task.
  //   freeWindows already = (now -> hardStop) minus walls & pins.
  //   subtract the durations of active tasks the engine placed into those windows.
  // Completed / deleted / pushed tasks have already left activeTaskRows, so they
  // are not in result.placed and stop being subtracted automatically; bringing one
  // back returns it to the pool and subtracts again. No extra logic needed.
  const freeMinutesLeft = useMemo(() => {
    const windowFree = result.freeWindows
      .filter((fw) => fw.endMin > nowMin)
      .reduce((s, fw) => s + (fw.endMin - Math.max(fw.startMin, nowMin)), 0);
    const placedDur = result.placed.reduce((s, p) => s + (p.endMin - p.startMin), 0);
    return Math.max(0, windowFree - placedDur);
  }, [result, nowMin]);

  // Report the number up to Dashboard so the day-strip can show it next to
  // "tasks left" / "work remaining". null on the Tomorrow tab (no live "now").
  useEffect(() => {
    if (!onFreeMinutesChange) return;
    onFreeMinutesChange(viewTomorrow ? null : freeMinutesLeft);
  }, [freeMinutesLeft, viewTomorrow, onFreeMinutesChange]);

  const liveWall = useMemo(() => {
    return wallRows.find((w) => {
      const s = timeToMin(w.start_time);
      const e = timeToMin(w.end_time);
      return nowMin >= s && nowMin < e;
    });
  }, [wallRows, nowMin]);

  // Long-press binding for the live "Happening now" wall (rendered once, so the
  // hook can live at the top level). Only arms when the live wall is a real
  // calendar event (has calendar_event_id).
  const liveWallLongPress = useLongPress(() => {
    if (liveWall && liveWall.calendar_event_id) setDismissWallItem(liveWall);
  });

  const upcomingWalls = useMemo(() => {
    return wallRows
      .filter((w) => timeToMin(w.start_time) > nowMin)
      .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
      .map((w) => {
        const wallStart = timeToMin(w.start_time);
        let gapStart = nowMin;
        for (const x of wallRows) {
          const xs = timeToMin(x.start_time);
          const xe = timeToMin(x.end_time);
          if (xs < wallStart && xe <= wallStart && xe > gapStart) gapStart = xe;
        }
        const runway = result.freeWindows
          .filter((fw) => fw.endMin > gapStart && fw.startMin < wallStart)
          .reduce((s, fw) => s + (Math.min(fw.endMin, wallStart) - Math.max(fw.startMin, gapStart)), 0);
        const needed = placedTasks
          .filter((pt) => pt.placed.startMin >= gapStart && pt.placed.endMin <= wallStart)
          .reduce((s, pt) => s + (pt.placed.endMin - pt.placed.startMin), 0);
        return { row: w, wallStart, wallEnd: timeToMin(w.end_time), needed, runway, fits: runway >= needed };
      });
  }, [wallRows, nowMin, result, placedTasks]);

  // Reserved rule-windows to DRAW (display only — engine already accounts for these).
  // We only surface the SCHOOL PICKUP window (the one that visibly shrinks a mid-day gap).
  // Morning block and the 6pm hard-stop window are intentionally NOT drawn as blocks.
  // getStaticLockedWindows() returns unlabeled {startMin,endMin}; the pickup window is
  // identified by its exact times: M/T/Th/F 14:10-15:10, Wednesday 13:10-14:10.
  const reservedNodes = useMemo(() => {
    const PICKUP = [
      { startMin: 14 * 60 + 10, endMin: 15 * 60 + 10 }, // M/T/Th/F 2:10–3:10 PM
      { startMin: 13 * 60 + 10, endMin: 14 * 60 + 10 }, // Wed 1:10–2:10 PM
    ];
    return getStaticLockedWindows()
      .filter((w: any) => PICKUP.some((p) => p.startMin === w.startMin && p.endMin === w.endMin))
      .filter((w: any) => w.endMin > nowMin) // don't show what's behind you
      .map((w: any) => ({
        startMin: w.startMin,
        endMin: w.endMin,
        label: "School pickup",
      }));
  }, [nowMin]);

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

  const handleDurationChange = async (item: PlanItem, minutes: number) => {
    if (!minutes || minutes <= 0 || minutes === item.est_minutes) return;
    const startMin = timeToMin(item.start_time);
    const newEnd = minToTimeStr(startMin + minutes);
    try {
      await updatePlanItemDuration.mutateAsync({ id: item.id, est_minutes: minutes, end_time: newEnd });
      toast(`Duration set · ${fmtDur(minutes)}`, {
        duration: 2500,
        style: { background: C.focusBg, color: "#fff", border: "none" },
      });
    } catch {
      toast.error("Couldn't save the new duration.");
    }
  };

  const openDoneDialog = (item: PlanItem) => {
    setActualMinutes(item.actual_minutes ?? item.est_minutes ?? 25);
    setDoneItem(item);
  };

  const handleSaveDone = async () => {
    if (!doneItem) return;
    const item = doneItem;
    const duration = actualMinutes;
    setDoneItem(null);

    // IMMEDIATE WRITE (no 5s timeout). The plan_item is marked completed right away,
    // and the underlying tasks row is flipped so the 9pm planner (which pulls
    // status=eq.active) can never re-pull it. Undo reverses the write.
    // Track which task id(s) we actually changed so Undo can reverse exactly those.
    let completedTaskIds: string[] = [];
    try {
      await updatePlanItem.mutateAsync({ id: item.id, status: "completed", actual_minutes: duration });

      if (item.task_id) {
        // Linked row: flip the exact task. This is the reliable path.
        await completeTask.mutateAsync(item.task_id);
        completedTaskIds = [item.task_id];
      } else {
        // No link (legacy rows). SAFE single-match only: act ONLY if exactly one
        // task matches by exact (case-insensitive) name. Never bulk-complete.
        const titleKey = stripTitleSuffix(item.title);
        const { data: matches } = await supabase.from("tasks").select("id,name").ilike("name", titleKey);
        if (matches && matches.length === 1) {
          await supabase
            .from("tasks")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", matches[0].id);
          completedTaskIds = [matches[0].id];
        }
        // 0 matches or 2+ matches: leave tasks untouched. The plan_item is already
        // completed so it leaves today's screen; nothing is bulk-archived.
      }

      fireSkipWebhook(item);
      queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error("Couldn't mark that done. Try again.");
      return;
    }

    toast(`Marked done · ${duration}m`, {
      duration: 5000,
      style: { background: C.focusBg, color: "#fff", border: "none" },
      action: {
        label: "Undo",
        onClick: async () => {
          // Reverse: plan_item back to pending, and any task we changed back to active.
          await supabase.from("plan_items").update({ status: "pending" }).eq("id", item.id);
          if (completedTaskIds.length > 0) {
            await supabase
              .from("tasks")
              .update({ status: "active", completed_at: null } as any)
              .in("id", completedTaskIds);
          }
          queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    const target = tomorrowStr();
    await supabase
      .from("plan_items")
      .update({ status: "deferred", deferred_until: target } as any)
      .eq("id", item.id);
    if (item.task_id) {
      await updateTask.mutateAsync({ id: item.task_id, status: "deferred", deferred_until: target });
    } else {
      // No link (legacy rows). SAFE single-match only: defer the task ONLY if exactly
      // one matches by exact (case-insensitive) name. Otherwise leave tasks untouched
      // (the plan_item is already deferred so it leaves today's screen).
      const titleKey = stripTitleSuffix(item.title);
      const { data: matches } = await supabase.from("tasks").select("id").ilike("name", titleKey);
      if (matches && matches.length === 1) {
        await updateTask.mutateAsync({ id: matches[0].id, status: "deferred", deferred_until: target });
      }
    }
    fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setPushItem(null);
  };

  const handleDefer = async (item: PlanItem, deferDate: string) => {
    const planItemPatch = supabase
      .from("plan_items")
      .update({ status: "deferred", deferred_until: deferDate } as any)
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) console.warn("[push] plan_items deferred patch failed", error);
      });
    let tasksPatch: Promise<unknown> = Promise.resolve();
    if (item.task_id) {
      tasksPatch = updateTask.mutateAsync({ id: item.task_id, status: "deferred", deferred_until: deferDate });
    } else {
      // No link (legacy rows). SAFE single-match only: defer the task ONLY if exactly
      // one matches by exact name. Otherwise leave the task pool untouched.
      const titleKey = stripTitleSuffix(item.title);
      tasksPatch = supabase
        .from("tasks")
        .select("id")
        .ilike("name", titleKey)
        .then(({ data: matches }) => {
          if (matches && matches.length === 1) {
            return updateTask.mutateAsync({ id: matches[0].id, status: "deferred", deferred_until: deferDate });
          }
        });
    }
    await Promise.all([planItemPatch, tasksPatch]);
    fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setPushItem(null);
    setPickDateOpen(false);
  };

  // Remove a calendar WALL from today's schedule only. The calendar event is left
  // untouched. We (a) record the dismissal in dismissed_walls so the Same-Day Sync
  // won't re-add it today, and (b) mark the wall's plan_item carried_over so it
  // disappears from every view now. Scoped to today; tomorrow's 9pm rebuild is fresh.
  const performWallDismiss = async (item: PlanItem) => {
    if (!item.calendar_event_id) return; // only real calendar walls are dismissible
    const today = pacificDateStr();

    // (a) remember the dismissal (idempotent thanks to the UNIQUE constraint)
    // Cast the client to any for this call: dismissed_walls is a new table and the
    // generated Supabase types don't include it yet, so TS would error on .from().
    // (Same pattern used elsewhere in this file for loosely-typed writes.)
    const { error: dismErr } = await (supabase as any)
      .from("dismissed_walls")
      .upsert(
        { calendar_event_id: item.calendar_event_id, dismiss_date: today },
        { onConflict: "calendar_event_id,dismiss_date" },
      );
    if (dismErr) {
      console.warn("[wall-dismiss] dismissed_walls write failed", dismErr);
      toast.error("Couldn't remove that wall. Try again.");
      return;
    }

    // (b) hide the wall now
    const { error: piErr } = await supabase
      .from("plan_items")
      .update({ status: "carried_over" } as any)
      .eq("id", item.id);
    if (piErr) {
      console.warn("[wall-dismiss] plan_items hide failed", piErr);
      toast.error("Removed from calendar memory, but the wall didn't hide. Refresh.");
    }

    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    toast(`Removed from today: ${item.title}`, {
      description: "Your calendar wasn't changed.",
      duration: 4000,
      style: { background: C.focusBg, color: "#fff", border: "none" },
    });
  };

  const requestDelete = (item: PlanItem) => {
    if (item.calendar_event_id) setConfirmDeleteItem(item);
    else performDelete(item);
  };

  const performDelete = async (item: PlanItem) => {
    await supabase.from("plan_items").update({ status: "carried_over" }).eq("id", item.id);
    let archivedTaskIds: string[] = [];
    let unsafeMatch = false;
    if (item.task_id) {
      // Linked row: archive the exact task. Reliable path.
      await supabase.from("tasks").update({ status: "archived" }).eq("id", item.task_id);
      archivedTaskIds = [item.task_id];
    } else {
      // No link (legacy rows). SAFE single-match only: archive ONLY if exactly one
      // task matches by exact (case-insensitive) name. Never bulk-archive.
      const titleKey = stripTitleSuffix(item.title);
      const { data: matches } = await supabase.from("tasks").select("id").ilike("name", titleKey);
      if (matches && matches.length === 1) {
        archivedTaskIds = [matches[0].id];
        await supabase.from("tasks").update({ status: "archived" }).eq("id", matches[0].id);
      } else if (matches && matches.length > 1) {
        // Ambiguous: do NOT touch any task. The plan_item is already removed from
        // today, but the task pool is left alone for the user to handle in Tasks.
        unsafeMatch = true;
      }
      // 0 matches: nothing to archive; plan_item removal is enough for today.
    }
    if (item.calendar_event_id) fireSkipWebhook(item);
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });

    toast(`Deleted: ${item.title}`, {
      description: item.calendar_event_id
        ? "Calendar event deleted"
        : unsafeMatch
          ? "Removed from today; review in Tasks if it returns."
          : undefined,
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
          <p style={{ fontSize: 18, fontWeight: 500, color: C.focusName }}>
            {isSingleDay ? "Paused" : `Paused ${fmt(pausedToday.start_date)} to ${fmt(pausedToday.end_date)}`}
          </p>
        </div>
        {addButton}
      </div>
    );
  }

  if (viewTomorrow) {
    const tomorrowTaskRows = allRows.filter(
      (r) =>
        !(r.is_calendar_event || r.is_external) &&
        r.status !== "completed" &&
        r.status !== "skipped" &&
        r.status !== "carried_over",
    );
    const tomorrowWallRows = allRows.filter(
      (r) => (r.is_calendar_event || r.is_external) && r.status !== "carried_over" && r.status !== "skipped",
    );

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
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.rowName }}>{item.title}</span>
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
    | { kind: "wall"; wall: (typeof upcomingWalls)[number]; startMin: number }
    | { kind: "reserved"; reserved: (typeof reservedNodes)[number]; startMin: number };

  const streamNodes: StreamNode[] = [];
  streamTasks.forEach((row, idx) => {
    const placed = placedTasks.find((p) => p.row.id === row.id);
    streamNodes.push({ kind: "task", row, order: idx, startMin: placed ? placed.placed.startMin : 9999 });
  });
  upcomingWalls.forEach((w) => streamNodes.push({ kind: "wall", wall: w, startMin: w.wallStart }));
  reservedNodes.forEach((r) => streamNodes.push({ kind: "reserved", reserved: r, startMin: r.startMin }));
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
            <div
              {...(liveWall.calendar_event_id ? liveWallLongPress : {})}
              style={{
                background: C.liveWallBg,
                borderRadius: 20,
                padding: "30px 28px",
                marginBottom: 16,
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
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
              onDurationChange={(m) => handleDurationChange(focusTask, m)}
              durationSaving={updatePlanItemDuration.isPending}
            />
          ) : null}

          <p
            style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.gold, margin: "14px 0 10px 2px" }}
          >
            YOUR DAY
          </p>

          {streamNodes.map((node) => {
            if (node.kind === "wall") {
              const w = node.wall;
              return (
                <UpcomingWallBlock
                  key={`wall-${w.row.id}`}
                  wall={w}
                  onLongPress={() => {
                    if (w.row.calendar_event_id) setDismissWallItem(w.row);
                  }}
                />
              );
            }
            if (node.kind === "reserved") {
              const r = node.reserved;
              return <ReservedBlock key={`reserved-${r.startMin}`} reserved={r} />;
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
                onDurationChange={(m) => handleDurationChange(row, m)}
                durationSaving={updatePlanItemDuration.isPending}
              />
            );
          })}

          {streamNodes.length === 0 && (
            <p style={{ fontSize: 13, color: C.neutral, padding: "8px 2px" }}>Nothing else queued.</p>
          )}

          {hardStopMin() > nowMin && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 2px 4px" }}>
              <div style={{ flexGrow: 1, height: 1, background: C.rowBorder }} />
              <span style={{ color: C.rowGrip, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>
                DAY ENDS · {minTo12h(hardStopMin())}
              </span>
              <div style={{ flexGrow: 1, height: 1, background: C.rowBorder }} />
            </div>
          )}

          <div style={{ marginTop: 14, marginBottom: 2 }}>{addButton}</div>

          {didNotFitTasks.length > 0 && (
            <div style={{ background: C.didntBg, borderRadius: 12, padding: "12px 14px", marginTop: 16 }}>
              <button
                onClick={() => setDidntFitOpen((o) => !o)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.didntHead,
                  marginBottom: didntFitOpen ? 8 : 0,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CornerRightUp size={15} /> Didn't fit today ({didNotFitTasks.length}) — rolls to tomorrow
                </span>
                {didntFitOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {didntFitOpen && (
                <>
                  {didNotFitTasks.map((row) => (
                    <DidntFitRow
                      key={row.id}
                      item={row}
                      onDone={() => openDoneDialog(row)}
                      onPush={() => setPushItem(row)}
                      onDelete={() => requestDelete(row)}
                      onDurationChange={(m) => handleDurationChange(row, m)}
                      durationSaving={updatePlanItemDuration.isPending}
                    />
                  ))}
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.didntHead, marginTop: 8 }}>
                    Nothing is lost. These come back in tomorrow's pool.
                  </div>
                </>
              )}
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

      <AlertDialog open={!!dismissWallItem} onOpenChange={(o) => !o && setDismissWallItem(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[18px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this from today?</AlertDialogTitle>
            <AlertDialogDescription>
              "{dismissWallItem?.title}" will be removed from today's schedule so it stops blocking your free time. Your
              Google Calendar won't be changed. It can come back tomorrow if it's still on your calendar.
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
                const it = dismissWallItem;
                setDismissWallItem(null);
                if (it) performWallDismiss(it);
              }}
            >
              Remove from today
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DurationEditor({
  minutes,
  onChange,
  saving,
  triggerStyle,
}: {
  minutes: number;
  onChange: (m: number) => void;
  saving?: boolean;
  triggerStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const pick = (m: number) => {
    setOpen(false);
    setCustom("");
    onChange(m);
  };

  const applyCustom = () => {
    const n = Number(custom);
    if (!n || n <= 0) return;
    setOpen(false);
    setCustom("");
    onChange(n);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="Edit duration"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, ...triggerStyle }}
        >
          {fmtDur(minutes || 0)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-3 rounded-[14px]"
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.rowBg, border: `1px solid ${C.rowBorder}` }}
      >
        <p style={{ fontSize: 12, color: C.neutral, marginBottom: 8 }}>How long will this take?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => pick(m)}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                minHeight: 36,
                cursor: "pointer",
                border: `1px solid ${minutes === m ? C.gold : C.rowBorder}`,
                background: minutes === m ? C.gold : "transparent",
                color: minutes === m ? "#fff" : C.rowName,
              }}
            >
              {m}m
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCustom();
            }}
            className="w-20 text-center h-9"
          />
          <span style={{ fontSize: 13, color: C.neutral }}>min</span>
          <button
            onClick={applyCustom}
            disabled={saving || !custom}
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              minHeight: 36,
              cursor: custom ? "pointer" : "default",
              border: "none",
              background: custom ? C.focusBg : "#4A4A4A",
              color: "#fff",
            }}
          >
            Set
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FocusTaskCard({
  item,
  onDone,
  onPush,
  onDurationChange,
  durationSaving,
}: {
  item: PlanItem;
  onDone: () => void;
  onPush: () => void;
  onDurationChange: (m: number) => void;
  durationSaving?: boolean;
}) {
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
              <Clock size={17} />
              <DurationEditor
                minutes={item.est_minutes || 0}
                onChange={onDurationChange}
                saving={durationSaving}
                triggerStyle={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: C.focusDur,
                  textDecoration: "underline",
                  textDecorationColor: "rgba(235,201,156,0.4)",
                  textUnderlineOffset: 3,
                }}
              />
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
  onDurationChange,
  durationSaving,
}: {
  item: PlanItem;
  label: string;
  onDone: () => void;
  onPush: () => void;
  onDelete: () => void;
  onDurationChange: (m: number) => void;
  durationSaving?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [open, setOpen] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : ("auto" as any),
    boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.40)" : undefined,
    background: isDragging ? "#33302B" : C.rowBg,
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
          <span style={{ flex: 1, fontWeight: 700 }}>{item.title}</span>
          {item.pinned_time && <Pin size={13} style={{ color: C.gold, flexShrink: 0 }} />}
        </button>
        <DurationEditor
          minutes={item.est_minutes || 0}
          onChange={onDurationChange}
          saving={durationSaving}
          triggerStyle={{
            fontSize: 14,
            fontWeight: 500,
            color: C.rowDur,
          }}
        />
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
              color: "#E0795C",
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
  onDurationChange,
  durationSaving,
}: {
  item: PlanItem;
  onDone: () => void;
  onPush: () => void;
  onDelete: () => void;
  onDurationChange: (m: number) => void;
  durationSaving?: boolean;
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
            fontWeight: 700,
            color: C.didntItem,
            cursor: "pointer",
          }}
        >
          {item.title}
        </button>
        <DurationEditor
          minutes={item.est_minutes || 0}
          onChange={onDurationChange}
          saving={durationSaving}
          triggerStyle={{
            fontSize: 14,
            color: C.didntItem,
          }}
        />
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, margin: "0 0 6px 24px", flexWrap: "wrap" }}>
          <button
            onClick={onDone}
            style={{
              fontSize: 13,
              color: C.fits,
              background: "transparent",
              border: `0.5px solid ${C.didntHead}`,
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
              color: C.didntItem,
              background: "transparent",
              border: `0.5px solid ${C.didntHead}`,
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
              color: "#B5462E",
              background: "transparent",
              border: `0.5px solid ${C.didntHead}`,
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

function ReservedBlock({ reserved }: { reserved: { startMin: number; endMin: number; label: string } }) {
  return (
    <div
      style={{
        background: "transparent",
        border: `1.5px dashed ${C.rowBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        margin: "10px 0",
        display: "flex",
        alignItems: "center",
        gap: 10,
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      <Lock size={14} style={{ color: C.rowGrip }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.neutral, letterSpacing: "0.02em" }}>
        {reserved.label}
      </span>
      <span style={{ fontSize: 12, color: C.rowGrip }}>
        {minTo12h(reserved.startMin)}–{minTo12h(reserved.endMin)}
      </span>
    </div>
  );
}

function UpcomingWallBlock({
  wall,
  onLongPress,
}: {
  wall: {
    row: PlanItem;
    wallStart: number;
    wallEnd: number;
    needed: number;
    runway: number;
    fits: boolean;
  };
  onLongPress: () => void;
}) {
  const press = useLongPress(onLongPress);
  const dismissible = !!wall.row.calendar_event_id;
  return (
    <div
      {...(dismissible ? press : {})}
      style={{
        background: C.upWallBg,
        borderRadius: "0 8px 8px 0",
        borderLeft: `3px solid ${C.upWallBorder}`,
        padding: "12px 14px",
        margin: "10px 0",
        WebkitUserSelect: "none",
        userSelect: "none",
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
          <Lock size={13} /> {wall.row.title}
        </span>
        <span style={{ fontSize: 13, color: C.upWallTime }}>
          {minTo12h(wall.wallStart)}–{minTo12h(wall.wallEnd)}
        </span>
      </div>
      <RunwayLine needed={wall.needed} runway={wall.runway} fits={wall.fits} />
    </div>
  );
}

function RunwayLine({ needed, runway, fits }: { needed: number; runway: number; fits: boolean }) {
  if (needed === 0) {
    return <div style={{ fontSize: 12, marginTop: 4, color: C.upWallTime }}>nothing scheduled before this</div>;
  }
  if (fits) {
    return (
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginTop: 4,
          color: C.fits,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Check size={13} /> all fit · {fmtDur(runway - needed)} to spare
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginTop: 4,
        color: C.wontFit,
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <AlertTriangle size={13} /> won't fit — push something ({fmtDur(needed - runway)} over)
    </div>
  );
}

function TogglePills({ viewTomorrow, onToggle }: { viewTomorrow: boolean; onToggle: () => void }) {
  return (
    <div className="mt-4 md:mt-3" style={{ marginBottom: 16, display: "flex", gap: 6 }}>
      <button
        onClick={viewTomorrow ? onToggle : undefined}
        style={{
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 999,
          padding: "6px 16px",
          border: "none",
          cursor: "pointer",
          background: !viewTomorrow ? C.gold : "#33312D",
          color: !viewTomorrow ? "#fff" : "#C9C2B6",
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
          background: viewTomorrow ? C.gold : "#33312D",
          color: viewTomorrow ? "#fff" : "#C9C2B6",
        }}
      >
        Tomorrow
      </button>
    </div>
  );
}
