import { useState, useEffect, useCallback, useRef } from 'react';
import { getCategoryColor } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

interface FocusTimerProps {
  estMinutes: number;
  category?: string | null;
  onElapsedChange?: (minutes: number) => void;
}

export function FocusTimer({ estMinutes, category, onElapsedChange }: FocusTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(estMinutes * 60);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmPlayedRef = useRef(false);

  // Reset when estMinutes changes (new task)
  useEffect(() => {
    setSecondsLeft(estMinutes * 60);
    setRunning(false);
    setStarted(false);
    alarmPlayedRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [estMinutes]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Alarm when reaching 0
  useEffect(() => {
    if (secondsLeft === 0 && started && !alarmPlayedRef.current) {
      alarmPlayedRef.current = true;
      playAlarm();
      toast({ title: "⏰ Time's up!", description: "Your focus session is complete." });
    }
  }, [secondsLeft, started]);

  const handleTap = useCallback(() => {
    if (!started) {
      setStarted(true);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  }, [started]);

  const totalSeconds = estMinutes * 60;
  const elapsed = totalSeconds - secondsLeft;
  const elapsedMinutes = Math.ceil(elapsed / 60);
  const progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;

  // Report elapsed minutes to parent
  useEffect(() => {
    onElapsedChange?.(elapsedMinutes);
  }, [elapsedMinutes, onElapsedChange]);
  const circumference = 2 * Math.PI * 52;
  const displayMinutes = Math.ceil(secondsLeft / 60);
  const color = getCategoryColor(category);

  const label = !started
    ? 'Tap to start'
    : running
    ? 'min left'
    : secondsLeft === 0
    ? 'Done!'
    : 'Paused';

  return (
    <button
      onClick={handleTap}
      className="relative w-[120px] h-[120px] mx-auto mb-6 cursor-pointer focus:outline-none"
      aria-label={!started ? 'Start timer' : running ? 'Pause timer' : 'Resume timer'}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(progress / 100) * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-medium text-foreground">{displayMinutes}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    </button>
  );
}

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const endTime = ctx.currentTime + 5;
    let t = ctx.currentTime;
    while (t < endTime) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 800;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
      t += 0.3;
    }
  } catch {
    // Web Audio not supported
  }
}
