import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen, ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useReadingQueue, getDomain, type ReadingQueueRow } from '@/hooks/useReadingQueue';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const COMMIT_RATIO = 0.4;
const COMMIT_VELOCITY = 0.5; // px/ms
const UNDO_DELAY_MS = 5000;

export default function ReadingList() {
  const { data: rows = [], isLoading } = useReadingQueue();
  const qc = useQueryClient();

  const [locallyDeleted, setLocallyDeleted] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // On unmount, fire any still-pending deletes immediately so they aren't lost.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach((timeoutId, rowId) => {
        clearTimeout(timeoutId);
        supabase.from('reading_queue').delete().eq('id', rowId).then(() => {});
      });
      pending.clear();
    };
  }, []);

  const triggerDelete = (row: ReadingQueueRow) => {
    setLocallyDeleted((prev) => {
      const next = new Set(prev);
      next.add(row.id);
      return next;
    });

    const timeoutId = setTimeout(async () => {
      pendingDeletes.current.delete(row.id);
      await supabase.from('reading_queue').delete().eq('id', row.id);
      qc.invalidateQueries({ queryKey: ['reading_queue'] });
    }, UNDO_DELAY_MS);
    pendingDeletes.current.set(row.id, timeoutId);

    toast('Removed', {
      duration: UNDO_DELAY_MS,
      style: { background: '#5C3D1E', color: '#fff', border: 'none' },
      actionButtonStyle: { background: 'transparent', color: '#E8A84C' },
      action: {
        label: 'Undo',
        onClick: () => {
          const t = pendingDeletes.current.get(row.id);
          if (t) {
            clearTimeout(t);
            pendingDeletes.current.delete(row.id);
          }
          setLocallyDeleted((prev) => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        },
      },
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

  const visibleRows = rows.filter((r) => !locallyDeleted.has(r.id));
  const activeCount = visibleRows.filter((r) => r.status !== 'failed').length;

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
        {visibleRows.map((row) => (
          <SwipeRow key={row.id} onCommitDelete={() => triggerDelete(row)}>
            {row.status === 'queued' || row.status === 'summarizing' ? (
              <InProgressCard row={row} onDelete={() => triggerDelete(row)} />
            ) : row.status === 'failed' ? (
              <FailedCard row={row} onDelete={() => triggerDelete(row)} />
            ) : (
              <SummarizedCard
                row={row}
                onDelete={() => triggerDelete(row)}
                onSaveToNotes={() => handleSaveToNotes(row)}
              />
            )}
          </SwipeRow>
        ))}
      </div>
    </div>
  );
}

// ============= Card components =============

function DeleteX({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[#8B7355]/10 transition-colors"
      style={{ color: '#8B7355' }}
      aria-label="Delete"
    >
      <X size={16} />
    </button>
  );
}

function InProgressCard({ row, onDelete }: { row: ReadingQueueRow; onDelete: () => void }) {
  const domain = getDomain(row.url);
  return (
    <div className="relative bg-card rounded-2xl shadow-sm p-4 pr-10">
      <DeleteX onClick={onDelete} />
      <p className="text-xs" style={{ color: '#8B7355' }}>{domain}</p>
      <div className="flex items-center gap-2 mt-2">
        <Loader2 size={16} className="animate-spin" style={{ color: '#8B7355' }} />
        <span className="italic text-sm" style={{ color: '#8B7355' }}>Summarizing...</span>
      </div>
      <p className="text-xs text-gray-400 mt-2 truncate">{truncate(row.url, 60)}</p>
    </div>
  );
}

function FailedCard({ row, onDelete }: { row: ReadingQueueRow; onDelete: () => void }) {
  const domain = getDomain(row.url);
  return (
    <div className="relative bg-card rounded-2xl shadow-sm p-4 pr-10 border-l-4 border-l-red-400">
      <DeleteX onClick={onDelete} />
      <p className="text-xs" style={{ color: '#8B7355' }}>{domain}</p>
      <p className="font-medium text-sm mt-1 text-red-500">Couldn't summarize this article</p>
      {row.error_message && (
        <p className="text-xs text-gray-500 mt-1">{truncate(row.error_message, 80)}</p>
      )}
      <p className="text-xs text-gray-400 mt-1 truncate">{truncate(row.url, 60)}</p>
    </div>
  );
}

function SummarizedCard({
  row,
  onDelete,
  onSaveToNotes,
}: {
  row: ReadingQueueRow;
  onDelete: () => void;
  onSaveToNotes: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const domain = getDomain(row.url);

  return (
    <div className={`relative bg-card rounded-2xl shadow-sm ${expanded ? 'p-5' : 'p-4'} pr-10 transition-[padding] duration-200`}>
      <DeleteX onClick={onDelete} />
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-start justify-between gap-3"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs lowercase" style={{ color: '#8B7355' }}>{domain}</p>
          {row.title && (
            <h2 className="font-bold text-lg leading-snug mt-1" style={{ color: '#5C3D1E' }}>
              {row.title}
            </h2>
          )}
        </div>
        <span className="shrink-0 mt-1" style={{ color: '#8B7355' }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {expanded && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
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
            onClick={onSaveToNotes}
            className="w-full rounded-xl py-3 text-white font-medium"
            style={{ backgroundColor: '#B8906C' }}
          >
            Save to Notes
          </button>
        </div>
      )}
    </div>
  );
}

// ============= Instant swipe-to-delete wrapper =============

function SwipeRow({
  children,
  onCommitDelete,
}: {
  children: React.ReactNode;
  onCommitDelete: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [committed, setCommitted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const lastX = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const swiping = useRef(false);
  const widthRef = useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (committed) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    lastX.current = e.touches[0].clientX;
    lastTime.current = Date.now();
    swiping.current = false;
    widthRef.current = containerRef.current?.offsetWidth ?? 0;
    setAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - startX.current;
    const dy = y - startY.current;
    if (!swiping.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping.current = true;
      else return;
    }
    lastX.current = x;
    lastTime.current = Date.now();
    let next = dx;
    if (next > 0) next = 0;
    setTranslateX(next);
  };

  const onTouchEnd = () => {
    if (startX.current === null) return;
    const dx = lastX.current - startX.current;
    const dt = Math.max(1, lastTime.current - startTime.current);
    const velocity = Math.abs(dx) / dt; // px/ms (negative dx for left)
    const width = widthRef.current || 1;
    const ratio = Math.abs(dx) / width;

    const commit = dx < 0 && (ratio >= COMMIT_RATIO || (velocity > COMMIT_VELOCITY && dx < 0));

    setAnimating(true);
    if (commit) {
      setCommitted(true);
      setTranslateX(-width);
      // Trigger deferred-delete logic immediately on release
      window.setTimeout(() => onCommitDelete(), 250);
    } else {
      setTranslateX(0);
    }
    startX.current = null;
    startY.current = null;
    swiping.current = false;
  };

  const opacity = (() => {
    const w = widthRef.current || 1;
    const ratio = Math.min(1, Math.abs(translateX) / w);
    return 1 - ratio * 0.4;
  })();

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl mb-3"
      style={{
        background: translateX < 0 ? 'rgba(196, 68, 68, 0.08)' : 'transparent',
        borderRadius: '1rem',
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: animating ? 'transform 250ms ease-out, opacity 250ms ease-out' : 'none',
          opacity,
          willChange: 'transform',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
