import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTask, useCompleteTask, type Task } from '@/hooks/useTasks';
import { CATEGORIES, calcQuadrant } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function TaskEditModal({ task, open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [importance, setImportance] = useState('');
  const [urgency, setUrgency] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [notes, setNotes] = useState('');

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();

  useEffect(() => {
    if (task) {
      setName(task.name);
      setCategory(task.category || '');
      setImportance(task.importance || '');
      setUrgency(task.urgency || '');
      setEstMinutes(task.est_minutes?.toString() || '');
      setNotes(task.notes || '');
    }
  }, [task]);

  const quadrant = calcQuadrant(importance, urgency);

  const handleSave = async () => {
    if (!task) return;
    try {
      await updateTask.mutateAsync({
        id: task.id,
        name,
        category: category || null,
        importance: importance || null,
        urgency: urgency || null,
        quadrant,
        est_minutes: estMinutes ? parseInt(estMinutes) : null,
        notes: notes || null,
        needs_triage: false,
      });
      toast({ title: 'Task updated' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' });
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    await completeTask.mutateAsync(task.id);
    toast({ title: 'Task completed ✓' });
    onOpenChange(false);
  };

  const handleArchive = async () => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, status: 'archived' });
    toast({ title: 'Task archived' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Edit Task</DialogTitle>
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
            <Input
              type="number"
              placeholder="Est. minutes"
              value={estMinutes}
              onChange={(e) => setEstMinutes(e.target.value)}
            />
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
          {importance && urgency && (
            <p className="text-xs text-muted-foreground">Quadrant: <span className="font-medium text-foreground">{quadrant}</span></p>
          )}
          <Textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none" />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={updateTask.isPending} className="flex-1" style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}>
              Save
            </Button>
            {task?.status === 'active' && (
              <Button onClick={handleComplete} variant="outline" className="text-[#059669] border-[#059669]/30 hover:bg-[#059669]/5">
                Complete
              </Button>
            )}
            <Button onClick={handleArchive} variant="outline" className="text-muted-foreground">
              Archive
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
