import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateTask } from '@/hooks/useTasks';
import { toast } from '@/hooks/use-toast';

interface BrainDumpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrainDumpModal({ open, onOpenChange }: BrainDumpModalProps) {
  const [text, setText] = useState('');
  const createTask = useCreateTask();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await createTask.mutateAsync({
        name: text.trim(),
        status: 'active',
        needs_triage: true,
        source: 'manual',
      });
      toast({ title: 'Task captured!', description: 'It will appear in your triage queue.' });
      setText('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save task.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Brain Dump</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || createTask.isPending}
            className="w-full"
          >
            {createTask.isPending ? 'Saving...' : 'Capture'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
