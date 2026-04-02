import { useState } from 'react';

interface FocusTimerProps {
  onStart?: () => void;
}

export function FocusTimer({ onStart }: FocusTimerProps) {
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const handleStart = () => {
    const now = new Date();
    setStartedAt(now);
    onStart?.();
  };

  if (startedAt) {
    const timeStr = startedAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return (
      <p className="text-[13px] text-muted-foreground mb-5 text-center">
        Started at {timeStr}
      </p>
    );
  }

  return (
    <button
      onClick={handleStart}
      className="mx-auto mb-5 px-6 py-3 rounded-xl text-[14px] font-medium flex items-center gap-2 min-h-[48px] w-full md:w-auto"
      style={{ backgroundColor: 'hsl(var(--secondary))' }}
    >
      ▶ Start
    </button>
  );
}
