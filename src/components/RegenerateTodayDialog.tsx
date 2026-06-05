import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const REGENERATE_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-regenerate-today';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  keepTasksOnly?: boolean;
}

export function RegenerateTodayDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleRebuild = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(REGENERATE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      await qc.invalidateQueries({ queryKey: ['daily-plan'] });
      await qc.invalidateQueries({ queryKey: ['plan-items'] });
      toast.success("Today's plan rebuilt");
      onOpenChange(false);
    } catch (err) {
      console.warn('[regenerate-today] error:', err);
      toast.error("Couldn't rebuild plan. Check Telegram or try again.");
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
              Claude will refit your remaining tasks around the current time. Completed, skipped, in-progress, and locked calendar items stay exactly where they are. This takes about 30 seconds.
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
              style={{ backgroundColor: '#B8906C' }}
            >
              Rebuild
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(245,240,232,0.92)' }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Loader2 size={32} className="animate-spin" style={{ color: '#5C3D1E' }} />
            <div>
              <p className="text-[15px] font-medium text-foreground">Rebuilding today's plan...</p>
              <p className="text-[13px] text-muted-foreground mt-1">This takes about 30 seconds. Hang tight.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
