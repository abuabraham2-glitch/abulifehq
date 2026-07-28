import { useState, useMemo } from "react";
import { Plus, Search, Trash2, GripVertical, Archive, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTasks, usePurgeArchivedTasks, useUpdateTask, useArchiveTasks, type Task } from "@/hooks/useTasks";
import { useTodayPlan, useTodayPlanItems } from "@/hooks/useDailyPlan";
import { findNextSlot } from "@/lib/planScheduling";
import { TaskEditModal } from "@/components/TaskEditModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { CATEGORIES, getCategoryColor, getQuadrantColor } from "@/lib/constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// One-tap "add this task to today's schedule" control.
// Three visual states:
//   "idle" -> brown "+ Today" pill, tappable
//   "busy" -> same pill, dimmed and disabled while the insert is in flight
//   "on"   -> green "On today" chip, NOT a button (prevents duplicate plan_items
//             for the same task, which nothing else in the app guards against)
type AddTodayState = "idle" | "busy" | "on";

function AddTodayButton({ state, onClick }: { state: AddTodayState; onClick: () => void }) {
  if (state === "on") {
    return (
      <span
        className="flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: "#E1F5EE", color: "#0F6E56" }}
      >
        <Check size={14} />
        On today
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={state === "busy"}
      aria-label="Add to today's schedule"
      className="flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full flex-shrink-0 min-h-[36px] disabled:opacity-50"
      style={{ backgroundColor: "#5C3D1E", color: "#F5F0E8" }}
    >
      <Plus size={14} />
      Today
    </button>
  );
}

function SortableTaskRow({
  task,
  onClick,
  addState,
  onAddToday,
}: {
  task: Task;
  onClick: () => void;
  addState: AddTodayState | null;
  onAddToday: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    border: "0.5px solid rgba(0,0,0,0.04)",
    borderLeftWidth: "4px",
    borderLeftColor: getCategoryColor(task.category),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full flex items-center gap-3 bg-card rounded-r-[14px] rounded-l-none p-4 md:p-5 text-left transition-colors min-h-[56px]"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1 rounded text-muted-foreground hover:text-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-[15px] md:text-base font-medium text-foreground">{task.name || "Untitled task"}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {task.category && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${getCategoryColor(task.category)}15`,
                color: getCategoryColor(task.category),
              }}
            >
              {task.category}
            </span>
          )}
          {task.quadrant && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${getQuadrantColor(task.quadrant)}15`,
                color: getQuadrantColor(task.quadrant),
              }}
            >
              {task.quadrant}
            </span>
          )}
        </div>
      </button>
      {task.est_minutes && <span className="text-[13px] text-muted-foreground flex-shrink-0">{task.est_minutes}m</span>}
      {addState && <AddTodayButton state={addState} onClick={onAddToday} />}
    </div>
  );
}

