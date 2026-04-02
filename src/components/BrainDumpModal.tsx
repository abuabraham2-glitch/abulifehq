import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTask } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BrainDumpModal({ open, onOpenChange }: Props) {
  const [text, setText] = useState('');
  const createTask = useCreateTask();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      const task = await createTask.mutateAsync({
        name: text.trim(),
        status: 'active',
        needs_triage: true,
        source: 'manual',
      });
      await supabase.from('brain_dumps').insert({
        raw_text: text.trim(),
        source: 'manual',
        processed: false,
        task_id: task.id,
      });
      toast({ title: 'Brain dump captured ✓' });
      setText('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">What's on your mind?</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dump it here..."
          rows={6}
          className="resize-none min-h-[160px]"
        />
        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || createTask.isPending}
          className="w-full"
          style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}
        >
          {createTask.isPending ? 'Saving...' : 'Capture'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
