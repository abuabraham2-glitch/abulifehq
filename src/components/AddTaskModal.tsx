import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTask } from '@/hooks/useTasks';
import { CATEGORIES, calcQuadrant } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AddTaskModal({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [importance, setImportance] = useState('');
  const [urgency, setUrgency] = useState('');
  const [estMinutes, setEstMinutes] = useState('');

  const createTask = useCreateTask();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await createTask.mutateAsync({
        name: name.trim(),
        category: category || null,
        importance: importance || null,
        urgency: urgency || null,
        quadrant: importance && urgency ? calcQuadrant(importance, urgency) : null,
        est_minutes: estMinutes ? parseInt(estMinutes) : null,
        status: 'active',
        source: 'manual',
        needs_triage: false,
      });
      toast({ title: 'Task created ✓' });
      setName(''); setCategory(''); setImportance(''); setUrgency(''); setEstMinutes('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Est. minutes" value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={importance} onValueChange={setImportance}>
              <SelectTrigger><SelectValue placeholder="Importance" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Important">Important</SelectItem>
                <SelectItem value="Not Important">Not Important</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Urgent">Urgent</SelectItem>
                <SelectItem value="Not Urgent">Not Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} disabled={!name.trim() || createTask.isPending} className="w-full" style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}>
            {createTask.isPending ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
