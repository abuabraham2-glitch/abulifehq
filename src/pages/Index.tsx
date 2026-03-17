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
import { getGreeting, formatDate, getCategoryColor, CATEGORY_COLORS } from '@/lib/categories';
import type { Task } from '@/hooks/useTasks';
import type { PlanItem } from '@/hooks/useDailyPlan';

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

  // Time by category from plan items
  const categoryTime = (planItems ?? []).reduce<Record<string, number>>((acc, item) => {
    const cat = item.category || 'Buffer';
    acc[cat] = (acc[cat] || 0) + (item.est_minutes || 0);
    return acc;
  }, {});
  const totalCategoryMinutes = Object.values(categoryTime).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-8 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, Abu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setBrainDumpOpen(true)}
          className="gap-1.5 rounded-full px-5 bg-[hsl(30,12%,14%)] dark:bg-[hsl(39,33%,93%)] text-[hsl(39,33%,93%)] dark:text-[hsl(30,12%,14%)] hover:opacity-90"
        >
          <Plus size={16} /> Brain Dump
        </Button>
      </div>

      {/* Stat cards */}
      {loadingTasks ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-none shadow-sm rounded-xl">
            <CardContent className="p-5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-2">
                <Zap size={18} className="text-red-500" />
              </div>
              <span className="text-2xl font-bold">{urgentCount}</span>
              <span className="text-[11px] text-muted-foreground">Urgent</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-xl">
            <CardContent className="p-5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-2">
                <AlertTriangle size={18} className="text-primary" />
              </div>
              <span className="text-2xl font-bold">{triageCount}</span>
              <span className="text-[11px] text-muted-foreground">Triage</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-xl">
            <CardContent className="p-5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2">
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
        <h2 className="text-lg font-semibold mb-4">Today's Schedule</h2>
        {loadingPlan ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : !plan || !planItems?.length ? (
          <Card className="border-none shadow-sm rounded-xl">
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              No plan for today yet. Your daily plan will be generated at 9pm.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {planItems.map((item) => (
              <Card key={item.id} className="border-none shadow-sm rounded-xl overflow-hidden">
                <div className="flex">
                  <div className="w-1 flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                  <CardContent className="p-4 flex-1 flex items-center justify-between">
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

      {/* Time by Category bar */}
      {plan && planItems && planItems.length > 0 && totalCategoryMinutes > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Time by Category</h2>
          <Card className="border-none shadow-sm rounded-xl">
            <CardContent className="p-5 space-y-3">
              {Object.entries(categoryTime)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, mins]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">{mins}m ({Math.round((mins / totalCategoryMinutes) * 100)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(mins / totalCategoryMinutes) * 100}%`,
                          backgroundColor: getCategoryColor(cat),
                        }}
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Eisenhower Matrix Mini */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Priority Matrix</h2>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'Do Now', label: 'Do Now', color: '#EF4444' },
            { key: 'Schedule', label: 'Schedule', color: '#3B82F6' },
            { key: 'Delegate', label: 'Delegate', color: '#10B981' },
            { key: 'Delete', label: 'Low Priority', color: '#9CA3AF' },
          ] as const).map(({ key, label, color }) => (
            <Card key={key} className="border-none shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4" style={{ backgroundColor: `${color}08` }}>
                <p className="text-xs font-semibold" style={{ color }}>{label}</p>
                <p className="text-2xl font-bold mt-1">{matrixCounts[key].length}</p>
                {key !== 'Delete' && (
                  <p className="text-xs text-muted-foreground mt-0.5">{sumHours(matrixCounts[key])}h est.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
