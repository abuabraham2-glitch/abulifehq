import { NavLink, useLocation } from 'react-router-dom';
import { Home, ListTodo, Grid3X3, Inbox, Settings } from 'lucide-react';
import { useTriageCount } from '@/hooks/useTriageQueue';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/matrix', icon: Grid3X3, label: 'Matrix' },
  { to: '/triage', icon: Inbox, label: 'Triage', showBadge: true },
  { to: '/more', icon: Settings, label: 'More' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: triageCount = 0 } = useTriageCount();

  return (
    <div className="min-h-screen bg-background pb-[80px]">
      <main className="max-w-lg mx-auto px-5 pt-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="max-w-lg mx-auto flex justify-around">
          {navItems.map(({ to, icon: Icon, label, showBadge }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex flex-col items-center py-3 px-4 min-w-[56px] transition-colors"
              >
                <div className="relative">
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={isActive ? 'text-primary' : 'text-muted-foreground'}
                  />
                  {showBadge && triageCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {triageCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