export default function Tasks() {
  const [category, setCategory] = useState("All");
  const [quadrant, setQuadrant] = useState("All");
  const [status, setStatus] = useState("Active");
  const [search, setSearch] = useState("");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useTasks({ category, quadrant, status, search });
  const purgeArchived = usePurgeArchivedTasks();
  const updateTask = useUpdateTask();
  const archiveTasks = useArchiveTasks();

  // Today's plan - needed so the button can (a) insert into the right plan and
  // (b) know which tasks are already on today so it can show "On today" instead.
  const { data: todayPlan } = useTodayPlan();
  const { data: todayPlanItems } = useTodayPlanItems();
  const qc = useQueryClient();

  // Task ids already sitting on today's plan.
  // Deliberately EXCLUDES carried_over / skipped / deferred: those mean the user
  // removed, skipped, or pushed the item, so re-adding it today must stay possible.
  const todayTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of todayPlanItems ?? []) {
      const s = item.status ?? "pending";
      if (!item.task_id) continue;
      if (s === "carried_over" || s === "skipped" || s === "deferred") continue;
      ids.add(item.task_id);
    }
    return ids;
  }, [todayPlanItems]);

  // Same insert AddToTodayModal performs - plan_items row carrying task_id, so the
  // row has a real anchor (a plan_item with a NULL task_id has no task to survive on).
  const handleAddToToday = async (task: Task) => {
    if (todayTaskIds.has(task.id) || addingId) return;
    if (!todayPlan?.id) {
      toast.error("Today's plan isn't loaded yet. Open the home screen first, then try again.");
      return;
    }

    setAddingId(task.id);
    try {
      const estMinutes = task.est_minutes ?? 30;
      const slot = findNextSlot(todayPlanItems ?? [], estMinutes);
      const maxSort = Math.max(0, ...(todayPlanItems ?? []).map((i) => i.sort_order ?? 0));

      const { data: inserted, error } = await supabase
        .from("plan_items")
        .insert({
          plan_id: todayPlan.id,
          task_id: task.id,
          title: task.name,
          category: task.category ?? "Personal",
          start_time: slot.start,
          end_time: slot.end,
          est_minutes: estMinutes,
          status: "pending",
          is_calendar_event: false,
          is_external: false,
          sort_order: maxSort + 1,
          local_only: false,
        })
        .select()
        .single();

      if (error || !inserted) throw error ?? new Error("Insert failed");

      qc.invalidateQueries({ queryKey: ["daily-plan"] });

      toast(`Added to today: ${task.name}`, {
        duration: 5000,
        style: { background: "#5C3D1E", color: "#F5F0E8", border: "none" },
        action: {
          label: "Undo",
          onClick: async () => {
            // Reverse cleanly: delete the exact row we just created. Nothing else is touched.
            await supabase.from("plan_items").delete().eq("id", inserted.id);
            qc.invalidateQueries({ queryKey: ["daily-plan"] });
          },
        },
      });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't add that to today.");
    } finally {
      setAddingId(null);
    }
  };

  // The button only makes sense for a live task, and would be noise while bulk-selecting.
  const addStateFor = (task: Task): AddTodayState | null => {
    if (selectMode) return null;
    if (task.status !== "active") return null;
    if (todayTaskIds.has(task.id)) return "on";
    if (addingId === task.id) return "busy";
    return "idle";
  };

  // When viewing a specific quadrant, sort by priority_order
  const isDraggable = quadrant !== "All" && status === "Active" && !search;

  // Selection (bulk archive) only on the Completed view.
  const isSelectable = status === "Completed";

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    if (!isDraggable) return tasks;
    return [...tasks].sort((a, b) => (a.priority_order ?? 9999) - (b.priority_order ?? 9999));
  }, [tasks, isDraggable]);

  const allSelected = selectMode && sortedTasks.length > 0 && selectedIds.size === sortedTasks.length;

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTasks.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleArchiveSelected = () => {
    archiveTasks.mutate(Array.from(selectedIds), {
      onSuccess: () => exitSelectMode(),
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sortedTasks.length) return;

    const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
    const newIndex = sortedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedTasks, oldIndex, newIndex);
    // Save priority_order for each
    reordered.forEach((task, idx) => {
      if (task.priority_order !== idx) {
        updateTask.mutate({ id: task.id, priority_order: idx });
      }
    });
  };

  const handlePurge = () => {
    purgeArchived.mutate(undefined, {
      onSuccess: () => setPurgeOpen(false),
    });
  };

  return (
    <div className="space-y-4 md:space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] md:text-[26px] font-medium text-foreground">Tasks</h1>
          {!isLoading && sortedTasks.length > 0 && (
            <span
              className="text-[13px] font-medium px-3 py-1 rounded-full"
              style={{ backgroundColor: "#5C3D1E", color: "#F5F0E8" }}
            >
              {sortedTasks.length} {sortedTasks.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSelectable && !selectMode && sortedTasks.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
              Select
            </Button>
          )}
          {isSelectable && selectMode && (
            <>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || archiveTasks.isPending}
                onClick={handleArchiveSelected}
              >
                <Archive size={14} className="mr-1" />
                {archiveTasks.isPending ? "Archiving..." : `Archive (${selectedIds.size})`}
              </Button>
            </>
          )}
          {status === "Archived" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setPurgeOpen(true)}
            >
              <Trash2 size={14} className="mr-1" />
              Purge All
            </Button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="hidden md:flex w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "hsl(var(--foreground))" }}
          >
            <Plus size={18} style={{ color: "hsl(var(--background))" }} />
          </button>
        </div>
      </div>

      {/* Select-all bar (Completed view, in select mode) */}
      {isSelectable && selectMode && sortedTasks.length > 0 && (
        <button
          onClick={toggleSelectAll}
          className="w-full flex items-center gap-3 bg-card rounded-xl p-3 text-left"
          style={{ border: "0.5px solid rgba(0,0,0,0.04)" }}
        >
          <Checkbox checked={allSelected} className="pointer-events-none" />
          <span className="text-[14px] font-medium text-foreground">{allSelected ? "Deselect all" : "Select all"}</span>
          <span className="text-[13px] text-muted-foreground ml-auto">{selectedIds.size} selected</span>
        </button>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card rounded-xl border-border min-h-[44px] text-[15px] md:text-sm md:min-h-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1 min-w-[120px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={quadrant} onValueChange={setQuadrant}>
            <SelectTrigger className="flex-1 min-w-[120px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Quadrants</SelectItem>
              <SelectItem value="Do Now">Do Now</SelectItem>
              <SelectItem value="Schedule">Schedule</SelectItem>
              <SelectItem value="Delegate">Delegate</SelectItem>
              <SelectItem value="Delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              exitSelectMode();
              setStatus(v);
            }}
          >
            <SelectTrigger className="min-w-[90px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[14px]" />
          ))}
        </div>
      ) : !sortedTasks?.length ? (
        <div className="rounded-[14px] bg-card p-8 text-center" style={{ border: "0.5px solid rgba(0,0,0,0.04)" }}>
          <p className="text-[14px] text-muted-foreground">No tasks found</p>
        </div>
      ) : isDraggable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedTasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  onClick={() => setEditTask(task)}
                  addState={addStateFor(task)}
                  onAddToday={() => handleAddToToday(task)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => {
            const checked = selectedIds.has(task.id);
            const addState = addStateFor(task);
            return (
              <div
                key={task.id}
                className="w-full flex items-center gap-3 bg-card rounded-r-[14px] rounded-l-none p-4 md:p-5 min-h-[56px]"
                style={{
                  border: "0.5px solid rgba(0,0,0,0.04)",
                  borderLeftWidth: "4px",
                  borderLeftColor: getCategoryColor(task.category),
                }}
              >
                <button
                  onClick={() => (selectMode ? toggleOne(task.id) : setEditTask(task))}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left transition-colors active:opacity-80 md:hover:opacity-90"
                >
                  {selectMode && <Checkbox checked={checked} className="pointer-events-none flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] md:text-base font-medium text-foreground">
                      {task.name || "Untitled task"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {task.category && (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${getCategoryColor(task.category)}15`,
                            color: getCategoryColor(task.category),
                          }}
                        >
                          {task.category}
                        </span>
                      )}
                      {task.quadrant && (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${getQuadrantColor(task.quadrant)}15`,
                            color: getQuadrantColor(task.quadrant),
                          }}
                        >
                          {task.quadrant}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {task.est_minutes && (
                  <span className="text-[13px] text-muted-foreground flex-shrink-0">{task.est_minutes}m</span>
                )}
                {addState && <AddTodayButton state={addState} onClick={() => handleAddToToday(task)} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="md:hidden fixed bottom-[76px] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: "hsl(var(--foreground))" }}
      >
        <Plus size={24} style={{ color: "hsl(var(--background))" }} />
      </button>

      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
      <AddTaskModal open={addOpen} onOpenChange={setAddOpen} />

      {/* Purge Confirmation Dialog */}
      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge Archived Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all archived tasks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purgeArchived.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
