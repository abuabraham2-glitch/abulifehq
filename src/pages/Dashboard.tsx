import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ChevronRight, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { AddNoteModal } from '@/components/AddNoteModal';
import { PlanChatSection } from '@/components/PlanChatSection';
import { TaskEditModal } from '@/components/TaskEditModal';
import { FocusTimer } from '@/components/FocusTimer';
import { SkipReasonModal } from '@/components/SkipReasonModal';
import { FullSchedule } from '@/components/FullSchedule';
import { DayStripCard } from '@/components/DayStripCard';
import { useTodayPlan, useTodayPlanItems, useUpdatePlanItem, type PlanItem } from '@/hooks/useDailyPlan';
import { useTriageCount } from '@/hooks/useTriageQueue';
import { useCompleteTask, type Task } from '@/hooks/useTasks';
import { getGreeting, formatDate, getRandomPhrase, getCategoryColor, formatTime12h } from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [skipItem, setSkipItem] = useState<PlanItem | null>(null);
  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  

  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems, isLoading: loadingItems } = useTodayPlanItems();
  const { data: triageCount = 0 } = useTriageCount();
  const completeTask = useCompleteTask();
  const updatePlanItem = useUpdatePlanItem();

  const [phrase] = useState(getRandomPhrase);

  const nowPacificTime = useMemo(() => {
    const now = new Date();
    const pac = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const h = String(pac.getHours()).padStart(2, '0');
    const m = String(pac.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }, []);

  const pendingItems = useMemo(() => {
    return planItems?.filter((i) => i.status !== 'completed' && i.status !== 'skipped') ?? [];
  }, [planItems]);

  const currentItem = useMemo(() => {
    const upcoming = pendingItems.find((i) => i.start_time >= nowPacificTime);
    if (upcoming) return { item: upcoming, overdue: false };
    // All pending are in the past — show first as fallback
    if (pendingItems.length > 0) return { item: pendingItems[0], overdue: true };
    return null;
  }, [pendingItems, nowPacificTime]);

  const upNextItems = useMemo(() => {
    if (!currentItem) return [];
    const idx = pendingItems.indexOf(currentItem.item);
    return pendingItems.slice(idx + 1).filter((i) => i.start_time >= nowPacificTime);
  }, [pendingItems, currentItem, nowPacificTime]);

  const completedItems = useMemo(() => {
    return planItems?.filter((i) => i.status === 'completed') ?? [];
  }, [planItems]);

  const totalPlannedMinutes = useMemo(() => {
    return planItems?.reduce((s, i) => s + (i.est_minutes || 0), 0) ?? 0;
  }, [planItems]);

  const totalH = Math.floor(totalPlannedMinutes / 60);
  const totalM = totalPlannedMinutes % 60;

  const openDoneDialog = (item: PlanItem) => {
    setActualMinutes(item.est_minutes || 25);
    setDoneItem(item);
  };

  const handleSaveDone = async () => {
    if (!doneItem) return;
    await updatePlanItem.mutateAsync({
      id: doneItem.id,
      status: 'completed',
      actual_minutes: actualMinutes,
    });
    if (doneItem.task_id) {
      await completeTask.mutateAsync(doneItem.task_id);
    }
    fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_item_id: doneItem.id, calendar_event_id: doneItem.calendar_event_id }),
    }).catch(() => {});
    setDoneItem(null);
  };

  const handleSkip = async (item: PlanItem, reason?: string) => {
    await updatePlanItem.mutateAsync({
      id: item.id,
      status: 'skipped',
      skip_reason: reason,
      task_id: item.task_id,
    });
    if (item.calendar_event_id) {
      fetch('https://bottlesandprint.app.n8n.cloud/webhook/skip-event-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_event_id: item.calendar_event_id, plan_item_id: item.id }),
      }).catch(() => {});
    }
    setSkipItem(null);
  };

  const loading = loadingPlan || loadingItems;
  const hasPlan = !!plan && !!planItems?.length;
  

  const opacities = [0.55, 0.50, 0.45, 0.40, 0.35];

  return (
    <div className="space-y-5 md:space-y-6 pb-4">
      {/* Greeting — mobile: stacked, desktop: two-column */}
      <div className="md:flex md:items-stretch md:justify-between md:gap-8">
        <div className="flex-shrink-0">
          <p className="text-[13px] md:text-[14px] text-muted-foreground">{formatDate(new Date())}</p>
          <h1 className="text-[22px] md:text-[32px] md:font-semibold font-medium text-foreground mt-0.5">{getGreeting()}, Abu</h1>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setBrainDumpOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 md:py-2 rounded-[20px] text-[13px] md:text-xs font-medium min-h-[44px] md:min-h-0"
              style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
            >
              + Task
            </button>
            <button
              onClick={() => setNoteOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 md:py-2 rounded-[20px] text-[13px] md:text-xs font-medium min-h-[44px] md:min-h-0"
              style={{ backgroundColor: '#B8906C', color: '#fff' }}
            >
              + Note
            </button>
          </div>

          {/* Mobile-only quote */}
          <p className="text-[14px] mt-3 italic text-center md:hidden" style={{ color: '#B8906C' }}>
            "{phrase}"
          </p>
        </div>

        {/* Desktop-only quote */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <p
            className="text-[20px] italic text-center max-w-[340px] leading-relaxed"
            style={{ color: '#B8906C', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            "{phrase}"
          </p>
        </div>
      </div>

      {/* Triage Alert */}
      {triageCount > 0 && (
        <button
          onClick={() => navigate('/triage')}
          className="w-full flex items-center gap-3 p-4 rounded-[14px] text-left min-h-[48px]"
          style={{ backgroundColor: 'hsl(0 93% 94%)', border: '0.5px solid hsl(0 93% 82%)' }}
        >
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(0 93% 88%)' }}>
            <Inbox size={16} className="text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-destructive">{triageCount} items need your review</p>
            <p className="text-[13px]" style={{ color: 'hsl(0 72% 41%)' }}>Tap to triage — takes 2 min</p>
          </div>
          <ChevronRight size={18} className="text-destructive" />
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
          <p className="text-[14px] text-muted-foreground">No plan for today yet.</p>
          <p className="text-[13px] text-muted-foreground mt-1">Your daily plan will be generated at 9pm.</p>
        </div>
      )}

      {!loading && hasPlan && (
        <>
          {/* Day Strip */}
          <DayStripCard />

          {/* Chat input for plan revisions */}
          <PlanChatSection planId={plan?.id ?? null} planItems={planItems ?? []} />

          {/* Current Focus */}
          {currentItem && (
            <div>
              <p className="text-[11px] md:text-[13px] text-muted-foreground font-medium tracking-wider mb-3">CURRENT FOCUS</p>
              <div className="rounded-[18px] bg-card p-4 md:p-6 text-center" style={{ border: '1.5px solid #5C3D1E' }}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(currentItem.item.category) }} />
                  <span className="text-[11px] font-medium" style={{ color: getCategoryColor(currentItem.item.category) }}>
                    {currentItem.item.category || 'Buffer'}
                  </span>
                </div>
                <h2 className="text-base md:text-xl font-medium text-foreground mb-1 break-words">{currentItem.item.title}</h2>
                <p className="text-[13px] text-muted-foreground mb-1">
                  {formatTime12h(currentItem.item.start_time)} — {formatTime12h(currentItem.item.end_time)}
                </p>
                {currentItem.overdue && (
                  <p className="text-[11px] font-medium text-destructive mb-4">Overdue</p>
                )}
                {!currentItem.overdue && <div className="mb-5" />}

                <FocusTimer />

                <div className="flex justify-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => setSkipItem(currentItem.item)}
                    className="flex-1 md:flex-none px-7 py-3 md:py-2.5 rounded-xl text-[14px] md:text-sm font-medium min-h-[48px] md:min-h-0"
                    style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => openDoneDialog(currentItem.item)}
                    className="flex-1 md:flex-none px-7 py-3 md:py-2.5 rounded-xl text-[14px] md:text-sm font-medium min-h-[48px] md:min-h-0"
                    style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
                  >
                    ✓ Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Up Next */}
          {upNextItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] md:text-[13px] text-muted-foreground font-medium tracking-wider">UP NEXT</p>
                <p className="text-[13px]" style={{ color: '#B8906C' }}>{totalH}h {totalM}m planned today</p>
              </div>
              <div className="space-y-2">
                {upNextItems.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-r-[14px] rounded-l-none p-3.5 min-h-[52px]"
                    style={{
                      backgroundColor: `rgba(255,255,255,${opacities[idx] ?? 0.35})`,
                      borderLeft: `4px solid ${getCategoryColor(item.category)}`,
                    }}
                  >
                    <button
                      onClick={() => openDoneDialog(item)}
                      className="w-[22px] h-[22px] rounded-[6px] border-2 flex-shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
                      style={{ borderColor: 'hsl(var(--border))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] md:text-[13px] up-next-task-name truncate">{item.title}</p>
                      <p className="text-[12px] md:text-[11px] font-semibold up-next-time">
                        {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
                      </p>
                    </div>
                    <span className="text-[13px] md:text-[15px] font-medium flex-shrink-0 whitespace-nowrap" style={{ color: getCategoryColor(item.category) }}>
                      {item.is_calendar_event ? 'G.Cal' : `${item.est_minutes || 0}m`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Schedule */}
          <FullSchedule />

          {/* Today's Wins */}
          <div className="rounded-[14px] p-4" style={{ backgroundColor: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium wins-label">Today's wins</p>
              <p className="text-[13px] font-medium wins-label" style={{ color: '#B8906C' }}>
                {completedItems.length}/{planItems?.length ?? 0}
              </p>
            </div>
            <div className="flex gap-1 mb-3">
              {planItems?.map((item, i) => (
                <div
                  key={item.id}
                  className="h-1 flex-1 rounded-sm"
                  style={{ backgroundColor: i < completedItems.length ? '#B8906C' : 'hsl(var(--border))' }}
                />
              ))}
            </div>
            {completedItems.length === 0 ? (
              <p className="text-[13px] wins-text">No wins yet — let's go!</p>
            ) : (
              <div className="space-y-2">
                {completedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 min-h-[44px]">
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#059669' }}>
                      <Check size={10} className="text-white" />
                    </div>
                    <span className="text-[13px] truncate wins-text">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <AddNoteModal open={noteOpen} onOpenChange={setNoteOpen} />
      
      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
      <SkipReasonModal
        open={!!skipItem}
        onOpenChange={(o) => !o && setSkipItem(null)}
        taskTitle={skipItem?.title || ''}
        onSkipWithReason={(reason) => skipItem && handleSkip(skipItem, reason)}
        onSkipWithoutReason={() => skipItem && handleSkip(skipItem)}
      />
      <Dialog open={!!doneItem} onOpenChange={(o) => !o && setDoneItem(null)}>
        <DialogContent className="max-w-[340px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">How long did this actually take?</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-[13px] text-muted-foreground mb-2">{doneItem?.title}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(Number(e.target.value))}
                className="w-24 text-center"
              />
              <span className="text-[13px] text-muted-foreground">minutes</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveDone}
              disabled={updatePlanItem.isPending}
              className="w-full rounded-xl"
              style={{ backgroundColor: '#059669' }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
