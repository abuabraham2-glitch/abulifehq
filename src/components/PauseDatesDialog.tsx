import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { todayStr } from '@/hooks/useDailyPlan';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function PauseDatesDialog({ open, onOpenChange, onSaved }: Props) {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFrom(today);
    setTo(today);
    setErr(null);
  };

  const handleSave = async () => {
    setErr(null);
    if (!from || !to) {
      setErr('Pick both dates.');
      return;
    }
    if (to < from) {
      setErr('"To" must be the same as or after "From".');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pauses').insert({ start_date: from, end_date: to } as any);
    setSaving(false);
    if (error) {
      console.warn('[pause-dates] insert failed', error);
      toast.error("Couldn't save pause.");
      return;
    }
    toast.success('Paused');
    onSaved?.();
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-[340px] rounded-[18px]" style={{ backgroundColor: '#F5F0E8' }}>
        <DialogHeader>
          <DialogTitle className="text-[16px]">Pause dates</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {err && <p className="text-[12px] text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl min-h-[44px]" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl min-h-[44px] text-white"
            style={{ backgroundColor: '#B8906C' }}
          >
            {saving ? 'Saving…' : 'Pause'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
