import { Moon, Sun, Grid3X3, Inbox, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/ThemeProvider';
import { useTriageCount } from '@/hooks/useTriageQueue';

export default function More() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { data: triageCount = 0 } = useTriageCount();

  const links = [
    { label: 'Matrix', icon: Grid3X3, path: '/matrix' },
    { label: 'Triage', icon: Inbox, path: '/triage', badge: triageCount },
  ];

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-[22px] md:text-[26px] font-medium text-foreground">More</h1>

      <div className="rounded-[14px] bg-card overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        {links.map(({ label, icon: Icon, path, badge }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] border-b text-left"
            style={{ borderColor: 'hsl(var(--border))' }}
          >
            <Icon size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground">{label}</span>
            {badge != null && badge > 0 && (
              <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px]"
        >
          {theme === 'light' ? <Moon size={20} className="text-muted-foreground" /> : <Sun size={20} className="text-muted-foreground" />}
          <span className="flex-1 text-[15px] text-foreground text-left">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          <div
            className="w-10 h-6 rounded-full flex items-center px-0.5 transition-colors"
            style={{ backgroundColor: theme === 'dark' ? '#e8a84c' : 'hsl(var(--border))' }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </div>
        </button>
      </div>

      <div className="rounded-[14px] bg-card p-5 text-center" style={{ border: '1px solid hsl(var(--border))' }}>
        <p className="text-sm text-foreground font-medium">Life Command Center</p>
        <p className="text-xs text-muted-foreground mt-1">Built for Abu · v2.0</p>
      </div>
    </div>
  );
}
