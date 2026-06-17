import { useMemo } from "react";
import { usePlanItemsByDate, todayStr, tomorrowStr } from "@/hooks/useDailyPlan";

const SKIP_TITLE = (t: string) => {
  const l = t.toLowerCase();
  return (
    l.startsWith("buffer") ||
    l === "lunch break" ||
    l.includes("victory hour") ||
    l.startsWith("school pickup") ||
    l.includes("wind down") ||
    l.includes("morning routine")
  );
};

function fmtDur(totalMin: number): string {
  const safe = Math.max(0, totalMin);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

interface Props {
  viewTomorrow?: boolean;
  /** Live "free time left" in minutes, computed by the engine in TodaysSchedule.
   *  Undefined while the engine hasn't reported yet (or on the Tomorrow tab). */
  freeMinutes?: number | null;
}

export function DayStripCard({ viewTomorrow = false, freeMinutes = null }: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
  const { data: items } = usePlanItemsByDate(dateString);

  const pendingTasks = useMemo(() => {
    return (items ?? []).filter((i) => !i.is_calendar_event && !SKIP_TITLE(i.title) && i.status === "pending");
  }, [items]);

  const taskCount = pendingTasks.length;
  const totalMin = useMemo(() => pendingTasks.reduce((s, i) => s + (i.est_minutes || 0), 0), [pendingTasks]);

  if (!items) return null;

  const workLabel = fmtDur(totalMin);
  const freeLabel = typeof freeMinutes === "number" ? fmtDur(freeMinutes) : "—";

  return (
    <div style={{ padding: "10px 4px", display: "flex", alignItems: "center" }}>
      <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9A948A" }}>
        <span style={{ color: "#ECE6DC", fontWeight: 500 }}>{taskCount}</span> tasks left
      </span>
      <div style={{ width: 1, height: 20, background: "#333333" }} />
      <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9A948A" }}>
        <span style={{ color: "#ECE6DC", fontWeight: 500 }}>{workLabel}</span> work
      </span>
      <div style={{ width: 1, height: 20, background: "#333333" }} />
      <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9A948A" }}>
        <span style={{ color: "#ECE6DC", fontWeight: 500 }}>{freeLabel}</span> free
      </span>
    </div>
  );
}
