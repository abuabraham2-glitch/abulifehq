import { NavLink, useLocation } from 'react-router-dom';
import { Home, ListTodo, Grid3X3, Inbox, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useTriageCount } from '@/hooks/useTriageQueue';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/matrix', icon: Grid3X3, label: 'Matrix' },
  { to: '/triage', icon: Inbox, label: 'Triage' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const { data: triageCount = 0 } = useTriageCount();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <main className="max-w-2xl mx-auto px-4 pt-6">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-2xl mx-auto flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center py-3 px-4 min-w-[64px] transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <Icon size={22} />
                  {label === 'Triage' && triageCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {triageCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 font-medium">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
