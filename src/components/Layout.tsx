import { NavLink, useLocation } from 'react-router-dom';
import { Home, ClipboardList, ShoppingCart, FileText, MoreHorizontal } from 'lucide-react';
import { useTriageCount } from '@/hooks/useTriageQueue';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/grocery', icon: ShoppingCart, label: 'Grocery' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/more', icon: MoreHorizontal, label: 'More', showBadge: true },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: triageCount = 0 } = useTriageCount();

  return (
    <div className="min-h-screen bg-background pb-[76px] md:pb-[80px]">
      <main className="max-w-lg md:max-w-[1000px] mx-auto px-4 md:px-8 pt-6 md:pt-10">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t h-[60px] md:h-auto"
        style={{ borderColor: 'hsl(var(--border))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg md:max-w-[1000px] mx-auto flex justify-around h-full">
          {navItems.map(({ to, icon: Icon, label, showBadge }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex flex-col items-center justify-center py-2 md:py-3 px-2 md:px-4 min-w-[56px] min-h-[44px] transition-colors"
              >
                <div className="relative">
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    style={{ color: isActive ? '#e8a84c' : 'hsl(var(--muted-foreground))' }}
                  />
                  {showBadge && triageCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {triageCount}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] mt-1"
                  style={{ color: isActive ? '#e8a84c' : 'hsl(var(--muted-foreground))', fontWeight: isActive ? 600 : 400 }}
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
