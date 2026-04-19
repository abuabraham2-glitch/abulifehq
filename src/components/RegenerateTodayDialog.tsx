import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const REGENERATE_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/regenerate-today';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function RegenerateTodayDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleRebuild = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s safety
      const res = await fetch(REGENERATE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Webhook failed');
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
      toast.success('New plan ready');
      onOpenChange(false);
    } catch {
      toast.error("Couldn't build a new plan. Try again or check Telegram for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AlertDialog open={open && !loading} onOpenChange={(o) => !loading && onOpenChange(o)}>
        <AlertDialogContent className="rounded-[18px] max-w-[340px]" style={{ backgroundColor: '#F5F0E8' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px]">Rebuild today's plan?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This will replace all current items and their calendar events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRebuild();
              }}
              className="rounded-xl min-h-[44px] text-white"
              style={{ backgroundColor: '#5C3D1E' }}
            >
              Rebuild
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading overlay */}
      {loading && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(245,240,232,0.92)' }}
        >
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Loader2 size={32} className="animate-spin" style={{ color: '#5C3D1E' }} />
            <div>
              <p className="text-[15px] font-medium text-foreground">Building your new plan...</p>
              <p className="text-[13px] text-muted-foreground mt-1">This can take 20–30 seconds</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
