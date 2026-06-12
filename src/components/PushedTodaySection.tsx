import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanItemsByDate, todayStr, type PlanItem } from "@/hooks/useDailyPlan";
import { findNextSlot, pacificIso, timeToMin, minToTime } from "@/lib/planScheduling";
import { formatTime12h } from "@/lib/constants";

const CREATE_EVENT_WEBHOOK = "https://bottlesandprint.app.n8n.cloud/webhook/life-hq-create-event";

export function PushedTodaySection() {
  const date = todayStr();
  const { data: items = [] } = usePlanItemsByDate(date);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pushed = useMemo(() => (items ?? []).filter((i) => i.status === "skipped" || i.status === "deferred"), [items]);

  const taskIds = useMemo(() => pushed.map((p) => p.task_id).filter(Boolean) as string[], [pushed]);

  const { data: tasksMap = {} } = useQuery({
    queryKey: ["pushed-today-tasks", date, taskIds.sort().join(",")],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, deferred_until, category").in("id", taskIds);
      if (error) throw error;
      const map: Record<string, { deferred_until: string | null; category: string | null }> = {};
      for (const t of data ?? []) map[t.id] = { deferred_until: t.deferred_until, category: t.category };
      return map;
    },
  });

  if (pushed.length === 0) return null;

  const subtitleFor = (item: PlanItem): string => {
    if (item.status === "skipped") return "Pushed to Tomorrow";
    if (item.status === "deferred") {
      const t = item.task_id ? tasksMap[item.task_id] : null;
      const def = t?.deferred_until;
      if (!def) return "Pushed";
      const today = new Date(date + "T12:00:00");
      const target = new Date(def + "T12:00:00");
      const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
      if (diff === 7) return "Pushed to Next week";
      if (diff === 14) return "Pushed to 2 weeks";
      return `Pushed to ${target.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return "Pushed";
  };

  const bringBack = async (item: PlanItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const dur = item.est_minutes || 30;
      // Active timeline = items not skipped/deferred
      const active = (items ?? []).filter((i) => i.status !== "skipped" && i.status !== "deferred");
      const slot = findNextSlot(active, dur, 18 * 60);

      // If slot end exceeds 6pm, append after last
      const endCap = 18 * 60;
      const endMin = timeToMin(slot.end);
      let finalStart = slot.start;
      let finalEnd = slot.end;
      let warned = false;
      if (endMin > endCap) {
        // Append after last active item
        const sortedActive = [...active].sort((a, b) => a.end_time.localeCompare(b.end_time));
        const last = sortedActive[sortedActive.length - 1];
        const startMin = last ? timeToMin(last.end_time) : timeToMin(slot.start);
        finalStart = minToTime(startMin);
        finalEnd = minToTime(startMin + dur);
        warned = true;
      }

      const sortOrder = active.reduce((m, i) => Math.max(m, i.sort_order ?? 0), 0) + 1;

      const { error } = await supabase
        .from("plan_items")
        .update({
          status: "pending",
          start_time: finalStart,
          end_time: finalEnd,
          sort_order: sortOrder,
        } as any)
        .eq("id", item.id);
      if (error) throw error;

      if (item.status === "deferred" && item.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "active", deferred_until: null } as any)
          .eq("id", item.task_id);
      }

      // Fire create-event webhook
      const cat = item.category || (item.task_id ? tasksMap[item.task_id]?.category : null) || "Personal";
      fetch(CREATE_EVENT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          start: pacificIso(date, finalStart),
          end: pacificIso(date, finalEnd),
          category: cat,
          planItemId: item.id,
        }),
      }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["daily-plan"] });

      const timeLabel = formatTime12h(finalStart);
      if (warned) {
        toast(`Brought back after last item, may run late`, { duration: 3000 });
      } else {
        toast(`${item.title} brought back to ${timeLabel}`, { duration: 3000 });
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not bring back task");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-[14px] bg-card" style={{ border: "1px solid #E9DDC6" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px]"
      >
        <span className="text-[13px] font-medium" style={{ color: "#E9DDC6" }}>
          Pushed today ({pushed.length})
        </span>
        <ChevronDown
          size={16}
          className="transition-transform"
          style={{ color: "#E9DDC6", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {pushed.map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-2 py-2 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] truncate" style={{ color: "#E9DDC6" }}>
                  {item.title}
                </p>
                <p className="text-[12px]" style={{ color: "#C9B79F" }}>
                  {subtitleFor(item)}
                </p>
              </div>
              <button
                onClick={() => bringBack(item)}
                disabled={busyId === item.id}
                className="px-3 rounded-lg text-[12px] font-medium border h-8 flex-shrink-0 disabled:opacity-50"
                style={{ borderColor: "#E9DDC6", color: "#E9DDC6" }}
              >
                {busyId === item.id ? "…" : "Bring back"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
