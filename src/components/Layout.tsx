import { NavLink, useLocation } from 'react-router-dom';
import { Home, ListTodo, Grid3X3, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/matrix', icon: Grid3X3, label: 'Matrix' },
  { to: '/more', icon: Settings, label: 'More' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background pb-[80px]">
      <main className="max-w-lg mx-auto px-5 pt-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="max-w-lg mx-auto flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center py-3 px-4 min-w-[64px] transition-colors"
              >
                <Icon
                  size={22}
                  strokeWidth={2}
                  className={isActive ? 'text-primary' : 'text-muted-foreground'}
                />
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
