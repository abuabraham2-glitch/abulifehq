import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useReadingQueue, getDomain, type ReadingQueueRow } from '@/hooks/useReadingQueue';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;
const UNDO_DELAY_MS = 5000;

export default function ReadingList() {
  const { data: rows = [], isLoading } = useReadingQueue();
  const qc = useQueryClient();

  // Local hide-set for rows pending deletion (so they disappear instantly on Delete tap).
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const visibleRows = rows.filter((r) => !hiddenIds.has(r.id));
  const activeCount = visibleRows.filter((r) => r.status !== 'failed').length;

  const requestDelete = (row: ReadingQueueRow) => {
    // Hide row locally
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(row.id);
      return next;
    });

    // Schedule actual DB delete in 5s
    const timeout = setTimeout(async () => {
      pendingDeletes.current.delete(row.id);
      await supabase.from('reading_queue').delete().eq('id', row.id);
      qc.invalidateQueries({ queryKey: ['reading_queue'] });
    }, UNDO_DELAY_MS);
    pendingDeletes.current.set(row.id, timeout);

    toast('Removed', {
      duration: UNDO_DELAY_MS,
      style: { background: '#5C3D1E', color: '#fff', border: 'none' },
      action: {
        label: 'Undo',
        onClick: () => {
          const t = pendingDeletes.current.get(row.id);
          if (t) {
            clearTimeout(t);
            pendingDeletes.current.delete(row.id);
          }
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        },
      },
      actionButtonStyle: { background: 'transparent', color: '#E8A84C' },
    });
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
    toast('Saved to Notes', {
      style: { background: '#5C3D1E', color: '#fff', border: 'none' },
    });
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

      {!isLoading && visibleRows.length === 0 && (
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
        {visibleRows.map((row) => {
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
              <SwipeWrapper key={row.id} onDelete={() => requestDelete(row)}>
                <div
                  className="bg-card rounded-2xl shadow-sm p-4 border-l-4 border-l-red-400"
                >
                  <p className="text-xs" style={{ color: '#8B7355' }}>{domain}</p>
                  <p className="font-medium text-sm mt-1 text-red-500">
                    Couldn't summarize this article
                  </p>
                  {row.error_message && (
                    <p className="text-xs text-gray-500 mt-1">{truncate(row.error_message, 80)}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 truncate">{truncate(row.url, 60)}</p>
                </div>
              </SwipeWrapper>
            );
          }

          // summarized
          return (
            <SwipeWrapper key={row.id} onDelete={() => requestDelete(row)}>
              <div className="bg-card rounded-2xl shadow-sm p-5">
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
                  <ul className="list-disc list-inside text-sm space-y-1" style={{ color: '#5C3D1E' }}>
                    {row.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs mt-3 mb-4 hover:underline"
                  style={{ color: '#8B7355' }}
                >
                  Read original
                  <ExternalLink size={12} />
                </a>
                <button
                  onClick={() => handleSaveToNotes(row)}
                  className="w-full rounded-xl py-3 text-white font-medium"
                  style={{ backgroundColor: '#B8906C' }}
                >
                  Save to Notes
                </button>
              </div>
            </SwipeWrapper>
          );
        })}
      </div>
    </div>
  );
}

// ============= Swipe-to-delete wrapper =============

function SwipeWrapper({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiping = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!swiping.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping.current = true;
      else return;
    }
    const base = revealed ? -SWIPE_REVEAL : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -SWIPE_REVEAL * 1.5) next = -SWIPE_REVEAL * 1.5;
    setTranslateX(next);
  };
  const onTouchEnd = () => {
    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-SWIPE_REVEAL);
      setRevealed(true);
    } else {
      setTranslateX(0);
      setRevealed(false);
    }
    startX.current = null;
    startY.current = null;
    swiping.current = false;
  };

  const handleRowClick = () => {
    if (revealed) {
      setTranslateX(0);
      setRevealed(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center text-white rounded-r-2xl"
        style={{ width: SWIPE_REVEAL, backgroundColor: '#C44' }}
        aria-label="Delete"
        tabIndex={revealed ? 0 : -1}
      >
        <Trash2 size={18} />
      </button>
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.18s ease-out',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleRowClick}
      >
        {children}
      </div>
    </div>
  );
}
