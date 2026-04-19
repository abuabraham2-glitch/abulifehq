// Helpers for inserting new plan items into today's schedule.
// All times are 24h "HH:MM:SS" strings in Pacific Time (matches plan_items.start_time/end_time).

export function pacificNowTime(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

export function minToTime(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

interface SlotItem {
  start_time: string;
  end_time: string;
}

/**
 * Find the first available gap of at least `estMinutes` between now and `endCapMin` (default 6pm = 1080).
 * Returns { start, end } as 24h time strings. Falls back to appending after last item.
 */
export function findNextSlot(
  items: SlotItem[],
  estMinutes: number,
  endCapMin: number = 18 * 60,
): { start: string; end: string } {
  const nowMin = timeToMin(pacificNowTime());
  const sorted = [...items]
    .map((i) => ({ start: timeToMin(i.start_time), end: timeToMin(i.end_time) }))
    .sort((a, b) => a.start - b.start);

  let cursor = Math.max(nowMin, 6 * 60); // never earlier than 6am
  for (const it of sorted) {
    if (it.end <= cursor) continue;
    const gapStart = Math.max(cursor, nowMin);
    if (it.start - gapStart >= estMinutes && gapStart + estMinutes <= endCapMin) {
      return { start: minToTime(gapStart), end: minToTime(gapStart + estMinutes) };
    }
    cursor = Math.max(cursor, it.end);
  }
  // Append at end (no cap)
  const start = Math.max(cursor, nowMin);
  return { start: minToTime(start), end: minToTime(start + estMinutes) };
}

/** Build an ISO datetime string for the given Pacific date + 24h time, with -07:00/-08:00 offset. */
export function pacificIso(dateStr: string, time24: string): string {
  // Determine PT offset for that date
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const ptString = probe.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' });
  const match = ptString.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : -8;
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = Math.abs(offsetHours);
  const offset = `${sign}${String(abs).padStart(2, '0')}:00`;
  const hhmm = time24.length >= 5 ? time24.slice(0, 5) : time24;
  return `${dateStr}T${hhmm}:00${offset}`;
}
