import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const NOTE_TYPES = [
  'General', 'Movies & Shows', 'Books & Articles', 'Idea', 'Places & Activities',
  'Memory', 'Reminder', 'People', 'Family', 'Wish List', 'Business', 'Finance',
  'Home Info', 'Health & Medical', 'Quotes', 'Exercise Log', 'Logins & Codes', 'Reference',
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AddNoteModal({ open, onOpenChange }: Props) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('General');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('notes').insert({ content: content.trim(), note_type: noteType });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note saved ✓' });
      setContent('');
      setNoteType('General');
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">New Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note..."
            rows={4}
            className="resize-none"
          />
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="w-full rounded-xl"
            style={{ backgroundColor: '#B8906C' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
