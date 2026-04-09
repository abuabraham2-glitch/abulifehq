import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, ChevronRight, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainDumpModal } from '@/components/BrainDumpModal';
import { AddNoteModal } from '@/components/AddNoteModal';
import { PlanChatSection } from '@/components/PlanChatSection';
import { DayStripCard } from '@/components/DayStripCard';
import { CalendarBanner } from '@/components/CalendarBanner';
import { PatternInsightCard } from '@/components/PatternInsightCard';
import { ReprioritizeSection } from '@/components/ReprioritizeSection';
import { PreferencesSection } from '@/components/PreferencesSection';
import { TodaysSchedule } from '@/components/TodaysSchedule';
import { useTodayPlan, useTodayPlanItems } from '@/hooks/useDailyPlan';
import { useTriageCount } from '@/hooks/useTriageQueue';
import { getGreeting, formatDate, getRandomPhrase } from '@/lib/constants';


export default function Dashboard() {
  const navigate = useNavigate();
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const { data: plan, isLoading: loadingPlan } = useTodayPlan();
  const { data: planItems, isLoading: loadingItems } = useTodayPlanItems();
  const { data: triageCount = 0 } = useTriageCount();

  const [phrase] = useState(getRandomPhrase);

  const loading = loadingPlan || loadingItems;
  const hasPlan = !!plan && !!planItems?.length;

  const winsEligibleItems = useMemo(() => {
    const skip = (t: string) => {
      const l = t.toLowerCase();
      return l.startsWith('buffer') || l === 'lunch break' || l.includes('victory hour') || l.startsWith('school pickup') || l.includes('wind down') || l.includes('morning routine');
    };
    return planItems?.filter((i) => !i.is_calendar_event && !skip(i.title)) ?? [];
  }, [planItems]);

  const completedItems = useMemo(() => {
    return winsEligibleItems.filter((i) => i.status === 'completed');
  }, [winsEligibleItems]);

  return (
    <div className="space-y-5 md:space-y-6 pb-4">
      {/* Greeting */}
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

          <p className="text-[14px] mt-3 italic text-center md:hidden" style={{ color: '#B8906C' }}>
            "{phrase}"
          </p>
        </div>

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

          {/* Calendar events banner */}
          <CalendarBanner />

          {/* Pattern insight */}
          <PatternInsightCard />

          {/* Chat input for plan revisions */}
          <PlanChatSection planId={plan?.id ?? null} planItems={planItems ?? []} />

          {/* Re-prioritize */}
          <ReprioritizeSection />

          {/* Unified Today's Schedule */}
          <TodaysSchedule />

          {/* Today's Wins */}
          <div className="rounded-[8px] p-4" style={{ backgroundColor: 'rgba(255,255,255,0.4)', border: '1.5px solid #5C3D1E' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium wins-label">Today's wins</p>
              <p className="text-[13px] font-medium wins-label" style={{ color: '#B8906C' }}>
                {completedItems.length}/{winsEligibleItems.length}
              </p>
            </div>
            <div className="flex gap-1 mb-3">
              {winsEligibleItems.map((item, i) => (
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

          {/* Rules & Preferences */}
          <PreferencesSection />
        </>
      )}

      <BrainDumpModal open={brainDumpOpen} onOpenChange={setBrainDumpOpen} />
      <AddNoteModal open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}
