import { useState } from 'react';
import { Zap, AlertTriangle, Clock, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveTasks } from '@/hooks/useTasks';
import { useTodayPlan, useTodayPlanItems } from '@/hooks/useDailyPlan';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { TaskEditModal } from '@/components/TaskEditModal';
import { CategoryBadge } from '@/components/CategoryBadge';
import { getGreeting, formatDate, getCategoryColor } from '@/lib/categories';
import type { Task } from '@/hooks/useTasks';

export default function Dashboard() {
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const { data: tasks, isLoading: loadingTasks } = useActiveTasks();
  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems } = useTodayPlanItems();

  const urgentCount = tasks?.filter((t) => t.quadrant === 'Do Now').length ?? 0;
  const triageCount = tasks?.filter((t) => t.needs_triage).length ?? 0;
  const todayMinutes = planItems?.reduce((sum, i) => sum + (i.est_minutes || 0), 0) ?? 0;

  const matrixCounts = {
    'Do Now': tasks?.filter((t) => t.quadrant === 'Do Now') ?? [],
    'Schedule': tasks?.filter((t) => t.quadrant === 'Schedule') ?? [],
    'Delegate': tasks?.filter((t) => t.quadrant === 'Delegate') ?? [],
    'Delete': tasks?.filter((t) => t.quadrant === 'Delete') ?? [],
  };

  const sumHours = (arr: Task[]) => {
    const mins = arr.reduce((s, t) => s + (t.est_minutes || 0), 0);
    return (mins / 60).toFixed(1);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, Abu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
        </div>
        <Button size="sm" onClick={() => setBrainDumpOpen(true)} className="gap-1.5">
          <Plus size={16} /> Brain Dump
        </Button>
      </div>

      {/* Stat cards */}
      {loadingTasks ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-1.5">
                <Zap size={18} className="text-red-500" />
              </div>
              <span className="text-2xl font-bold">{urgentCount}</span>
              <span className="text-[11px] text-muted-foreground">Urgent</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5" style={{ backgroundColor: 'hsl(27 30% 57% / 0.15)' }}>
                <AlertTriangle size={18} className="text-primary" />
              </div>
              <span className="text-2xl font-bold">{triageCount}</span>
              <span className="text-[11px] text-muted-foreground">Triage</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center mb-1.5">
                <Clock size={18} className="text-foreground" />
              </div>
              <span className="text-2xl font-bold">{todayMinutes}</span>
              <span className="text-[11px] text-muted-foreground">Min today</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Schedule */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Today's Schedule</h2>
        {loadingPlan ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : !plan || !planItems?.length ? (
          <Card className="border-none shadow-sm">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              No plan for today yet. Your daily plan will be generated at 9pm.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {planItems.map((item) => (
              <Card key={item.id} className="border-none shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1 flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                  <CardContent className="p-3 flex-1 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                        </span>
                        <CategoryBadge category={item.category} />
                      </div>
                    </div>
                    {item.est_minutes && (
                      <span className="text-xs text-muted-foreground font-medium">{item.est_minutes}m</span>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Eisenhower Matrix Mini */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Priority Matrix</h2>
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: 'Do Now', label: 'Do Now', bg: 'bg-red-500', darkBg: 'dark:bg-red-700' },
            { key: 'Schedule', label: 'Schedule', bg: 'bg-blue-500', darkBg: 'dark:bg-blue-700' },
            { key: 'Delegate', label: 'Delegate', bg: 'bg-emerald-500', darkBg: 'dark:bg-emerald-700' },
            { key: 'Delete', label: 'Low Priority', bg: 'bg-gray-400', darkBg: 'dark:bg-gray-600' },
          ] as const).map(({ key, label, bg, darkBg }) => (
            <div key={key} className={`${bg} ${darkBg} rounded-xl p-3 text-white`}>
              <p className="text-xs font-medium opacity-80">{label}</p>
              <p className="text-2xl font-bold">{matrixCounts[key].length}</p>
              {key !== 'Delete' && (
                <p className="text-xs opacity-70">{sumHours(matrixCounts[key])}h est.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
