import { useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTime12h } from "@/lib/constants";
import { timeToMin } from "@/lib/planScheduling";

interface LockedWindow {
  startMin: number;
  endMin: number;
}

interface Props {
  /** The row's current start_time, "HH:MM:SS" 24h. */
  value: string;
  /** Locked windows (in minutes since midnight) — chip excluded if hour falls strictly inside any. */
  lockedWindows: LockedWindow[];
  disabled?: boolean;
  onPick: (newTime24: string, via: "chip" | "custom") => void;
  /** Now used as the row's affordance. */
  className?: string;
  style?: React.CSSProperties;
  rowId: string;
}

/** Pacific now in minutes since midnight. */
function pacificNowMin(): number {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return d.getHours() * 60 + d.getMinutes();
}

/** Pacific weekday: 0=Sun..6=Sat */
function pacificWeekday(): number {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return d.getDay();
}

// ---------------------------------------------------------------------------
// TIME RULES — MUST MATCH n8n Rules Config (workflow MaJHuMNBsg5noFra) EXACTLY.
// Source of truth values read from live Rules Config on June 10, 2026:
//   WEEKDAY morning block 06:00-08:30 | pickup 14:10-15:10 | hard stop 18:00
//   WEDNESDAY pickup 13:10-14:10 (overrides weekday pickup)
//   SATURDAY earliest 10:00 | hard stop 16:00
//   SUNDAY full rest day
// If a time changes in n8n, change it HERE too. Two places, by design.
// ---------------------------------------------------------------------------
function hm(h: number, m: number): number {
  return h * 60 + m;
}

export function getStaticLockedWindows(): LockedWindow[] {
  const wd = pacificWeekday();

  // Sunday: rest day — no task placement windows enforced here.
  if (wd === 0) return [];

  // Saturday: earliest start 10:00, hard stop 16:00. Block before 10 and after 16.
  if (wd === 6) {
    return [
      { startMin: 0, endMin: hm(10, 0) }, // before 10:00 AM
      { startMin: hm(16, 0), endMin: 24 * 60 }, // after 4:00 PM
    ];
  }

  // Weekdays (Mon–Fri).
  const windows: LockedWindow[] = [
    { startMin: hm(6, 0), endMin: hm(8, 30) }, // morning block 6:00–8:30 AM
  ];

  // Wednesday pickup overrides the standard weekday pickup time.
  if (wd === 3) {
    windows.push({ startMin: hm(13, 10), endMin: hm(14, 10) }); // Wed pickup 1:10–2:10 PM
  } else {
    windows.push({ startMin: hm(14, 10), endMin: hm(15, 10) }); // M/T/Th/F pickup 2:10–3:10 PM
  }

  // Hard stop 6:00 PM — nothing should start at/after the hard stop.
  windows.push({ startMin: hm(18, 0), endMin: 24 * 60 });

  return windows;
}

/** True if a proposed task START minute falls inside any locked window. */
function minInsideAny(startMin: number, windows: LockedWindow[]): boolean {
  return windows.some((w) => startMin >= w.startMin && startMin < w.endMin);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function minToTime24(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;
}

export function StartTimePicker({ value, lockedWindows, disabled, onPick, className, style, rowId }: Props) {
  const [open, setOpen] = useState(false);
  const [customWarn, setCustomWarn] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const chips = useMemo(() => {
    if (!open) return [] as number[];
    const nowMin = pacificNowMin();
    // Start at next round hour at-or-after now.
    const startHour = nowMin % 60 === 0 ? Math.floor(nowMin / 60) : Math.floor(nowMin / 60) + 1;
    const endHour = 22; // 10 PM cap (inclusive)
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const hMin = h * 60;
      if (minInsideAny(hMin, lockedWindows)) continue;
      out.push(hMin);
      if (out.length >= 8) break;
    }
    return out;
  }, [open, lockedWindows]);

  const handleChip = (hourMin: number) => {
    const t = minToTime24(hourMin);
    console.warn("[time-edit] user picked time=", t, "via=", "chip");
    setCustomWarn(null);
    setOpen(false);
    onPick(t, "chip");
  };

  const openCustom = () => {
    console.warn("[time-edit] custom button clicked — entering openCustom");
    const el = customInputRef.current;
    if (el) el.value = value.slice(0, 5);
    if (!el) return;
    try {
      // @ts-ignore
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
    } catch {
      console.warn("[time-edit] showPicker threw or fell back to click");
      el.click();
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; // "HH:MM"
    if (!v) return;
    const [hh, mm] = v.split(":").map((x) => parseInt(x, 10));
    const startMin = hh * 60 + mm;
    // Block custom times that fall inside a locked window — same rule n8n enforces.
    if (minInsideAny(startMin, lockedWindows)) {
      setCustomWarn(
        `${formatTime12h(`${v}:00`)} is inside a blocked window (morning routine, school pickup, or after hard stop) and would be dropped when you regenerate. Pick another time.`,
      );
      // Reset the input back to the existing value so nothing is committed.
      if (customInputRef.current) customInputRef.current.value = value.slice(0, 5);
      return;
    }
    const t = `${v}:00`;
    console.warn("[time-edit] user picked time=", t, "via=", "custom");
    setCustomWarn(null);
    setOpen(false);
    onPick(t, "custom");
  };

  if (disabled) {
    return (
      <span className={className} style={style}>
        {formatTime12h(value)}
      </span>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setCustomWarn(null);
            console.warn("[time-edit] tap detected on row id=", rowId, "currentStart=", value);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={`px-1 py-0.5 rounded hover:bg-[#FFF8F0] ${className ?? ""}`}
            style={style}
            aria-label="Change start time"
          >
            {formatTime12h(value)}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-3 rounded-xl"
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={() => {
            console.warn("[time-edit] picker opening, available chips=", chips.map(minToTime24));
          }}
        >
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-w-[260px] mb-2">
              {chips.map((hMin) => (
                <button
                  key={hMin}
                  onClick={() => handleChip(hMin)}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium border min-h-[32px]"
                  style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                >
                  {formatTime12h(minToTime24(hMin))}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground mb-2 max-w-[240px]">
              No round-hour slots available — use Custom.
            </p>
          )}
          {customWarn && (
            <p
              className="text-[12px] mb-2 max-w-[240px] rounded-lg px-2.5 py-1.5"
              style={{ backgroundColor: "#FBEAEA", color: "#9A2A2A" }}
            >
              {customWarn}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openCustom();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full px-2.5 py-1.5 rounded-lg text-[12px] font-medium border min-h-[34px]"
            style={{ borderColor: "#B8906C", color: "#5C3D1E" }}
          >
            Custom time
          </button>
        </PopoverContent>
      </Popover>

      {/* Hidden native time input for the Custom flow. Kept always-mounted so showPicker()
          works synchronously after a user gesture. */}
      <input
        ref={customInputRef}
        type="time"
        defaultValue={value.slice(0, 5)}
        onChange={handleCustomChange}
        style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}

export { timeToMin };
