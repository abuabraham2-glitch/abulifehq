import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ChevronRight, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { LifeContextModal } from '@/components/LifeContextModal';
import { TaskEditModal } from '@/components/TaskEditModal';
import { FocusTimer } from '@/components/FocusTimer';
import { useTodayPlan, useTodayPlanItems, type PlanItem } from '@/hooks/useDailyPlan';
import { useTriageCount } from '@/hooks/useTriageQueue';
import { useCompleteTask, type Task } from '@/hooks/useTasks';
import { getGreeting, formatDate, getRandomPhrase, getCategoryColor, formatTime12h } from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [lifeCtxOpen, setLifeCtxOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const { planDismissed, dismissPlan } = useAppContext();

  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems, isLoading: loadingItems } = useTodayPlanItems();
  const { data: triageCount = 0 } = useTriageCount();
  const completeTask = useCompleteTask();

  const [phrase] = useState(getRandomPhrase);

  const currentItem = useMemo(() => {
    return planItems?.find((i) => i.status !== 'completed') ?? null;
  }, [planItems]);

  const upNextItems = useMemo(() => {
    if (!planItems || !currentItem) return [];
    const idx = planItems.indexOf(currentItem);
    return planItems.slice(idx + 1).filter((i) => i.status !== 'completed');
  }, [planItems, currentItem]);

  const completedItems = useMemo(() => {
    return planItems?.filter((i) => i.status === 'completed') ?? [];
  }, [planItems]);

  const totalPlannedMinutes = useMemo(() => {
    return planItems?.reduce((s, i) => s + (i.est_minutes || 0), 0) ?? 0;
  }, [planItems]);

  const totalH = Math.floor(totalPlannedMinutes / 60);
  const totalM = totalPlannedMinutes % 60;

  const handleCompleteItem = async (item: PlanItem) => {
    if (item.task_id) {
      await completeTask.mutateAsync(item.task_id);
    }
  };

  const loading = loadingPlan || loadingItems;
  const hasPlan = !!plan && !!planItems?.length;
  const planSummary = plan?.ai_notes || (typeof plan?.plan_data === 'string' ? plan.plan_data : null);

  const opacities = [0.55, 0.50, 0.45, 0.40, 0.35];

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting */}
      <div>
        <p className="text-[13px] text-muted-foreground">{formatDate(new Date())}</p>
        <h1 className="text-[22px] font-medium text-foreground mt-0.5">{getGreeting()}, Abu</h1>
        <p className="text-[13px] mt-1" style={{ color: '#B8906C' }}>{phrase}</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setBrainDumpOpen(true)}
            className="px-4 py-2 rounded-[20px] text-xs font-medium"
            style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}
          >
            + Brain dump
          </button>
          <button
            onClick={() => setLifeCtxOpen(true)}
            className="px-4 py-2 rounded-[20px] text-xs font-medium border"
            style={{ color: '#8A8478', borderColor: '#D0CBC2', backgroundColor: 'transparent' }}
          >
            Life context
          </button>
        </div>
      </div>

      {/* Triage Alert */}
      {triageCount > 0 && (
        <button
          onClick={() => navigate('/triage')}
          className="w-full flex items-center gap-3 p-4 rounded-[14px] text-left"
          style={{ backgroundColor: '#FEF2F2', border: '0.5px solid #FECACA' }}
        >
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
            <Inbox size={16} style={{ color: '#DC2626' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#991B1B' }}>{triageCount} items need your review</p>
            <p className="text-xs" style={{ color: '#B91C1C' }}>Tap to triage — takes 2 min</p>
          </div>
          <ChevronRight size={18} style={{ color: '#DC2626' }} />
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-[14px]" />
          <Skeleton className="h-48 rounded-[18px]" />
          <Skeleton className="h-20 rounded-[14px]" />
        </div>
      )}

      {!loading && !hasPlan && (
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-sm text-muted-foreground">No plan for today yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your daily plan will be generated at 9pm.</p>
        </div>
      )}

      {!loading && hasPlan && (
        <>
          {/* Plan Summary */}
          {planSummary && !planDismissed && (
            <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#B8906C' }}>📋 Today's plan</p>
              <p className="text-sm text-foreground leading-relaxed">{planSummary}</p>
              <div className="text-right mt-2">
                <button onClick={dismissPlan} className="text-[11px] font-medium" style={{ color: '#B8906C' }}>
                  Got it, dismiss
                </button>
              </div>
            </div>
          )}

          {/* Current Focus */}
          {currentItem && (
            <div>
              <p className="text-[11px] text-muted-foreground font-medium tracking-wider mb-3">CURRENT FOCUS</p>
              <div className="rounded-[18px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(currentItem.category) }} />
                  <span className="text-[11px] font-medium" style={{ color: getCategoryColor(currentItem.category) }}>
                    {currentItem.category || 'Buffer'}
                  </span>
                </div>
                <h2 className="text-xl font-medium text-foreground mb-1">{currentItem.title}</h2>
                <p className="text-[13px] text-muted-foreground mb-6">
                  {formatTime12h(currentItem.start_time)} — {formatTime12h(currentItem.end_time)}
                </p>

                <FocusTimer
                  estMinutes={currentItem.est_minutes || 25}
                  category={currentItem.category}
                />

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => handleCompleteItem(currentItem)}
                    className="px-7 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: '#F5F0E8', color: '#8A8478' }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => handleCompleteItem(currentItem)}
                    className="px-7 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: '#2C2A25', color: '#F5F0E8' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Up Next */}
          {upNextItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-muted-foreground font-medium tracking-wider">UP NEXT</p>
                <p className="text-xs" style={{ color: '#B8906C' }}>{totalH}h {totalM}m planned today</p>
              </div>
              <div className="space-y-2">
                {upNextItems.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-r-[14px] rounded-l-none p-3.5"
                    style={{
                      backgroundColor: `rgba(255,255,255,${opacities[idx] ?? 0.35})`,
                      borderLeft: `4px solid ${getCategoryColor(item.category)}`,
                    }}
                  >
                    <button
                      onClick={() => handleCompleteItem(item)}
                      className="w-[22px] h-[22px] rounded-[6px] border-2 flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: '#D0CBC2' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate up-next-task-name">{item.title}</p>
                      <p className="text-[11px] font-semibold up-next-time">
                        {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
                      </p>
                    </div>
                    <span className="text-[15px] font-medium flex-shrink-0" style={{ color: getCategoryColor(item.category) }}>
                      {item.is_calendar_event ? 'G.Cal' : `${item.est_minutes || 0}m`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Wins */}
          <div className="rounded-[14px] p-4" style={{ backgroundColor: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium wins-label">Today's wins</p>
              <p className="text-[13px] font-medium wins-label" style={{ color: '#B8906C' }}>
                {completedItems.length}/{planItems?.length ?? 0}
              </p>
            </div>
            <div className="flex gap-1 mb-3">
              {planItems?.map((item, i) => (
                <div
                  key={item.id}
                  className="h-1 flex-1 rounded-sm"
                  style={{ backgroundColor: i < completedItems.length ? '#B8906C' : '#D8D4CC' }}
                />
              ))}
            </div>
            {completedItems.length === 0 ? (
              <p className="text-xs wins-text">No wins yet — let's go!</p>
            ) : (
              <div className="space-y-2">
                {completedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                      <Check size={10} className="text-white" />
                    </div>
                    <span className="text-xs truncate wins-text">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <LifeContextModal open={lifeCtxOpen} onOpenChange={setLifeCtxOpen} />
      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
