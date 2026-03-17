import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { AddTaskModal } from '@/components/AddTaskModal';
import { CATEGORIES, getCategoryColor, getQuadrantColor } from '@/lib/constants';

export default function Tasks() {
  const [category, setCategory] = useState('All');
  const [quadrant, setQuadrant] = useState('All');
  const [status, setStatus] = useState('Active');
  const [search, setSearch] = useState('');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: tasks, isLoading } = useTasks({ category, quadrant, status, search });

  return (
    <div className="space-y-4 md:space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] md:text-[26px] font-medium text-foreground">Tasks</h1>
        {/* Desktop add button */}
        <button
          onClick={() => setAddOpen(true)}
          className="hidden md:flex w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--foreground))' }}
        >
          <Plus size={18} style={{ color: 'hsl(var(--background))' }} />
        </button>
      </div>

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
            <SelectTrigger className="flex-1 min-w-[120px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={quadrant} onValueChange={setQuadrant}>
            <SelectTrigger className="flex-1 min-w-[120px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Quadrants</SelectItem>
              <SelectItem value="Do Now">Do Now</SelectItem>
              <SelectItem value="Schedule">Schedule</SelectItem>
              <SelectItem value="Delegate">Delegate</SelectItem>
              <SelectItem value="Delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="min-w-[90px] bg-card rounded-xl text-[13px] h-10 md:h-9 md:text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[72px] rounded-[14px]" />)}
        </div>
      ) : !tasks?.length ? (
        <div className="rounded-[14px] bg-card p-8 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-muted-foreground">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setEditTask(task)}
              className="w-full flex items-center gap-3 bg-card rounded-r-[14px] rounded-l-none p-4 md:p-5 text-left transition-colors active:opacity-80 md:hover:opacity-90 min-h-[56px]"
              style={{
                border: '0.5px solid rgba(0,0,0,0.04)',
                borderLeftWidth: '4px',
                borderLeftColor: getCategoryColor(task.category),
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] md:text-base font-medium text-foreground">{task.name || 'Untitled task'}</p>
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
              {task.est_minutes && (
                <span className="text-[13px] text-muted-foreground flex-shrink-0">{task.est_minutes}m</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="md:hidden fixed bottom-[76px] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: 'hsl(var(--foreground))' }}
      >
        <Plus size={24} style={{ color: 'hsl(var(--background))' }} />
      </button>

      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
      <AddTaskModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
