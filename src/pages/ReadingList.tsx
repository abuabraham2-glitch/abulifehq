import { useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useReadingQueue, getDomain, type ReadingQueueRow } from '@/hooks/useReadingQueue';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function ReadingList() {
  const { data: rows = [], isLoading } = useReadingQueue();
  const qc = useQueryClient();

  const activeCount = rows.filter((r) => r.status !== 'failed').length;

  const handleDelete = async (id: string) => {
    await supabase.from('reading_queue').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['reading_queue'] });
  };

  const handleSaveToNotes = async (row: ReadingQueueRow) => {
    const title = row.title ?? getDomain(row.url);
    const bullets = (row.bullets ?? []).map((b) => `• ${b}`).join('\n');
    const content = [row.bottom_line, bullets].filter(Boolean).join('\n\n') + `\n\nSource: ${row.url}`;

    const { error } = await supabase.from('notes').insert({
      title,
      content,
      note_type: 'Books & Articles',
    });

    if (error) {
      toast.error('Could not save to Notes');
      return;
    }

    await supabase.from('reading_queue').delete().eq('id', row.id);
    qc.invalidateQueries({ queryKey: ['reading_queue'] });
    toast('Saved to Notes');
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-medium text-foreground">Reading List</h1>
        {activeCount > 0 && (
          <span
            className="text-[11px] font-medium rounded-full px-2 py-0.5"
            style={{ backgroundColor: '#5C3D1E', color: '#fff' }}
          >
            {activeCount}
          </span>
        )}
      </div>

      {!isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center text-center mt-20">
          <BookOpen size={48} style={{ color: '#8B7355', opacity: 0.6 }} />
          <p className="mt-4 text-lg font-bold" style={{ color: '#5C3D1E' }}>
            Nothing to read yet
          </p>
          <p className="mt-2 text-sm max-w-[280px]" style={{ color: '#8B7355' }}>
            Share an article from your browser to Life HQ and the summary will show up here automatically.
          </p>
        </div>
      )}

      <div>
        {rows.map((row) => {
          const domain = getDomain(row.url);

          if (row.status === 'queued' || row.status === 'summarizing') {
            return (
              <div key={row.id} className="bg-card rounded-2xl shadow-sm p-4 mb-3">
                <p className="text-xs" style={{ color: '#8B7355' }}>{domain}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: '#8B7355' }} />
                  <span className="italic text-sm" style={{ color: '#8B7355' }}>Summarizing...</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 truncate">{truncate(row.url, 60)}</p>
              </div>
            );
          }

          if (row.status === 'failed') {
            return (
              <div
                key={row.id}
                className="bg-card rounded-2xl shadow-sm p-4 mb-3 border-l-4 border-l-red-400"
              >
                <p className="text-xs" style={{ color: '#8B7355' }}>{domain}</p>
                <p className="font-medium text-sm mt-1 text-red-500">
                  Couldn't summarize this article
                </p>
                {row.error_message && (
                  <p className="text-xs text-gray-500 mt-1">{truncate(row.error_message, 80)}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 truncate">{truncate(row.url, 60)}</p>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-xs py-1 px-3 rounded-lg border"
                    style={{ borderColor: '#8B7355', color: '#8B7355' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          }

          // summarized
          return (
            <div key={row.id} className="bg-card rounded-2xl shadow-sm p-5 mb-3">
              <p className="text-xs lowercase" style={{ color: '#8B7355' }}>{domain}</p>
              {row.title && (
                <h2 className="font-bold text-lg mb-2 leading-snug" style={{ color: '#5C3D1E' }}>
                  {row.title}
                </h2>
              )}
              {row.bottom_line && (
                <p className="font-medium mb-3" style={{ color: '#5C3D1E' }}>
                  {row.bottom_line}
                </p>
              )}
              {row.bullets && row.bullets.length > 0 && (
                <ul className="list-disc list-inside text-sm space-y-1 mb-4" style={{ color: '#5C3D1E' }}>
                  {row.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => handleDelete(row.id)}
                  className="flex-1 rounded-xl py-3 text-white font-medium"
                  style={{ backgroundColor: '#B8906C' }}
                >
                  Done reading
                </button>
                <button
                  onClick={() => handleSaveToNotes(row)}
                  className="flex-1 rounded-xl py-3 font-medium border-2 bg-transparent"
                  style={{ borderColor: '#5C3D1E', color: '#5C3D1E' }}
                >
                  Save to Notes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
