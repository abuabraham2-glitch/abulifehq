import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function More() {
  const { theme, toggle } = useTheme();

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-[22px] font-medium text-foreground">Settings</h1>

      <div className="rounded-[14px] bg-card p-4" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between py-2"
        >
          <div className="flex items-center gap-3">
            {theme === 'light' ? <Moon size={20} className="text-muted-foreground" /> : <Sun size={20} className="text-muted-foreground" />}
            <span className="text-sm text-foreground">Dark mode</span>
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
