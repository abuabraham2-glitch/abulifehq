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
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="gap-1.5 rounded-full px-5 bg-[hsl(30,12%,14%)] dark:bg-[hsl(39,33%,93%)] text-[hsl(39,33%,93%)] dark:text-[hsl(30,12%,14%)] hover:opacity-90"
        >
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
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={quadrant} onValueChange={setQuadrant}>
          <SelectTrigger className="w-[120px] h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Quadrants</SelectItem>
            {QUADRANTS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[100px] h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}</div>
      ) : !tasks?.length ? (
        <Card className="border-none shadow-sm rounded-xl">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No tasks found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="border-none shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              style={{ borderRadius: '0 12px 12px 0' }}
              onClick={() => setEditTask(task)}
            >
              <div className="flex">
                <div className="w-1 flex-shrink-0 rounded-l-none" style={{ backgroundColor: getCategoryColor(task.category) }} />
                <CardContent className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm leading-snug ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.name || 'Untitled task'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <CategoryBadge category={task.category} />
                        <QuadrantBadge quadrant={task.quadrant} />
                      </div>
                    </div>
                    {task.est_minutes != null && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium mt-0.5">{task.est_minutes}m</span>
                    )}
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
