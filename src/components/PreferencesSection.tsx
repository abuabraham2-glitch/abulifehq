import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PreferencesSection() {
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const queryClient = useQueryClient();

  const { data: prefs = [] } = useQuery({
    queryKey: ['preferences-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('preferences').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences-active'] }),
  });

  const addPref = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('preferences').insert({ preference_text: text, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences-active'] });
      setNewText('');
    },
    onError: () => toast.error('Failed to add'),
  });

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    addPref.mutate(trimmed);
  };

  return (
    <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 min-h-[48px]"
      >
        <span className="text-[13px] font-medium text-foreground">Rules &amp; preferences</span>
        <ChevronRight
          size={16}
          className="text-muted-foreground transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {prefs.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No active rules yet.</p>
          )}
          {prefs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 min-h-[40px]">
              <span className="text-[13px] text-foreground flex-1 min-w-0 break-words">{p.preference_text}</span>
              <button
                onClick={() => deactivate.mutate(p.id)}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add a rule or temporary note..."
              className="flex-1 text-[13px] px-3 py-2 rounded-lg border bg-background min-h-[40px]"
              style={{ borderColor: 'hsl(var(--border))' }}
            />
            <button
              onClick={handleAdd}
              disabled={addPref.isPending}
              className="px-4 py-2 rounded-lg text-[13px] font-medium min-h-[40px]"
              style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
