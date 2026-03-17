import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { CategoryBadge, QuadrantBadge } from '@/components/CategoryBadge';
import { getCategoryColor, CATEGORIES, QUADRANTS } from '@/lib/categories';

export default function TasksPage() {
  const [category, setCategory] = useState('All');
  const [quadrant, setQuadrant] = useState('All');
  const [status, setStatus] = useState('Active');
  const [search, setSearch] = useState('');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: tasks, isLoading } = useTasks({ category, quadrant, status, search });

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus size={16} /> Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={quadrant} onValueChange={setQuadrant}>
          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Quadrants</SelectItem>
            {QUADRANTS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !tasks?.length ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No tasks found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="border-none shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setEditTask(task)}
            >
              <div className="flex">
                <div className="w-1 flex-shrink-0" style={{ backgroundColor: getCategoryColor(task.category) }} />
                <CardContent className="p-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.name}
                    </p>
                    {task.est_minutes && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{task.est_minutes}m</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <CategoryBadge category={task.category} />
                    <QuadrantBadge quadrant={task.quadrant} />
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
      <BrainDumpModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
