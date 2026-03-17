import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLatestLifeContext, useCreateLifeContext } from '@/hooks/useLifeContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function LifeContextModal({ open, onOpenChange }: Props) {
  const [text, setText] = useState('');
  const { data: latest } = useLatestLifeContext();
  const create = useCreateLifeContext();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await create.mutateAsync(text.trim());
      toast({ title: 'Life context updated ✓' });
      setText('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">What's going on in your life right now?</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Heat wave this week, worried about electricity bill..."
          rows={4}
          className="resize-none"
        />
        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || create.isPending}
          className="w-full"
          style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}
        >
          {create.isPending ? 'Saving...' : 'Save context'}
        </Button>
        {latest && (
          <div className="text-xs text-muted-foreground mt-2 p-3 rounded-xl bg-secondary">
            <span className="font-medium">Last update:</span> {latest.context_text}
            <span className="block mt-1 opacity-70">
              {new Date(latest.created_at!).toLocaleDateString()}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
