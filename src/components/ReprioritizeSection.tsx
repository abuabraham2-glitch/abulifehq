import { useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodayPlanItems, type PlanItem } from '@/hooks/useDailyPlan';

function SortableRow({ item, index }: { item: PlanItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: 'hsl(var(--secondary))',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg p-2.5 min-h-[44px]"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1 rounded text-muted-foreground hover:text-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <span className="text-[13px] font-semibold text-muted-foreground w-5 text-center flex-shrink-0">
        {index + 1}
      </span>
      <span className="flex-1 text-[14px] text-foreground truncate">{item.title}</span>
    </div>
  );
}

export function ReprioritizeSection() {
  const { data: items } = useTodayPlanItems();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const skipTitle = (t: string) => {
    const l = t.toLowerCase();
    return l.startsWith('buffer') || l === 'lunch break' || l.includes('victory hour') || l.startsWith('school pickup') || l.includes('wind down') || l.includes('morning routine');
  };
  const pendingTasks = (items ?? [])
    .filter((i) => !i.is_calendar_event && !skipTitle(i.title) && i.status !== 'completed' && i.status !== 'skipped')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [order, setOrder] = useState<string[] | null>(null);

  const toggle = () => {
    if (!open) {
      setOrder(pendingTasks.map((t) => t.id));
    }
    setOpen((v) => !v);
  };

  const orderedTasks = order
    ? order.map((id) => pendingTasks.find((t) => t.id === id)).filter(Boolean) as PlanItem[]
    : pendingTasks;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !order) return;
    const oldIndex = order.indexOf(active.id as string);
    const newIndex = order.indexOf(over.id as string);
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const handleReschedule = async () => {
    const names = orderedTasks.map((t) => t.title);
    setSending(true);
    try {
      await fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '8311812333',
          message: `Re-prioritize my tasks for today in this order: [${names.join(', ')}]`,
        }),
      });
      toast('Rescheduling your day...');
      setOpen(false);
    } catch {
      toast.error('Failed to send — try again');
    } finally {
      setSending(false);
    }
  };

  if (pendingTasks.length === 0) return null;

  return (
    <div className="rounded-[8px] bg-card" style={{ border: '1.5px solid #5C3D1E' }}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 p-4 min-h-[48px]"
      >
        <ArrowUpDown size={16} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left text-[14px] font-medium text-foreground">Re-prioritize today</span>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedTasks.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {orderedTasks.map((item, idx) => (
                <SortableRow key={item.id} item={item} index={idx} />
              ))}
            </SortableContext>
          </DndContext>

          <button
            onClick={handleReschedule}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
            style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
          >
            {sending && <Loader2 size={16} className="animate-spin" />}
            Reschedule based on this order
          </button>
        </div>
      )}
    </div>
  );
}
