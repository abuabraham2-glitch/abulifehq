import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Pencil, Trash2, Loader2, X, Plus } from 'lucide-react';
import { AddNoteModal } from '@/components/AddNoteModal';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const NOTE_TYPES = [
  'General', 'Movies & Shows', 'Books & Articles', 'Idea', 'Places & Activities',
  'Memory', 'Reminder', 'People', 'Family', 'Wish List', 'Business', 'Finance',
  'Home Info', 'Health & Medical', 'Quotes', 'Exercise Log', 'Logins & Codes', 'Reference', 'Recipes',
];

const FILTER_ORDER = [
  'All', 'Movies & Shows', 'Books & Articles', 'Idea', 'Places & Activities',
  'Memory', 'Reminder', 'People', 'Family', 'Wish List', 'Business', 'Finance',
  'Home Info', 'Health & Medical', 'Quotes', 'Exercise Log', 'Logins & Codes', 'Reference', 'Recipes', 'General',
];

const TYPE_COLORS: Record<string, string> = {
  'Movies & Shows': '#8B5CF6', 'Books & Articles': '#3B82F6', 'Idea': '#F59E0B',
  'Places & Activities': '#10B981', 'Memory': '#EC4899', 'Reminder': '#EF4444',
  'People': '#6366F1', 'Family': '#D946EF', 'Wish List': '#F97316', 'Business': '#0EA5E9',
  'Finance': '#14B8A6', 'Home Info': '#84CC16', 'Health & Medical': '#F43F5E',
  'Quotes': '#B8906C', 'Exercise Log': '#22C55E', 'Logins & Codes': '#64748B',
  'Reference': '#78716C', 'Recipes': '#E11D48', 'General': '#9CA3AF',
};

type Note = {
  id: string;
  content: string;
  note_type: string | null;
  ai_summary: string | null;
  image_url: string | null;
  reminder_date: string | null;
  tags: string[] | null;
  created_at: string | null;
};

// Utility: render text with clickable URLs
function renderLinkedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function Notes() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState('General');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<Note | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const filtered = filter === 'All' ? notes : notes.filter((n) => n.note_type === filter);

  const updateNote = useMutation({
    mutationFn: async ({ id, content, note_type }: { id: string; content: string; note_type: string }) => {
      const { error } = await supabase.from('notes').update({ content, note_type }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setEditNote(null);
      toast({ title: 'Note updated ✓' });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setDeleteId(null);
      toast({ title: 'Note deleted' });
    },
  });

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAskingAi(true);
    setAiAnswer('');
    try {
      const { data, error } = await supabase.functions.invoke('notes-ai', {
        body: { question: question.trim(), notes: notes.map((n) => ({ content: n.content, note_type: n.note_type })) },
      });
      if (error) throw error;
      setAiAnswer(data.answer || 'No answer found.');
    } catch {
      toast({ title: 'Error', description: 'Failed to query AI.', variant: 'destructive' });
    } finally {
      setAskingAi(false);
    }
  };

  const openEdit = (note: Note) => {
    setEditContent(note.content);
    setEditType(note.note_type || 'General');
    setEditNote(note);
  };

  const handleCardClick = (note: Note, e: React.MouseEvent) => {
    // Don't expand if clicking edit/delete buttons
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]')) return;
    setExpandedNote(note);
  };

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-[22px] md:text-[28px] font-medium text-foreground">Notes</h1>

      {/* Ask My Notes */}
      <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
        <p className="text-[13px] font-medium mb-2" style={{ color: '#B8906C' }}>🔍 Ask My Notes</p>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Search your notes with AI..."
            className="flex-1 px-3 py-2.5 rounded-xl text-[14px] min-h-[44px] bg-background"
            style={{ border: '1px solid #D4C5B0' }}
          />
          <button
            onClick={handleAsk}
            disabled={askingAi || !question.trim()}
            className="px-4 rounded-xl min-h-[44px] flex items-center justify-center"
            style={{ backgroundColor: '#B8906C', color: '#fff' }}
          >
            {askingAi ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        {aiAnswer && (
          <div className="mt-3 rounded-xl bg-secondary p-3">
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {FILTER_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium min-h-[32px] transition-colors"
            style={
              filter === t
                ? { backgroundColor: '#B8906C', color: '#fff' }
                : { backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid #B8906C' }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-[13px]">Loading notes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-[13px]">No notes found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <div
              key={note.id}
              className="rounded-[14px] bg-card p-4 cursor-pointer hover:ring-1 hover:ring-border transition-shadow"
              style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
              onClick={(e) => handleCardClick(note, e)}
            >
              {note.image_url && (
                <img
                  src={note.image_url}
                  alt="Note attachment"
                  className="w-full max-h-[180px] object-cover rounded-xl mb-2"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] text-foreground leading-relaxed flex-1 whitespace-pre-wrap line-clamp-4">
                  {renderLinkedText(note.content)}
                </p>
                <div className="flex gap-1 flex-shrink-0">
                  <button data-action="edit" onClick={() => openEdit(note)} className="p-2 min-w-[36px] min-h-[36px] rounded-lg hover:bg-secondary">
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>
                  <button data-action="delete" onClick={() => setDeleteId(note.id)} className="p-2 min-w-[36px] min-h-[36px] rounded-lg hover:bg-secondary">
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: TYPE_COLORS[note.note_type || 'General'] || '#9CA3AF' }}
                >
                  {note.note_type || 'General'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {note.created_at ? new Date(note.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Note Modal */}
      <Dialog open={!!expandedNote} onOpenChange={(o) => !o && setExpandedNote(null)}>
        <DialogContent className="sm:max-w-lg rounded-[18px] max-h-[85vh] overflow-y-auto">
          {expandedNote && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: TYPE_COLORS[expandedNote.note_type || 'General'] || '#9CA3AF' }}
                  >
                    {expandedNote.note_type || 'General'}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {expandedNote.created_at ? new Date(expandedNote.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {expandedNote.image_url && (
                  <img
                    src={expandedNote.image_url}
                    alt="Note attachment"
                    className="w-full max-h-[240px] object-cover rounded-xl"
                  />
                )}
                <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {renderLinkedText(expandedNote.content)}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editNote} onOpenChange={(o) => !o && setEditNote(null)}>
        <DialogContent className="max-w-[400px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <Select value={editType} onValueChange={setEditType}>
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
              onClick={() => editNote && updateNote.mutate({ id: editNote.id, content: editContent, note_type: editType })}
              disabled={updateNote.isPending || !editContent.trim()}
              className="w-full rounded-xl"
              style={{ backgroundColor: '#B8906C' }}
            >
              {updateNote.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteNote.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
