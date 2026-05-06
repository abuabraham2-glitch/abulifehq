import { useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatTime12h } from '@/lib/constants';
import { timeToMin } from '@/lib/planScheduling';

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
  onPick: (newTime24: string, via: 'chip' | 'custom') => void;
  /** Now used as the row's affordance. */
  className?: string;
  style?: React.CSSProperties;
  rowId: string;
}

/** Pacific now in minutes since midnight. */
function pacificNowMin(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return d.getHours() * 60 + d.getMinutes();
}

/** Pacific weekday: 0=Sun..6=Sat */
function pacificWeekday(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return d.getDay();
}

/** Build static weekday locked windows (morning routine 6–8, school pickup 1:45–2:45). */
export function getStaticLockedWindows(): LockedWindow[] {
  const wd = pacificWeekday();
  const isWeekday = wd >= 1 && wd <= 5;
  if (!isWeekday) return [];
  return [
    { startMin: 6 * 60, endMin: 8 * 60 },        // 6:00–8:00 AM
    { startMin: 13 * 60 + 45, endMin: 14 * 60 + 45 }, // 1:45–2:45 PM
  ];
}

function hourIsInsideAny(hourMin: number, windows: LockedWindow[]): boolean {
  // "strictly within": startMin <= hourMin < endMin EXCEPT for morning rule
  // which says 6 AM (inclusive) to 8 AM (exclusive). Same logic works generically.
  return windows.some((w) => hourMin >= w.startMin && hourMin < w.endMin);
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
function minToTime24(min: number): string { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`; }

export function StartTimePicker({ value, lockedWindows, disabled, onPick, className, style, rowId }: Props) {
  const [open, setOpen] = useState(false);
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
      if (hourIsInsideAny(hMin, lockedWindows)) continue;
      out.push(hMin);
      if (out.length >= 8) break;
    }
    return out;
  }, [open, lockedWindows]);

  const handleChip = (hourMin: number) => {
    const t = minToTime24(hourMin);
    console.warn('[time-edit] user picked time=', t, 'via=', 'chip');
    setOpen(false);
    onPick(t, 'chip');
  };

  const openCustom = () => {
    console.warn('[time-edit] custom button clicked — entering openCustom');
    const el = customInputRef.current;
    // Set default to current value (HH:MM)
    if (el) el.value = value.slice(0, 5);
    console.warn('[time-edit] hidden input ref=', el, 'showPicker available=', typeof (el as any)?.showPicker);
    if (!el) return;
    // Try the modern API first (Chromium supports showPicker on time inputs).
    try {
      // @ts-ignore
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.click();
    } catch {
      console.warn('[time-edit] showPicker threw or fell back to click');
      el.click();
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.warn('[time-edit] handleCustomChange fired with value=', e.target.value);
    const v = e.target.value; // "HH:MM"
    if (!v) return;
    const t = `${v}:00`;
    console.warn('[time-edit] user picked time=', t, 'via=', 'custom');
    setOpen(false);
    onPick(t, 'custom');
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
            console.warn('[time-edit] tap detected on row id=', rowId, 'currentStart=', value);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={`px-1 py-0.5 rounded hover:bg-[#FFF8F0] ${className ?? ''}`}
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
            // Log chips when picker actually opens
            console.warn('[time-edit] picker opening, available chips=', chips.map(minToTime24));
          }}
        >
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-w-[260px] mb-2">
              {chips.map((hMin) => (
                <button
                  key={hMin}
                  onClick={() => handleChip(hMin)}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium border min-h-[32px]"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
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
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCustom(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full px-2.5 py-1.5 rounded-lg text-[12px] font-medium border min-h-[34px]"
            style={{ borderColor: '#B8906C', color: '#5C3D1E' }}
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
        style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}

export { timeToMin };
