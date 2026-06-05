import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ChevronRight, ChevronDown, RefreshCw, Plus, Pause, Play, CalendarRange } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { AddNoteModal } from '@/components/AddNoteModal';
import { PlanChatSection } from '@/components/PlanChatSection';
import { DayStripCard } from '@/components/DayStripCard';
import { CalendarBanner } from '@/components/CalendarBanner';


import { TodaysSchedule } from '@/components/TodaysSchedule';
import { AddToTodayModal } from '@/components/AddToTodayModal';
import { RegenerateTodayDialog } from '@/components/RegenerateTodayDialog';
import { PushedTodaySection } from '@/components/PushedTodaySection';
import { PauseDatesDialog } from '@/components/PauseDatesDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTodayPlan, useTodayPlanItems, todayStr, tomorrowStr } from '@/hooks/useDailyPlan';
import { useTriageCount } from '@/hooks/useTriageQueue';
import { usePauses, useTodayPause, useInvalidatePauses } from '@/hooks/usePauses';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getGreeting, formatDate } from '@/lib/constants';

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [viewTomorrow, setViewTomorrow] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [regenMode, setRegenMode] = useState<'new-tasks' | 'keep-tasks' | null>(null);
  const [pauseDatesOpen, setPauseDatesOpen] = useState(false);

  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems, isLoading: loadingItems } = useTodayPlanItems();
  const { data: triageCount = 0 } = useTriageCount();
  const { data: activePauses = [] } = usePauses();
  const { todayPause } = useTodayPause();
  const invalidatePauses = useInvalidatePauses();
  const hasActivePause = activePauses.length > 0;

  const loading = loadingPlan || loadingItems;
  const hasPlan = !!plan && !!planItems?.length;

  const handlePauseToday = async () => {
    const today = todayStr();
    const { error: insErr } = await supabase.from('pauses').insert({ start_date: today, end_date: today } as any);
    if (insErr) {
      console.warn('[pause-today] insert failed', insErr);
      toast.error("Couldn't pause today.");
      return;
    }
    // Clear today's plan_items
    if (plan?.id) {
      const { error: delErr } = await supabase.from('plan_items').delete().eq('plan_id', plan.id);
      if (delErr) console.warn('[pause-today] delete plan_items failed', delErr);
    }
    invalidatePauses();
    qc.invalidateQueries({ queryKey: ['daily-plan'] });
    toast.success('Paused today');
  };

  const handlePauseTomorrow = async () => {
    const tom = tomorrowStr();
    const { error } = await supabase.from('pauses').insert({ start_date: tom, end_date: tom } as any);
    if (error) {
      console.warn('[pause-tomorrow] insert failed', error);
      toast.error("Couldn't pause tomorrow.");
      return;
    }
    invalidatePauses();
    toast.success('Paused tomorrow');
  };

  const handleResume = async () => {
    const today = todayStr();
    const { error } = await supabase.from('pauses').delete().gte('end_date', today);
    if (error) {
      console.warn('[resume] delete failed', error);
      toast.error("Couldn't resume.");
      return;
    }
    invalidatePauses();
    qc.invalidateQueries({ queryKey: ['daily-plan'] });
    toast.success('Resumed');
  };

  return (
    <div className="space-y-5 md:space-y-6 pb-4">
      {/* Greeting */}
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 text-[13px] md:text-[14px] text-muted-foreground hover:text-foreground transition-colors">
              {formatDate(new Date())}
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl">
            <DropdownMenuItem onClick={() => setRegenMode('new-tasks')} className="text-[13px] cursor-pointer">
              <RefreshCw size={14} className="mr-2" />
              Regenerate + add new tasks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRegenMode('keep-tasks')} className="text-[13px] cursor-pointer">
              <RefreshCw size={14} className="mr-2" />
              Regenerate, keep current tasks
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePauseToday} className="text-[13px] cursor-pointer">
              <Pause size={14} className="mr-2" />
              Pause today
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePauseTomorrow} className="text-[13px] cursor-pointer">
              <Pause size={14} className="mr-2" />
              Pause tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPauseDatesOpen(true)} className="text-[13px] cursor-pointer">
              <CalendarRange size={14} className="mr-2" />
              Pause dates…
            </DropdownMenuItem>
            {hasActivePause && (
              <DropdownMenuItem onClick={handleResume} className="text-[13px] cursor-pointer">
                <Play size={14} className="mr-2" />
                Resume
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <h1 className="text-[22px] md:text-[32px] md:font-semibold font-medium text-foreground mt-0.5">{getGreeting()}, Abu</h1>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setBrainDumpOpen(true)}
            className="flex-1 md:flex-none px-4 py-2.5 md:py-2 rounded-[20px] text-[13px] md:text-xs font-medium min-h-[44px] md:min-h-0 text-white"
            style={{ backgroundColor: '#B8906C' }}
          >
            + Task
          </button>
          <button
            onClick={() => setNoteOpen(true)}
            className="flex-1 md:flex-none px-4 py-2.5 md:py-2 rounded-[20px] text-[13px] md:text-xs font-medium min-h-[44px] md:min-h-0 text-white"
            style={{ backgroundColor: '#5C3D1E' }}
          >
            + Note
          </button>
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

      {!loading && !hasPlan && !todayPause && (
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-muted-foreground">No plan for today yet.</p>
          <p className="text-[13px] text-muted-foreground mt-1">Your daily plan will be generated at 9pm.</p>
        </div>
      )}

      {!loading && (hasPlan || todayPause) && (
        <>
          {/* Day Strip */}
          <DayStripCard viewTomorrow={viewTomorrow} />

          {/* Calendar events banner — always today */}
          {!todayPause && <CalendarBanner />}

          {/* Toggle + Focus + Timeline (or Paused card when today is paused) */}
          <TodaysSchedule
            viewTomorrow={viewTomorrow}
            onToggleTab={() => setViewTomorrow(!viewTomorrow)}
            planId={plan?.id ?? null}
            pausedToday={todayPause}
            addButton={
              !viewTomorrow ? (
                <button
                  onClick={() => setAddOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] text-[14px] font-medium min-h-[48px] mt-2 mb-1 bg-card"
                  style={{ border: '1.5px dashed #B8906C', color: '#5C3D1E' }}
                >
                  <Plus size={16} />
                  Add to today
                </button>
              ) : null
            }
          />

          {/* Pushed today (only on Today tab, hidden while paused) */}
          {!viewTomorrow && !todayPause && <PushedTodaySection />}

          {/* Chat input for plan revisions */}
          {!todayPause && (
            <PlanChatSection planId={plan?.id ?? null} planItems={planItems ?? []} viewTomorrow={viewTomorrow} />
          )}
        </>
      )}

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <AddNoteModal open={noteOpen} onOpenChange={setNoteOpen} />
      <AddToTodayModal open={addOpen} onOpenChange={setAddOpen} />
      <RegenerateTodayDialog open={regenMode !== null} onOpenChange={(o) => !o && setRegenMode(null)} keepTasksOnly={regenMode === 'keep-tasks'} />
      <PauseDatesDialog open={pauseDatesOpen} onOpenChange={setPauseDatesOpen} onSaved={invalidatePauses} />
    </div>
  );
}
