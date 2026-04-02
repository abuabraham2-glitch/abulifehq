import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
  const [categorizing, setCategorizing] = useState(false);
  const [categorized, setCategorized] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!content.trim()) return;

    // If not yet categorized, run AI categorization first
    if (!categorized) {
      setCategorizing(true);
      try {
        const { data, error } = await supabase.functions.invoke('categorize-note', {
          body: { content: content.trim() },
        });
        if (error) throw error;
        const aiType = data?.note_type;
        if (aiType && NOTE_TYPES.includes(aiType)) {
          setNoteType(aiType);
        }
        setCategorized(true);
        toast({ title: `AI suggested: ${aiType || 'General'}`, description: 'Review the category and tap Save again to confirm.' });
      } catch {
        toast({ title: 'AI categorization failed', description: 'Defaulting to your selection. Tap Save again to confirm.', variant: 'destructive' });
        setCategorized(true);
      } finally {
        setCategorizing(false);
      }
      return;
    }

    // Second tap: actually save
    setSaving(true);
    try {
      const { error } = await supabase.from('notes').insert({ content: content.trim(), note_type: noteType });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note saved ✓' });
      resetAndClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setContent('');
    setNoteType('General');
    setCategorized(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">New Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setCategorized(false); }}
            placeholder="Write your note..."
            rows={4}
            className="resize-none"
            disabled={categorizing}
          />
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categorized && (
            <p className="text-xs text-muted-foreground">
              AI suggested <span className="font-semibold text-foreground">{noteType}</span> — change above if needed, then tap Save to confirm.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!content.trim() || saving || categorizing}
            className="w-full rounded-xl"
            style={{ backgroundColor: '#B8906C' }}
          >
            {categorizing ? (
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Categorizing…</span>
            ) : saving ? 'Saving...' : categorized ? 'Save' : 'Categorize & Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
