import React from 'react';

interface ParsedLine {
  type: 'time-block' | 'section-header' | 'text';
  time?: string;
  title?: string;
  duration?: string;
  raw: string;
}

function parsePlanText(text: string): ParsedLine[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  return lines.map((raw) => {
    const trimmed = raw.trim().replace(/^[-•*]\s*/, '');

    // Section headers: ALL CAPS lines or lines ending with ':'
    if (/^[A-Z][A-Z\s/()]{4,}:?$/.test(trimmed) || /^(DEFERRED|PERMANENT|NOTE|REMINDER|SUMMARY)/i.test(trimmed)) {
      return { type: 'section-header' as const, raw: trimmed.replace(/:$/, '') };
    }

    // Time block patterns: "9:00 AM - 10:00 AM: Task (30m)" or "9:00–10:00: Task"
    const timeMatch = trimmed.match(
      /^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–—to]+\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[:\-–—]\s*(.+)/
    );
    if (timeMatch) {
      const time = timeMatch[1].trim();
      let rest = timeMatch[2].trim();
      // Extract duration like (30m) or (1h) or (45 min)
      const durMatch = rest.match(/\((\d+\s*(?:m|min|mins|minutes|h|hr|hrs|hours)(?:\s*\d+\s*(?:m|min))?)\)\s*$/i);
      let duration: string | undefined;
      if (durMatch) {
        duration = durMatch[1];
        rest = rest.replace(durMatch[0], '').trim();
      }
      return { type: 'time-block' as const, time, title: rest, duration, raw };
    }

    // Simpler time pattern: "9:00 AM: Task"
    const simpleTime = trimmed.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[:\-–—]\s*(.+)/);
    if (simpleTime) {
      const time = simpleTime[1].trim();
      let rest = simpleTime[2].trim();
      const durMatch = rest.match(/\((\d+\s*(?:m|min|mins|minutes|h|hr|hrs|hours)(?:\s*\d+\s*(?:m|min))?)\)\s*$/i);
      let duration: string | undefined;
      if (durMatch) {
        duration = durMatch[1];
        rest = rest.replace(durMatch[0], '').trim();
      }
      return { type: 'time-block' as const, time, title: rest, duration, raw };
    }

    return { type: 'text' as const, raw: trimmed };
  });
}

interface PlanSummaryCardProps {
  summary: string;
  onDismiss: () => void;
}

export function PlanSummaryCard({ summary, onDismiss }: PlanSummaryCardProps) {
  const parsed = parsePlanText(summary);

  return (
    <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
      <p className="text-[13px] font-medium mb-3" style={{ color: '#B8906C' }}>📋 Today's plan</p>

      <div className="space-y-0">
        {parsed.map((line, i) => {
          if (line.type === 'section-header') {
            return (
              <div key={i} className={i > 0 ? 'pt-3 pb-1' : 'pb-1'}>
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {line.raw}
                </p>
              </div>
            );
          }

          if (line.type === 'time-block') {
            return (
              <React.Fragment key={i}>
                {i > 0 && parsed[i - 1]?.type !== 'section-header' && (
                  <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }} />
                )}
                <div className="flex items-baseline gap-3 py-2 min-h-[36px]">
                  <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap w-[110px] flex-shrink-0 tabular-nums">
                    {line.time}
                  </span>
                  <span className="text-[13px] text-foreground flex-1 min-w-0">{line.title}</span>
                  {line.duration && (
                    <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      {line.duration}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          }

          // Plain text fallback
          return (
            <React.Fragment key={i}>
              {i > 0 && parsed[i - 1]?.type !== 'section-header' && (
                <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }} />
              )}
              <p key={i} className="text-[13px] text-foreground py-2 leading-relaxed">{line.raw}</p>
            </React.Fragment>
          );
        })}
      </div>

      <div className="text-right mt-2">
        <button onClick={onDismiss} className="text-[13px] font-medium min-h-[44px] md:min-h-0" style={{ color: '#B8906C' }}>
          Got it, dismiss
        </button>
      </div>
    </div>
  );
}
