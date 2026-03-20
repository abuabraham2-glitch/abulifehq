import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface SkipReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onSkipWithReason: (reason: string) => void;
  onSkipWithoutReason: () => void;
}

export function SkipReasonModal({
  open,
  onOpenChange,
  taskTitle,
  onSkipWithReason,
  onSkipWithoutReason,
}: SkipReasonModalProps) {
  const [reason, setReason] = useState('');

  const handleSkipWithReason = () => {
    if (reason.trim()) {
      onSkipWithReason(reason.trim());
    }
    setReason('');
  };

  const handleSkipWithout = () => {
    onSkipWithoutReason();
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium">Why are you skipping this?</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {taskTitle}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="too hot, got a call, not feeling it..."
          className="min-h-[80px] text-[14px] rounded-xl resize-none"
        />
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleSkipWithout}
            className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium min-h-[44px] md:min-h-0"
            style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}
          >
            Skip without reason
          </button>
          <button
            onClick={handleSkipWithReason}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium min-h-[44px] md:min-h-0 disabled:opacity-40"
            style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
          >
            Skip
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
