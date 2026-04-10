import { useNavigate } from 'react-router-dom';
import { Grid3X3, Inbox, Moon, Sun, ChevronRight } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTriageCount } from '@/hooks/useTriageQueue';

export default function More() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { data: triageCount = 0 } = useTriageCount();

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-[22px] font-medium text-foreground">More</h1>

      <div className="rounded-[14px] bg-card overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
        {/* Matrix */}
        <button
          onClick={() => navigate('/matrix')}
          className="w-full flex items-center justify-between p-4 min-h-[52px] border-b"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <div className="flex items-center gap-3">
            <Grid3X3 size={20} className="text-muted-foreground" />
            <span className="text-[15px] text-foreground">Eisenhower Matrix</span>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>

        {/* Triage */}
        <button
          onClick={() => navigate('/triage')}
          className="w-full flex items-center justify-between p-4 min-h-[52px] border-b"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <div className="flex items-center gap-3">
            <Inbox size={20} className="text-muted-foreground" />
            <span className="text-[15px] text-foreground">Triage</span>
            {triageCount > 0 && (
              <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
                {triageCount}
              </span>
            )}
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between p-4 min-h-[52px]"
        >
          <div className="flex items-center gap-3">
            {theme === 'light' ? <Moon size={20} className="text-muted-foreground" /> : <Sun size={20} className="text-muted-foreground" />}
            <span className="text-[15px] text-foreground">Dark mode</span>
          </div>
          <div
            className="w-10 h-6 rounded-full flex items-center px-0.5 transition-colors"
            style={{ backgroundColor: theme === 'dark' ? '#B8906C' : '#D0CBC2' }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </div>
        </button>
      </div>

      <div className="rounded-[14px] bg-card p-5 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
        <p className="text-sm text-foreground font-medium">Life Command Center</p>
        <p className="text-xs text-muted-foreground mt-1">Built for Abu · v1.0</p>
      </div>
    </div>
  );
}
