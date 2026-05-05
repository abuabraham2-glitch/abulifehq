import { useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatTime12h } from '@/lib/constants';
import { timeToMin } from '@/lib/planScheduling';

export interface LockedWindow {
  startMin: number;
  endMin: number;
}

interface Props {
  rowId: string;
  currentStart: string; // "HH:MM:SS"
  disabled?: boolean;
  lockedWindows: LockedWindow[]; // exclude any chip whose hour-min falls strictly within
  onPick: (newTime24: string, via: 'chip' | 'custom') => void;
}

function pacificNowMin(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return d.getHours() * 60 + d.getMinutes();
}

function isWeekday(): boolean {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function StartTimePicker({ rowId, currentStart, disabled, lockedWindows, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);

  const chips = useMemo(() => {
    if (!open) return [];
    const nowMin = pacificNowMin();
    // Start at next round hour at or after now
    const startHour = nowMin % 60 === 0 ? Math.floor(nowMin / 60) : Math.floor(nowMin / 60) + 1;
    const endHour = 19; // 7 PM cap (inclusive)
    const weekday = isWeekday();

    // Build extended locked windows
    const allLocked: LockedWindow[] = [...lockedWindows];
    if (weekday) {
      allLocked.push({ startMin: 6 * 60, endMin: 8 * 60 }); // 6-8am morning routine
      allLocked.push({ startMin: 13 * 60 + 45, endMin: 14 * 60 + 45 }); // 1:45-2:45 pickup
    }

    const out: number[] = []; // hours
    for (let h = startHour; h <= endHour; h++) {
      const minVal = h * 60;
      const blocked = allLocked.some((w) => minVal > w.startMin && minVal < w.endMin)
        || allLocked.some((w) => minVal >= w.startMin && minVal < w.endMin);
      // Spec: "exclude any chip whose hour value falls strictly within a locked window"
      // Treat start-inclusive, end-exclusive (e.g. 6 AM excluded for 6-8am window).
      if (!blocked) out.push(h);
      if (out.length >= 8) break;
    }
    // eslint-disable-next-line no-console
    console.warn('[time-edit] picker opening, available chips=', out.map((h) => `${pad2(h)}:00`));
    return out;
  }, [open, lockedWindows]);

  const handleChip = (hour: number) => {
    const t = `${pad2(hour)}:00:00`;
    setOpen(false);
    // eslint-disable-next-line no-console
    console.warn('[time-edit] user picked time=', t, 'via=', 'chip');
    onPick(t, 'chip');
  };

  const handleCustomConfirm = (val: string) => {
    if (!val) return;
    // val is "HH:MM"
    const t = `${val}:00`;
    setOpen(false);
    // eslint-disable-next-line no-console
    console.warn('[time-edit] user picked time=', t, 'via=', 'custom');
    onPick(t, 'custom');
  };

  if (disabled) {
    return (
      <span className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px] ml-1">
        {formatTime12h(currentStart)}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // eslint-disable-next-line no-console
            console.warn('[time-edit] tap detected on row id=', rowId, 'currentStart=', currentStart);
          }}
          className="text-[12px] text-muted-foreground flex-shrink-0 w-[60px] ml-1 px-1 py-0.5 rounded hover:bg-[#FFF8F0] text-left cursor-pointer"
        >
          {formatTime12h(currentStart)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[260px]">
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {chips.map((h) => (
                <button
                  key={h}
                  onClick={() => handleChip(h)}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium border min-h-[32px]"
                  style={{
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  {formatTime12h(`${pad2(h)}:00:00`)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground mb-2 px-1">
              No round-hour slots available — use Custom.
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-1 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
            <input
              ref={customRef}
              type="time"
              defaultValue={currentStart.slice(0, 5)}
              className="text-[12px] px-2 py-1 rounded border min-h-[32px]"
              style={{ borderColor: 'hsl(var(--border))' }}
            />
            <button
              onClick={() => handleCustomConfirm(customRef.current?.value || '')}
              className="px-2.5 h-8 rounded-lg text-[12px] font-medium text-white"
              style={{ backgroundColor: '#B8906C' }}
            >
              Custom time
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
