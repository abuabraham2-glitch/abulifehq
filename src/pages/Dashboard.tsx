import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ChevronRight, ChevronDown, RefreshCw, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { AddNoteModal } from '@/components/AddNoteModal';
import { PlanChatSection } from '@/components/PlanChatSection';
import { DayStripCard } from '@/components/DayStripCard';
import { CalendarBanner } from '@/components/CalendarBanner';

import { PreferencesSection } from '@/components/PreferencesSection';
import { TodaysSchedule } from '@/components/TodaysSchedule';
import { AddToTodayModal } from '@/components/AddToTodayModal';
import { RegenerateTodayDialog } from '@/components/RegenerateTodayDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTodayPlan, useTodayPlanItems } from '@/hooks/useDailyPlan';
import { useTriageCount } from '@/hooks/useTriageQueue';
import { getGreeting, formatDate } from '@/lib/constants';

export default function Dashboard() {
  const navigate = useNavigate();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [viewTomorrow, setViewTomorrow] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems, isLoading: loadingItems } = useTodayPlanItems();
  const { data: triageCount = 0 } = useTriageCount();

  const loading = loadingPlan || loadingItems;
  const hasPlan = !!plan && !!planItems?.length;

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
            <DropdownMenuItem onClick={() => setRegenOpen(true)} className="text-[13px] cursor-pointer">
              <RefreshCw size={14} className="mr-2" />
              Regenerate plan for today
            </DropdownMenuItem>
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

      {!loading && !hasPlan && (
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-muted-foreground">No plan for today yet.</p>
          <p className="text-[13px] text-muted-foreground mt-1">Your daily plan will be generated at 9pm.</p>
        </div>
      )}

      {!loading && hasPlan && (
        <>
          {/* Day Strip */}
          <DayStripCard viewTomorrow={viewTomorrow} />

          {/* Calendar events banner — always today */}
          <CalendarBanner />

          {/* Toggle + Focus + Timeline */}
          <TodaysSchedule
            viewTomorrow={viewTomorrow}
            onToggleTab={() => setViewTomorrow(!viewTomorrow)}
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

          {/* Re-prioritize — only on Today */}
          {!viewTomorrow && <ReprioritizeSection />}

          {/* Chat input for plan revisions */}
          <PlanChatSection planId={plan?.id ?? null} planItems={planItems ?? []} viewTomorrow={viewTomorrow} />

          {/* Rules & Preferences */}
          <PreferencesSection />
        </>
      )}

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <AddNoteModal open={noteOpen} onOpenChange={setNoteOpen} />
      <AddToTodayModal open={addOpen} onOpenChange={setAddOpen} />
      <RegenerateTodayDialog open={regenOpen} onOpenChange={setRegenOpen} />
    </div>
  );
}
